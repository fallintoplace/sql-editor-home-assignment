import type { ProfileInsight, ProfilePipeline, ProfilePipelineNodeKind, ProfileSummary, QueryProfile, Run } from './types.js';

type EvidenceRow = Record<string, unknown>;

const rows = (value: unknown): EvidenceRow[] => Array.isArray(value) ? value.filter(row => Boolean(row) && typeof row === 'object') as EvidenceRow[] : [];
const field = (row: EvidenceRow | undefined, key: string) => row?.[key];
const numberValue = (input: unknown) => {
    const number = typeof input === 'number' ? input : typeof input === 'string' && input.trim() ? Number(input) : NaN;
    return Number.isFinite(number) ? number : undefined;
};
const integerText = (input: unknown) => input === undefined || input === null || input === '' ? undefined : String(input);
const bigintValue = (input: unknown) => {
    const text = integerText(input);
    if (!text || !/^\d+$/.test(text))
        return undefined;
    try {
        return BigInt(text);
    }
    catch {
        return undefined;
    }
};
const formatPercent = (part: bigint, whole: bigint) => `${Number((part * 10000n) / whole) / 100}%`;
const terminalTypes = new Set(['QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart']);

function evidenceRow(evidence: unknown, queryId: string) {
    const matching = rows(evidence).filter(row => String(field(row, 'query_id') ?? '') === queryId);
    return matching.find(row => terminalTypes.has(String(field(row, 'type')))) ?? matching[0] ?? rows(evidence)[0];
}

function summary(run: Run, evidence: unknown): ProfileSummary {
    const row = evidenceRow(evidence, run.queryId);
    return {
        durationMs: numberValue(field(row, 'query_duration_ms')) ?? run.elapsedMs,
        readRows: integerText(field(row, 'read_rows')) ?? run.progress?.readRows,
        readBytes: integerText(field(row, 'read_bytes')) ?? run.progress?.readBytes,
        resultRows: numberValue(field(row, 'result_rows')) ?? run.rowCount,
        resultBytes: integerText(field(row, 'result_bytes')) ?? (run.bytes ? String(run.bytes) : undefined),
        memory: integerText(field(row, 'memory_usage')) ?? run.progress?.memory,
    };
}

function insights(run: Run, profile: ProfileSummary, queryLogAvailable: boolean, hasEvidence: boolean): ProfileInsight[] {
    const result: ProfileInsight[] = [];
    const readRows = bigintValue(profile.readRows), resultRows = bigintValue(profile.resultRows);
    if (run.status === 'truncated')
        result.push({ id: 'retained-prefix', severity: 'warning', title: 'Retained result is truncated', description: 'The table, chart, and local analysis describe only the bounded retained prefix. Export and equivalence checks must treat it as incomplete.' });
    if (run.status === 'failed' || run.status === 'timed_out')
        result.push({ id: 'execution-incomplete', severity: 'critical', title: 'Execution did not complete', description: 'Performance numbers are partial evidence. Fix the execution error or deadline before comparing this run with another.' });
    if (readRows !== undefined && resultRows !== undefined && readRows > resultRows) {
        const skipped = readRows - resultRows;
        result.push({ id: 'read-result-gap', severity: 'info', title: 'Most read rows were not returned', description: `${formatPercent(skipped, readRows)} of rows read did not appear in the returned result. This is a signal to inspect filtering, aggregation, and limits, not proof of a problem.` });
    }
    const memory = numberValue(profile.memory), limit = run.limits.memory;
    if (memory !== undefined && memory >= limit * 0.8)
        result.push({ id: 'memory-pressure', severity: 'warning', title: 'Memory approached the configured limit', description: `Peak memory reached ${Math.round((memory / limit) * 100)}% of the run limit. Compare joins, aggregation, and sorting before increasing the limit.` });
    const readBytes = numberValue(profile.readBytes);
    if (readBytes !== undefined && readBytes >= 1024 ** 3)
        result.push({ id: 'large-read', severity: 'info', title: 'Large read volume', description: 'The query read at least 1 GiB. The next investigation should focus on MergeTree pruning, projections, and filter placement.' });
    if (!queryLogAvailable || !hasEvidence)
        result.push({ id: 'limited-evidence', severity: 'info', title: 'Limited server evidence', description: 'The profile falls back to live run metrics because a terminal query-log row was not available. Treat comparisons as directional.' });
    return result;
}

function pipelineKind(label: string): ProfilePipelineNodeKind {
    const normalized = label.toLowerCase();
    if (/readfrom|merge.?tree|numbers|table.?scan|source/.test(normalized))
        return 'read';
    if (/filter|where|prewhere|condition/.test(normalized))
        return 'filter';
    if (/aggregat|group.?by|distinct/.test(normalized))
        return 'aggregate';
    if (/sort|order.?by|merge.?sorting/.test(normalized))
        return 'sort';
    if (/output|format|limit|sink|result/.test(normalized))
        return 'output';
    return 'stage';
}

