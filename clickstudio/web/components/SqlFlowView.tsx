import { useMemo } from 'react';
import type { NativeParseResult, NativeParserStatus } from '../../shared/native-parser';
import { buildSqlFlow } from '../sql-flow';
import { PipelineGraph } from './PipelineGraph';
import type { Copy } from '../i18n';

export function SqlFlowView({ copy, sql, sourceOffset, parseResult, parserEnabled, parserStatus, parseDurationMs, onRevealRange }: {
    copy: Copy['common'];
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
    const parserLabel = !parserEnabled ? copy.sqlFlowCodeMirror : parserStatus === 'loading' ? copy.sqlFlowParserStarting : parserStatus === 'unavailable' ? copy.sqlFlowParserUnavailable : model.mode === 'native AST' ? copy.sqlFlowNativeAst : copy.sqlFlowKeywordEstimate;

    return <section className="sql-flow-view" aria-label={copy.visualizeSqlStructure}>
        <header className="sql-flow-heading">
            <div><span className="eyebrow">{copy.sqlStructure.toUpperCase()}</span><h3>{copy.sqlFlowTitle}</h3><p>{copy.sqlFlowDescription}</p><p>{copy.sqlFlowClickStage}</p></div>
            <span className={`sql-flow-parser-state ${model.mode === 'native AST' ? 'is-native' : ''}`}><span className="status-light"/>{parserLabel}{duration && model.mode === 'native AST' ? ` · ${duration}` : ''}</span>
        </header>
        {model.parserError && <div className="sql-flow-parse-note" role="status">{model.mode === 'native AST' ? copy.sqlFlowAstDetail : copy.sqlFlowSqlDetail}{model.parserError}</div>}
        {!sql.trim() ? <div className="pipeline-graph-empty">{copy.sqlFlowEmpty}</div>
            : <PipelineGraph copy={copy} pipeline={model.pipeline} graphKind="sql-flow" heading={model.mode === 'native AST' ? copy.sqlFlowNativeHeading : copy.sqlFlowFallbackHeading} subheading={copy.sqlFlowGraphHint} onSelectNode={node => {
                const range = model.sourceRanges.get(node.id);
                if (range) onRevealRange(range.from, range.to);
            }}/>}
    </section>;
}
