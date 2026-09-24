import { useState, type SyntheticEvent } from 'react';
import type { ExplainPlan, ExplainPlanNode, ExplainPlanProperty } from '../../shared/explain-plan';
import type { Json } from '../../shared/types';
import type { Copy } from '../i18n';

const MAX_PROPERTY_TEXT = 12_000;

function propertyCount(value: Json) {
    if (Array.isArray(value)) return value.length.toLocaleString();
    if (value !== null && typeof value === 'object') return Object.keys(value).length.toLocaleString();
    return '';
}

function propertyText(value: Json) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return text.length > MAX_PROPERTY_TEXT ? `${text.slice(0, MAX_PROPERTY_TEXT)}\n…` : text;
}

function PlanProperty({ property }: { property: ExplainPlanProperty }) {
    const [open, setOpen] = useState(false);
    const structured = property.value !== null && typeof property.value === 'object';
    const count = structured ? propertyCount(property.value) : '';
    const onToggle = (event: SyntheticEvent<HTMLDetailsElement>) => setOpen(event.currentTarget.open);
    return structured
        ? <details className="explain-plan-property" onToggle={onToggle}>
            <summary><span>{property.name}</span><small>{count}</small></summary>
            {open && <pre>{propertyText(property.value)}</pre>}
        </details>
        : <div className="explain-plan-property is-scalar"><span>{property.name}</span><code>{propertyText(property.value)}</code></div>;
}

function PlanNode({ node, depth = 0, propertyLabel, unknownStep, depthLimit }: { node: ExplainPlanNode; depth?: number; propertyLabel: string; unknownStep: string; depthLimit: string }) {
    const [open, setOpen] = useState(depth < 2);
    const hasContent = Boolean(node.children.length || node.properties.length || node.description);
    const type = node.type === 'Unknown step' ? unknownStep : node.type === 'Depth limit reached' ? depthLimit : node.type;
    if (!hasContent) return <li className="explain-plan-leaf"><strong>{type}</strong>{node.id && <code>{node.id}</code>}</li>;
    return <li className="explain-plan-node">
        <details open={open} onToggle={event => setOpen(event.currentTarget.open)}>
            <summary>
                <span className="explain-plan-step-type">{type}</span>
                {node.id && <code>{node.id}</code>}
            </summary>
            <div className="explain-plan-node-body">
                {node.description && <p>{node.description}</p>}
                {node.properties.length > 0 && <div className="explain-plan-properties" aria-label={propertyLabel}>
                    <span className="eyebrow">{propertyLabel}</span>
                    {node.properties.map((property, index) => <PlanProperty key={`${property.name}-${index}`} property={property}/>) }
                </div>}
                {node.children.length > 0 && <ul>{node.children.map((child, index) => <PlanNode key={`${child.id ?? child.type}-${index}`} node={child} depth={depth + 1} propertyLabel={propertyLabel} unknownStep={unknownStep} depthLimit={depthLimit}/>)}</ul>}
            </div>
        </details>
    </li>;
}

export function ExplainPlanView({ plan, loading, copy }: { plan?: ExplainPlan; loading: boolean; copy: Copy['common'] }) {
    if (loading) return <div className="pipeline-graph-empty" role="status">{copy.planLoading}</div>;
    if (!plan) return <div className="pipeline-graph-empty" role="status">{copy.planNoOutput}</div>;
    return <div className="explain-plan-view">
        <header className="explain-plan-heading">
            <span className="explain-plan-mark" aria-hidden="true">PLAN</span>
            <div><h3>{copy.logicalPlan}</h3><p>{copy.logicalPlanDescription}</p></div>
            <strong>{copy.planNodeCount.replace('{count}', plan.nodeCount.toLocaleString())}</strong>
        </header>
        {plan.truncated && <p className="pipeline-graph-warning" role="status">{copy.planTruncated}</p>}
        <ul className="explain-plan-tree" aria-label={copy.logicalPlan}>
            <PlanNode node={plan.root} propertyLabel={copy.planProperties} unknownStep={copy.planUnknownStep} depthLimit={copy.planDepthLimit}/>
        </ul>
    </div>;
}
