import { useMemo } from 'react';
import type { NativeParseResult, NativeParserStatus } from '../../shared/native-parser';
import { buildSqlFlow } from '../sql-flow';
import { PipelineGraph } from './PipelineGraph';

export function SqlFlowView({ sql, sourceOffset, parseResult, parserEnabled, parserStatus, parseDurationMs, onRevealRange }: {
    sql: string;
    sourceOffset: number;
    parseResult?: NativeParseResult;
    parserEnabled: boolean;
    parserStatus: NativeParserStatus;
    parseDurationMs?: number;
    onRevealRange: (from: number, to: number) => void;
}) {
    const model = useMemo(() => buildSqlFlow(sql, parseResult, sourceOffset), [sql, parseResult, sourceOffset]);
    const duration = parseDurationMs === undefined ? undefined : `${parseDurationMs.toFixed(1)} ms`;
    const parserLabel = !parserEnabled ? 'CodeMirror mode' : parserStatus === 'loading' ? 'Parser starting' : parserStatus === 'unavailable' ? 'Parser unavailable' : model.mode;

    return <section className="sql-flow-view" aria-label="SQL structure visualization">
        <header className="sql-flow-heading">
            <div><span className="eyebrow">SQL STRUCTURE</span><h3>How this query is composed</h3><p>Click a stage to jump to its SQL. This is a logical map, not a server execution plan.</p></div>
            <span className={`sql-flow-parser-state ${model.mode === 'native AST' ? 'is-native' : ''}`}><span className="status-light"/>{parserLabel}{duration && model.mode === 'native AST' ? ` · ${duration}` : ''}</span>
        </header>
        {model.parserError && <div className="sql-flow-parse-note" role="status">{model.mode === 'native AST' ? 'AST detail: ' : 'SQL detail: '}{model.parserError}</div>}
        {!sql.trim() ? <div className="pipeline-graph-empty">Write a SELECT query to build its structure map.</div>
            : <PipelineGraph pipeline={model.pipeline} graphKind="sql-flow" heading={model.mode === 'native AST' ? 'CLICKHOUSE SQL FLOW' : 'SQL FLOW · BEST EFFORT'} subheading="Click a node to inspect its clause and jump to it in the editor" onSelectNode={node => {
                const range = model.sourceRanges.get(node.id);
                if (range) onRevealRange(range.from, range.to);
            }}/>}
    </section>;
}
