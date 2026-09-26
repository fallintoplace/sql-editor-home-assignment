import type { ReplicationSnapshot } from '../shared/replication';
import type { WorkloadSnapshot, WorkloadWindow } from '../shared/workload';
import { api } from './api';

export function loadWorkload(connectionId: string, minutes: WorkloadWindow, signal: AbortSignal) {
    return api<WorkloadSnapshot>(`/connections/${encodeURIComponent(connectionId)}/workload?minutes=${minutes}`, { signal });
}

export function loadReplication(connectionId: string, signal: AbortSignal) {
    return api<ReplicationSnapshot>(`/connections/${encodeURIComponent(connectionId)}/replication`, { signal });
}