function pipelineLabel(line: string) {
    return line.trim()
        .replace(/^[|+\-\\/<>\s]+/, '')
        .replace(/\s+[×x*]\s*\d+\s*$/, '')
        .trim();
}

function parsePipelineEvidence(raw: readonly string[], profile: ProfileSummary): ProfilePipeline | undefined {
    const lines = raw.flatMap(line => line.replace(/\r/g, '').split('\n')).slice(0, 160);
    const nodes: ProfilePipeline['nodes'] = [], edges: ProfilePipeline['edges'] = [];
    const stack: Array<{ indent: number; id: string }> = [];
    for (const line of lines) {
        if (!line.trim() || /^\s*(header|processors?)\s*:/i.test(line))
            continue;
        const indent = line.search(/\S|$/);
        const label = pipelineLabel(line);
        if (!label || /^header\b/i.test(label))
            continue;
        while (stack.at(-1)?.indent !== undefined && stack.at(-1)!.indent >= indent)
            stack.pop();
        const id = `pipeline-${nodes.length + 1}`;
        const kind = pipelineKind(label);
        const measured = kind === 'read' || kind === 'output';
        nodes.push({ id, label, kind, detail: line.trim(), status: measured ? 'measured' : 'estimated', ...(kind === 'read' ? { rows: profile.readRows, bytes: profile.readBytes } : {}), ...(kind === 'output' ? { durationMs: profile.durationMs, rows: String(profile.resultRows), bytes: profile.resultBytes } : {}) });
        const parent = stack.at(-1)?.id;
        if (parent)
            edges.push({ source: parent, target: id });
        stack.push({ indent, id });
    }
    if (!nodes.length)
        return undefined;
    return { available: true, source: 'explain_pipeline', nodes, edges, raw: [...raw], notice: 'Processor stages come from ClickHouse EXPLAIN PIPELINE. Runtime counters are attached where the query log provides them.' };
}

function queryShapePipeline(run: Run, profile: ProfileSummary): ProfilePipeline {
    const sourceMatch = /\b(?:from|join)\s+([`"A-Za-z0-9_.]+)/i.exec(run.sql);
    const source = sourceMatch?.[1]?.replace(/[`"]+/g, '') ?? 'query source';
    const nodes: ProfilePipeline['nodes'] = [{ id: 'shape-read', label: `Read ${source}`, kind: 'read', status: 'measured', rows: profile.readRows, bytes: profile.readBytes }];
    const add = (id: string, label: string, kind: ProfilePipelineNodeKind) => nodes.push({ id, label, kind, status: 'estimated' });
    const sql = run.sql.toLowerCase();
    if (/\b(prewhere|where)\b/.test(sql))
        add('shape-filter', 'Filter / PREWHERE', 'filter');
    if (/\b(group\s+by|count\s*\(|sum\s*\(|avg\s*\(|uniq\s*\(|distinct)\b/.test(sql))
        add('shape-aggregate', 'Aggregate', 'aggregate');
    if (/\b(order\s+by|limit)\b/.test(sql))
        add('shape-sort', 'Sort / limit', 'sort');
    nodes.push({ id: 'shape-output', label: 'Return result', kind: 'output', status: 'measured', durationMs: profile.durationMs, rows: String(profile.resultRows), bytes: profile.resultBytes });
    return { available: true, source: 'query_shape', nodes, edges: nodes.slice(1).map((node, index) => ({ source: nodes[index]!.id, target: node.id })), notice: 'This is a query-shape sketch based on the SQL and measured run counters. Inspect the pipeline to replace it with ClickHouse processor evidence.' };
}

function buildPipeline(run: Run, profile: ProfileSummary, options: { pipelineAvailable: boolean; pipelineEvidence?: readonly string[] }): ProfilePipeline {
    if (options.pipelineAvailable && options.pipelineEvidence?.length) {
        const parsed = parsePipelineEvidence(options.pipelineEvidence, profile);
        if (parsed)
            return parsed;
    }
    return queryShapePipeline(run, profile);
}

export function buildQueryProfile(run: Run, evidence: unknown, options: {
    queryLogAvailable: boolean;
    pipelineAvailable: boolean;
    pipelineEvidence?: readonly string[];
    traceUrl?: string;
    notice: string;
}): QueryProfile {
    const current = summary(run, evidence);
    const pipeline = buildPipeline(run, current, options);
    return {
        version: 1,
        queryId: run.queryId,
        runId: run.id,
        summary: current,
        insights: insights(run, current, options.queryLogAvailable, Boolean(evidenceRow(evidence, run.queryId))),
        pipeline,
        capabilities: { queryLog: options.queryLogAvailable, pipelineGraph: pipeline.source === 'explain_pipeline', indexAnalysis: false, runtimePlan: false },
        evidence,
        traceUrl: options.traceUrl,
        notice: options.notice,
    };
}
