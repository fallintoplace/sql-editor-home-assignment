import { lexSql, splitSql, SqlSyntaxError, type Statement, type Token } from './sql.js';

export interface OutlinedStatement extends Statement {
    label: string;
}
export interface StatementOutline {
    statements: OutlinedStatement[];
    error?: string;
}

/** Uses the execution boundary lexer, so quoted semicolons never create fake queries. */
export function statementOutline(text: string): StatementOutline {
    try {
        return { statements: splitSql(text).map(statement => {
            const first = lexSql(statement.sql)[0];
            const preview = statement.sql.slice(first?.from ?? 0).replace(/\s+/g, ' ').trim();
            return { ...statement, label: preview.length > 64 ? `${preview.slice(0, 61)}…` : preview };
        }) };
    } catch (error) {
        if (!(error instanceof SqlSyntaxError)) throw error;
        return { statements: [], error: error.message };
    }
}

/** Matches selectedStatement's cursor behavior in whitespace and at semicolons. */
export function activeStatementIndex(statements: readonly Statement[], position: number): number {
    if (!statements.length) return -1;
    const next = statements.findIndex(statement => position <= statement.to);
    return next < 0 ? statements.length - 1 : next;
}

/** Append a new query without replacing the selection or joining a trailing line comment. */
export function appendQuerySeparator(text: string): string {
    if (!text.length) return '';
    const last = lexSql(text).at(-1);
    if (!last || (last.kind === 'symbol' && last.text === ';')) return '\n\n';
    return text.slice(last.to).trim() ? '\n;\n\n' : ';\n\n';
}

export interface CompletionTarget {
    from: number;
    qualifier: string;
    prefix: string;
}

/** Unquoted identifier prefixes. String/comment exclusion belongs to the editor language. */
export function completionTarget(before: string, explicit = false): CompletionTarget | null {
    const word = /[A-Za-z_][A-Za-z0-9_$]*(?:\.[A-Za-z_][A-Za-z0-9_$]*)*\.?$/.exec(before);
    if (!word) {
        if (!explicit || /[\w$.`"']$/.test(before)) return null;
        return { from: before.length, qualifier: '', prefix: '' };
    }
    // Do not complete a suffix of a numeric, quoted, or otherwise unsupported identifier.
    if (word.index > 0 && /[\w$.`"'\u0080-\uFFFF]/.test(before[word.index - 1]!)) return null;
    const dot = word[0].lastIndexOf('.');
    const prefix = word[0].slice(dot + 1);
    return { from: before.length - prefix.length, qualifier: dot < 0 ? '' : word[0].slice(0, dot), prefix };
}

/** Filter before the display cap: a match late in a large schema must remain discoverable. */
export function matchingNames<T>(items: readonly T[], name: (item: T) => string, prefix: string, limit = 300): T[] {
    const needle = prefix.toLowerCase(), matches: T[] = [];
    for (const item of items) {
        if (matches.length >= limit) break;
        if (name(item).toLowerCase().includes(needle)) matches.push(item);
    }
    return matches;
}

export const CLICKHOUSE_KEYWORDS = 'SELECT WITH FROM WHERE PREWHERE GROUP BY HAVING ORDER LIMIT OFFSET AS AND OR NOT NULL JOIN LEFT RIGHT INNER FULL CROSS ARRAY JOIN UNION ALL DISTINCT EXPLAIN SETTINGS SAMPLE FINAL FORMAT INTO CASE WHEN THEN ELSE END ON USING ASC DESC';

const aliasKeywords = new Set((CLICKHOUSE_KEYWORDS + ' GLOBAL ANY ASOF ANTI SEMI OUTER WINDOW QUALIFY INTERSECT EXCEPT').toLowerCase().split(' '));

function identifierText(token: Token | undefined): string | undefined {
    if (token?.kind === 'word') return token.text;
    if (token?.kind !== 'quoted' || !['`', '"'].includes(token.text[0]!)) return undefined;
    const quote = token.text[0]!;
    return token.text.slice(1, -1).replaceAll(quote + quote, quote).replace(/\\([\\`"])/g, '$1');
}

/** Best-effort table hints, not a SQL name resolver. Ignore comments, strings and table functions. */
export function tableAliases(text: string): Map<string, string> {
    const aliases = new Map<string, string>();
    let tokens: Token[];
    try { tokens = lexSql(text); }
    catch (error) {
        if (!(error instanceof SqlSyntaxError)) throw error;
        return aliases;
    }
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i]?.kind !== 'word' || !/^(FROM|JOIN)$/i.test(tokens[i]!.text)) continue;
        let next = i + 1;
        const first = identifierText(tokens[next]);
        if (first === undefined) continue;
        const parts = [first];
        next++;
        while (tokens[next]?.text === '.') {
            const part = identifierText(tokens[next + 1]);
            if (part === undefined) break;
            parts.push(part);
            next += 2;
        }
        if (tokens[next]?.text === '(') continue;
        const name = parts.join('.');
        aliases.set(name.toLowerCase(), name);
        aliases.set(parts.at(-1)!.toLowerCase(), name);
        if (tokens[next]?.kind === 'word' && tokens[next]?.text.toUpperCase() === 'AS') next++;
        const alias = identifierText(tokens[next]);
        if (alias !== undefined && (tokens[next]?.kind === 'quoted' || !aliasKeywords.has(alias.toLowerCase()))) aliases.set(alias.toLowerCase(), name);
    }
    return aliases;
}

export const CLICKHOUSE_SNIPPETS = [
    {
        id: 'ch_time_series', label: 'Hourly time series', detail: 'Count events by hour over the last day.',
        template: 'SELECT\n    toStartOfHour(${1:event_time}) AS bucket,\n    count() AS events\nFROM ${2:events}\nWHERE ${1:event_time} >= now() - INTERVAL 1 DAY\nGROUP BY bucket\nORDER BY bucket;\n${0}',
    },
    {
        id: 'ch_top_values', label: 'Top values', detail: 'Rank categories by their row count.',
        template: 'SELECT ${1:country} AS value, count() AS total\nFROM ${2:events}\nGROUP BY value\nORDER BY total DESC\nLIMIT ${3:10};\n${0}',
    },
    {
        id: 'ch_percentiles', label: 'P50 / P95 / P99', detail: 'Approximate percentiles using one quantiles aggregate.',
        template: 'SELECT quantiles(0.5, 0.95, 0.99)(${1:duration_ms}) AS percentiles\nFROM ${2:events};\n${0}',
    },
    {
        id: 'ch_latest_per_key', label: 'Latest value per key', detail: 'Use argMax to return a value at the latest timestamp.',
        template: 'SELECT\n    ${1:user_id},\n    argMax(${2:status}, ${3:event_time}) AS latest_value\nFROM ${4:events}\nGROUP BY ${1:user_id};\n${0}',
    },
    {
        id: 'ch_conditional_count', label: 'Conditional counts', detail: 'Compare matching events with the total in one query.',
        template: "SELECT\n    countIf(${1:status} = '${2:success}') AS matching_events,\n    count() AS total_events\nFROM ${3:events};\n${0}",
    },
    {
        id: 'ch_explain_indexes', label: 'EXPLAIN index usage', detail: 'Inspect the query plan and MergeTree index pruning.',
        template: 'EXPLAIN indexes = 1\nSELECT ${1:*}\nFROM ${2:events}\nWHERE ${3:event_time >= now() - INTERVAL 1 DAY};\n${0}',
    },
] as const;
