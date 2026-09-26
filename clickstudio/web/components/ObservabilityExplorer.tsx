import { useState } from 'react';
import type { Capability } from '../../shared/types';
import { NativeExplorerDialog } from './NativeExplorerDialog';
import { ReplicationExplorer } from './ReplicationExplorer';
import { WorkloadExplorer } from './WorkloadExplorer';

type ObservabilityTab = 'workload' | 'replication';

export function ObservabilityExplorer({ connectionId, connectionLabel, trusted, queryLog, replication, onClose }: {
    connectionId: string;
    connectionLabel: string;
    trusted: boolean;
    queryLog?: Capability;
    replication?: Capability;
    onClose: () => void;
}) {
    const [tab, setTab] = useState<ObservabilityTab>('workload');
    return <NativeExplorerDialog title="Observability" description={`${connectionLabel} · workload and replication`} closeLabel="Close observability" onClose={onClose}>
        <div className="observability-shell">
            <div className="native-tabs observability-tabs" role="tablist" aria-label="Observability views">
                <button id="observability-workload-tab" type="button" role="tab" aria-selected={tab === 'workload'} aria-controls="observability-workload-panel" onClick={() => setTab('workload')}>Workload</button>
                <button id="observability-replication-tab" type="button" role="tab" aria-selected={tab === 'replication'} aria-controls="observability-replication-panel" onClick={() => setTab('replication')}>Replication</button>
            </div>
            {tab === 'workload'
                ? <div id="observability-workload-panel" className="observability-tabpanel" role="tabpanel" aria-labelledby="observability-workload-tab" tabIndex={0}>
                    <WorkloadExplorer connectionId={connectionId} capability={queryLog} trusted={trusted}/>
                    <p className="observability-profile-hint">For one query’s call stacks, open its run and choose <strong>Insights → CPU profile</strong>.</p>
                </div>
                : <div id="observability-replication-panel" className="observability-tabpanel" role="tabpanel" aria-labelledby="observability-replication-tab" tabIndex={0}>
                    <ReplicationExplorer connectionId={connectionId} capability={replication} trusted={trusted}/>
                </div>}
        </div>
    </NativeExplorerDialog>;
}
