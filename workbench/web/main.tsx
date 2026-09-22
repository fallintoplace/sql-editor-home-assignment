// Declare cascade layer order before Click UI injects its component styles.
import './styles.css';
import React, { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ClickUIProvider, PasswordField } from '@clickhouse/click-ui';
import type { Connection, Principal, Published } from '../shared/types';
import { displayValue, exportCsv } from '../shared/results';
import { api, download, message, post } from './api';
import { Action, Callout, Select } from './ui';
import { Workspace } from './Workspace';
import { Chart } from './components/Chart';
import { getCopy, type Copy, type Locale } from './i18n';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
class Boundary extends React.Component<{
    children: ReactNode;
}, {
    error?: Error;
}> {
    state: {
        error?: Error;
    } = {};
    static getDerivedStateFromError(error: Error) { return { error }; }
    render() { if (this.state.error)
        return <main className="fatal"><h1>The workspace could not render.</h1><p>{this.state.error.message}</p><p>Previously persisted drafts remain in this browser. Do not clear browser storage.</p><Action onClick={() => location.reload()}>Reload workspace</Action></main>; return this.props.children; }
}
function Shared({ token }: {
    token: string;
}) {
    const query = useQuery({ queryKey: ['shared', token], queryFn: () => api<Published>(`/shared/${encodeURIComponent(token)}`) }), [page, setPage] = useState(0);
    const p = query.data;
    return <main className="shared"><header><h1>Cathedral · shared evidence</h1><p>Read-only snapshot. This link cannot execute SQL or grant access to the source database.</p></header>{query.error && <Callout danger>{message(query.error)}</Callout>}{p && <><h2>{p.document.name} · revision {p.revision}</h2>{p.source === 'fixture' && <Callout>DEMO FIXTURE SNAPSHOT — no SQL was evaluated and these rows are not live database evidence.</Callout>}<Callout>{p.result.completeness} snapshot · executed {new Date(p.result.createdAt).toLocaleString()} · expires {new Date(p.expiresAt).toLocaleString()} · {p.run.queryId}</Callout><pre className="code-block">{p.document.sql}</pre><p>Connection reference: {p.document.connectionId}. Parameters: {JSON.stringify(p.document.parameters)}. Executed as: {p.run.executedAs}.</p><Chart result={p.result} config={p.document.chart}/><div className="table-scroll"><table><thead><tr>{p.result.columns.map((c, i) => <th key={i}>{c.name}<small>{c.type}</small></th>)}</tr></thead><tbody>{p.result.rows.slice(page * 200, page * 200 + 200).map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j}>{displayValue(v)}</td>)}</tr>)}</tbody></table></div><div className="toolbar"><Action disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Action><span>Page {page + 1} of {Math.max(1, Math.ceil(p.result.rows.length / 200))}</span><Action disabled={(page + 1) * 200 >= p.result.rows.length} onClick={() => setPage(page + 1)}>Next</Action><Action onClick={() => download('shared-evidence.json', p)}>Evidence JSON</Action><Action onClick={() => download('shared-result.csv', exportCsv(p.result), 'text/csv')}>CSV</Action></div></>}</main>;
}
function Authenticated({ dark, copy }: {
    dark: boolean;
    copy: Copy;
}) {
    const session = useQuery({ queryKey: ['session'], queryFn: () => api<{
            principal: Principal | null;
            requiresLogin: boolean;
            demo: boolean;
            storageMode: string;
        }>('/session') });
    const connections = useQuery({ queryKey: ['connections'], queryFn: () => api<(Connection & {
            trusted: boolean;
        })[]>('/connections'), enabled: Boolean(session.data?.principal) });
    const [selected, setSelected] = useState(new URLSearchParams(location.search).get('connection') ?? ''), [token, setToken] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const connection = connections.data?.find(c => c.id === selected) ?? connections.data?.[0];
    if (session.isPending)
        return <p className="center" role="status">Opening workspace…</p>;
    if (session.error)
        return <Callout danger>{message(session.error)}</Callout>;
    if (!session.data?.principal)
        return <main className="login"><h1>Open your workspace</h1><p>Use the access token configured by your server operator. Database and OpenAI credentials never belong in this form.</p><PasswordField label="Workspace access token" value={token} onChange={setToken}/><Action type="primary" disabled={busy || !token} onClick={() => { setBusy(true); setError(''); void post('/session', { token }).then(() => { setToken(''); return session.refetch(); }).catch(e => setError(message(e))).finally(() => setBusy(false)); }}>Sign in</Action>{error && <Callout danger>{error}</Callout>}</main>;
    return <>{session.data.demo && <Callout>DEMO FIXTURE MODE — no ClickHouse queries or imports are executed. SQL text is not evaluated; this mode exercises UI and lifecycle behavior only.</Callout>}
 <div className="connection-picker"><Select label={copy.connection.profile} value={connection?.id ?? ''} options={(connections.data ?? []).map(c => ({ value: c.id, label: c.name }))} onSelect={setSelected}/><span className="muted">{copy.connection.privateWorkspace}</span>{session.data.requiresLogin && <Action onClick={() => void api('/session', { method: 'DELETE' }).then(() => { queryClient.clear(); location.reload(); }).catch(e => setError(message(e)))}>Sign out</Action>}</div>
 {connection && <Workspace key={connection.id} connection={connection} dark={dark} copy={copy} refresh={() => connections.refetch()}/>} {connections.error && <Callout danger>{message(connections.error)}</Callout>}</>;
}
function Root() {
    const [dark, setDark] = useState(() => { try {
        return localStorage.getItem('cathedral:theme') === 'dark';
    }
    catch {
        return false;
    } });
    const [locale, setLocale] = useState<Locale>(() => {
        try {
            return localStorage.getItem('cathedral:locale') === 'de' ? 'de' : 'en';
        }
        catch {
            return 'en';
        }
    });
    const copy = getCopy(locale);
    useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; try {
        localStorage.setItem('cathedral:theme', dark ? 'dark' : 'light');
    }
    catch { } }, [dark]);
    useEffect(() => { try {
        localStorage.setItem('cathedral:locale', locale);
    }
    catch { } }, [locale]);
    const token = /^\/share\/([^/]+)$/.exec(location.pathname)?.[1];
    return <ClickUIProvider theme={dark ? 'dark' : 'light'}><div className="application"><header className="app-header"><div><span className="wordmark">{copy.app.name}</span><span className="tagline">{copy.app.tagline}</span></div><div className="app-header-actions"><Action aria-label={copy.app.nextLanguage} onClick={() => setLocale(value => value === 'en' ? 'de' : 'en')}>{copy.app.nextLanguage}</Action><Action onClick={() => setDark(v => !v)}>{dark ? copy.app.lightMode : copy.app.darkMode}</Action></div></header><Boundary>{token ? <Shared token={token}/> : <Authenticated dark={dark} copy={copy}/>}</Boundary></div></ClickUIProvider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><Root /></QueryClientProvider></React.StrictMode>);
