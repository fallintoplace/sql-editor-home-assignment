import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Monitor, Notice, Published } from '../../shared/types';
import { api, message, post } from '../api';
import { Action, Callout, Select, TextField, useConfirmation } from '../ui';
export function AutomationPanel({ connectionId, onRun }: {
    connectionId: string;
    onRun: (id: string) => void;
}) {
    const client = useQueryClient(), confirmation = useConfirmation(), [publishedId, setPublishedId] = useState(''), [interval, setInterval] = useState('3600'), [condition, setCondition] = useState<Monitor['condition']>('changed'), [error, setError] = useState('');
    const published = useQuery({ queryKey: ['published'], queryFn: () => api<Published[]>('/published') });
    const monitors = useQuery({ queryKey: ['monitors'], queryFn: () => api<Monitor[]>('/monitors'), refetchInterval: 5000 });
    const notices = useQuery({ queryKey: ['notices'], queryFn: () => api<Notice[]>('/notices'), refetchInterval: 5000 });
    const publications = (published.data ?? []).filter(p => p.document.connectionId === connectionId && p.source === 'live-run');
    const publicationIds = new Set(publications.map(p => p.id));
    const visibleMonitors = (monitors.data ?? []).filter(m => publicationIds.has(m.publishedId));
    const monitorIds = new Set(visibleMonitors.map(m => m.id));
    const visibleNotices = (notices.data ?? []).filter(n => monitorIds.has(n.monitorId));
    const selected = publications.find(p => p.id === publishedId);
    const perform = async (fn: () => Promise<void>) => { setError(''); try {
        await fn();
        await client.invalidateQueries({ queryKey: ['monitors'] });
    }
    catch (e) {
        setError(message(e));
    } };
    return <div className="stack"><h2>Published monitors</h2><Callout>Fixed UTC intervals while this one server is running. Missed intervals are not replayed. Notifications are owner-only, in-app; no email or external delivery is configured.</Callout>
 <Select label="Frozen published revision" value={publishedId} options={(published.data ?? []).filter(p => p.document.connectionId === connectionId).map(p => ({ value: p.id, label: `${p.document.name} · r${p.revision}` }))} onSelect={setPublishedId}/><TextField label="Interval in seconds (minimum 60)" value={interval} onChange={setInterval}/><Select label="Notify when" value={condition} options={[{ value: 'changed', label: 'Retained result changes (first run is baseline)' }, { value: 'nonempty', label: 'Retained result contains rows' }, { value: 'failure', label: 'Execution fails' }]} onSelect={value => setCondition(value as Monitor['condition'])}/>
 <Action disabled={!selected} onClick={() => void perform(async () => { if (selected && await confirmation.ask('Create monitor', `Run published r${selected.revision} as ${selected.run.executedAs} every ${interval} seconds with its frozen parameters and limits. This consumes database compute. Notifications contain only run references.`)) {
        await post('/monitors', { publishedId, intervalSeconds: Number(interval), condition });
    } })}>Create published-revision monitor</Action>
 {visibleMonitors.map(m => <section className="panel-card" key={m.id}><strong>{published.data?.find(p => p.id === m.publishedId)?.document.name ?? m.publishedId}</strong><p>{m.paused ? 'Paused' : `Next due ${new Date(m.nextAt).toLocaleString()}`} · {m.condition}</p><div className="toolbar"><Action onClick={() => void perform(async () => { await post(`/monitors/${m.id}/pause`, { paused: !m.paused }); })}>{m.paused ? 'Resume' : 'Pause'}</Action>{m.lastRunId && <Action onClick={() => onRun(m.lastRunId!)}>Last run</Action>}</div></section>)}
 <h3>Notifications</h3>{!visibleNotices.length && <p>No notifications. Unchanged results remain quiet.</p>}{visibleNotices.map(n => <div className="panel-card" key={n.id}><p>{n.reason} · {new Date(n.createdAt).toLocaleString()}</p>{n.runId && <Action onClick={() => onRun(n.runId)}>Inspect evidence</Action>}</div>)}
 {error && <Callout danger>{error}</Callout>}{confirmation.dialog}</div>;
}
