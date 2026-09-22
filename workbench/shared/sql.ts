export interface Statement {
    sql: string;
    from: number;
    to: number;
}
export interface Token {
    text: string;
    from: number;
    to: number;
    kind: 'word' | 'quoted' | 'symbol';
}
export class SqlSyntaxError extends Error {
    constructor(message: string, public readonly position: number) { super(message); }
}
/** A boundary lexer, not a SQL parser or an authorization boundary. */
export function lexSql(sql: string): Token[] {
    const out: Token[] = [];
    for (let i = 0; i < sql.length;) {
        const start = i, ch = sql[i]!;
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if (sql.startsWith('--', i) || ch === '#') {
            while (i < sql.length && sql[i] !== '\n')
                i++;
            continue;
        }
        if (sql.startsWith('/*', i)) {
            i += 2;
            let depth = 1;
            while (i < sql.length && depth) {
                if (sql.startsWith('/*', i)) {
                    depth++;
                    i += 2;
                }
                else if (sql.startsWith('*/', i)) {
                    depth--;
                    i += 2;
                }
                else
                    i++;
            }
            if (depth)
                throw new SqlSyntaxError('Unclosed block comment', start);
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            i++;
            let closed = false;
            while (i < sql.length) {
                if (sql[i] === '\\') {
                    i += 2;
                    continue;
                }
                if (sql[i] === ch) {
                    if (sql[i + 1] === ch) {
                        i += 2;
                        continue;
                    }
                    i++;
                    closed = true;
                    break;
                }
                i++;
            }
            if (!closed)
                throw new SqlSyntaxError('Unclosed quoted value or identifier', start);
            out.push({ text: sql.slice(start, i), from: start, to: i, kind: 'quoted' });
            continue;
        }
        if (ch === '$') {
            const marker = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))?.[0];
            if (marker) {
                const end = sql.indexOf(marker, i + marker.length);
                if (end < 0)
                    throw new SqlSyntaxError('Unclosed heredoc', start);
                i = end + marker.length;
                out.push({ text: sql.slice(start, i), from: start, to: i, kind: 'quoted' });
                continue;
            }
        }
        if (/[A-Za-z_]/.test(ch)) {
            i++;
            while (i < sql.length && /[A-Za-z0-9_$]/.test(sql[i]!))
                i++;
            out.push({ text: sql.slice(start, i), from: start, to: i, kind: 'word' });
        }
        else {
            i++;
            out.push({ text: ch, from: start, to: i, kind: 'symbol' });
        }
    }
    return out;
}
export function splitSql(sql: string): Statement[] {
    const tokens = lexSql(sql), result: Statement[] = [];
    let from = 0, meaningful = false;
    for (const token of tokens) {
        if (token.text === ';' && token.kind === 'symbol') {
            if (meaningful)
                result.push(trimStatement(sql, from, token.from));
            from = token.to;
            meaningful = false;
        }
        else
            meaningful = true;
    }
    if (meaningful)
        result.push(trimStatement(sql, from, sql.length));
    return result;
}
function trimStatement(sql: string, from: number, to: number): Statement {
    while (from < to && /\s/.test(sql[from]!))
        from++;
    while (to > from && /\s/.test(sql[to - 1]!))
        to--;
    return { sql: sql.slice(from, to), from, to };
}
export function selectedStatement(sql: string, from: number, to = from): Statement | undefined {
    if (to > from) {
        const selection = trimStatement(sql, from, to);
        return splitSql(selection.sql).length ? selection : undefined;
    }
    const all = splitSql(sql);
    return all.find(s => from >= s.from && from <= s.to) ??
        all.find(s => s.from > from) ?? all.at(-1);
}
export function quoteIdentifier(name: string): string {
    return '`' + name.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`';
}
export function parameterNames(sql: string): {
    name: string;
    type: string;
}[] {
    const tokens = lexSql(sql), out = new Map<string, string>();
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i]?.text !== '{' || tokens[i + 1]?.kind !== 'word' || tokens[i + 2]?.text !== ':')
            continue;
        const name = tokens[i + 1]!.text, start = tokens[i + 2]!.to;
        let end = i + 3;
        while (end < tokens.length && tokens[end]!.text !== '}')
            end++;
        if (end === tokens.length)
            throw new SqlSyntaxError('Unclosed parameter', tokens[i]!.from);
        const type = sql.slice(start, tokens[end]!.from).trim();
        if (!type || (out.has(name) && out.get(name) !== type))
            throw new SqlSyntaxError('Conflicting parameter type', start);
        out.set(name, type);
        i = end;
    }
    return [...out].map(([name, type]) => ({ name, type }));
}
/** Only substitutes lexer-recognized placeholders in explicit snippet expansion. */
export function insertChildFilter(sql: string, column: string, value: string | null, parameter = 'wb_filter') {
    const statements = splitSql(sql);
    if (statements.length !== 1)
        throw new Error('Child filtering requires one statement');
    const parent = statements[0]!.sql;
    const used = new Set(parameterNames(parent).map(p => p.name));
    while (used.has(parameter))
        parameter += '_child';
    const predicate = value === null ? `isNull(${quoteIdentifier(column)})` : `toString(${quoteIdentifier(column)}) = {${parameter}:String}`;
    const parameters: Record<string, string> = value === null ? {} : { [parameter]: value };
    return { sql: `SELECT *\nFROM (\n${parent}\n) AS parent_result\nWHERE ${predicate}`, parameters };
}
