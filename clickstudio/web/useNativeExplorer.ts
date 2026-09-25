import { useEffect, useState } from 'react';
import type { NativeExplorerRequest, NativeExplorerSnapshot } from '../shared/native-explorers';
import { message } from './api';
import { requestNativeExplorer } from './native-explorer-provider';

/** One in-flight inspection per scope; hidden or inactive panels do not poll. */
export function useNativeExplorer(connectionId: string, request: NativeExplorerRequest, active: boolean, live: boolean) {
    const kind = request.kind, database = request.database, table = request.kind === 'lineage' ? '' : request.table;
    const key = JSON.stringify([connectionId, kind, database, table]);
    const [revision, setRevision] = useState(0);
    const [state, setState] = useState<{ key: string; snapshot?: NativeExplorerSnapshot; loading: boolean; error?: string }>();
    useEffect(() => {
        if (!active) return;
        let closed = false, timer: ReturnType<typeof setTimeout> | undefined;
        let controller: AbortController | undefined;
        const clear = () => { clearTimeout(timer); timer = undefined; controller?.abort(); controller = undefined; };
        const load = async () => {
            if (closed || document.visibilityState === 'hidden' || controller) return;
            const current = new AbortController(); controller = current;
            setState(previous => ({ key, snapshot: previous?.key === key ? previous.snapshot : undefined, loading: true }));
            try {
                const snapshot = await requestNativeExplorer(connectionId, kind === 'lineage' ? { kind, database } : { kind, database, table }, current.signal);
                if (!closed && !current.signal.aborted) setState({ key, snapshot, loading: false });
            } catch (error) {
                if (!closed && !current.signal.aborted) setState(previous => ({ key, snapshot: previous?.key === key ? previous.snapshot : undefined, loading: false, error: message(error) }));
            } finally {
                if (controller === current) controller = undefined;
                if (!closed && !current.signal.aborted && live) timer = setTimeout(() => { void load(); }, 5000);
            }
        };
        const visibility = () => { clear(); if (document.visibilityState !== 'hidden') void load(); };
        void load(); document.addEventListener('visibilitychange', visibility);
        return () => { closed = true; clear(); document.removeEventListener('visibilitychange', visibility); };
    }, [connectionId, database, table, kind, key, active, live, revision]);
    const current = state?.key === key ? state : undefined;
    return { snapshot: active ? current?.snapshot : undefined, loading: active && (current?.loading ?? true), error: active ? current?.error : undefined, refresh: () => setRevision(value => value + 1) };
}
