// Declare cascade layer order before Click UI injects its component styles.
import './tailwind.css';
import React, { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ClickUIProvider, PasswordField } from '@clickhouse/click-ui';
import type { Connection, Principal, Published } from '../shared/types';
import { displayValue, exportCsv } from '../shared/results';
import { api, download, message, post } from './api';
import { Action, Callout, Select } from './ui';
import { Chart } from './components/Chart';
import { experienceOptions, getCopy, localeOptions, themeOptions, themeValues, type Copy, type ExperienceLevel, type Locale, type Theme } from './i18n';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
const Workspace = lazy(() => import('./Workspace').then(module => ({ default: module.Workspace })));
class Boundary extends React.Component<{
    copy: Copy;
    children: ReactNode;
}, {
    error?: Error;
}> {
    state: {
        error?: Error;
    } = {};
    static getDerivedStateFromError(error: Error) { return { error }; }
    render() { if (this.state.error)
        return <main className="fatal"><h1>{this.props.copy.errors.renderTitle}</h1><p>{this.state.error.message}</p><p>{this.props.copy.errors.persistedDrafts}</p><Action onClick={() => location.reload()}>{this.props.copy.errors.reload}</Action></main>; return this.props.children; }
}
function Shared({ token, copy, locale }: {
    token: string;
    copy: Copy;
    locale: Locale;
}) {
    const query = useQuery({ queryKey: ['shared', token], queryFn: () => api<Published>(`/shared/${encodeURIComponent(token)}`) }), [page, setPage] = useState(0);
    const p = query.data;
    return <main className="shared"><header><h1>{copy.shared.title}</h1><p>{copy.shared.description}</p></header>{query.error && <Callout danger>{message(query.error)}</Callout>}{p && <><h2>{p.document.name} · revision {p.revision}</h2>{p.source === 'fixture' && <Callout>{copy.shared.fixture}</Callout>}<Callout>{p.result.completeness === 'truncated' ? copy.shared.truncated : copy.shared.complete} · {copy.shared.executed} {new Date(p.result.createdAt).toLocaleString(locale)} · {copy.shared.expires} {new Date(p.expiresAt).toLocaleString(locale)} · {p.run.queryId}</Callout><pre className="code-block">{p.document.sql}</pre><p>{copy.shared.connection}: {p.document.connectionId}. {copy.shared.parameters}: {JSON.stringify(p.document.parameters)}. {copy.shared.executedAs}: {p.run.executedAs}.</p><Chart result={p.result} config={p.document.chart}/><div className="table-scroll"><table><thead><tr>{p.result.columns.map((c, i) => <th key={i}>{c.name}<small>{c.type}</small></th>)}</tr></thead><tbody>{p.result.rows.slice(page * 200, page * 200 + 200).map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j}>{displayValue(v)}</td>)}</tr>)}</tbody></table></div><div className="toolbar"><Action disabled={page === 0} onClick={() => setPage(page - 1)}>{copy.common.previous}</Action><span>{copy.shared.page} {page + 1} {copy.common.of} {Math.max(1, Math.ceil(p.result.rows.length / 200))}</span><Action disabled={(page + 1) * 200 >= p.result.rows.length} onClick={() => setPage(page + 1)}>{copy.common.next}</Action><Action onClick={() => download('query-studio-shared-result.json', p)}>{copy.shared.evidenceJson}</Action><Action onClick={() => download('query-studio-shared-result.csv', exportCsv(p.result), 'text/csv')}>{copy.shared.csv}</Action></div></>}</main>;
}
function Authenticated({ dark, experience, copy }: {
    dark: boolean;
    experience: ExperienceLevel;
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
        return <p className="center" role="status">{copy.auth.opening}</p>;
    if (session.error)
        return <Callout danger>{message(session.error)}</Callout>;
    if (!session.data?.principal)
        return <main className="login"><h1>{copy.auth.title}</h1><p>{copy.auth.description}</p><PasswordField label={copy.auth.tokenLabel} value={token} onChange={setToken}/><Action type="primary" disabled={busy || !token} onClick={() => { setBusy(true); setError(''); void post('/session', { token }).then(() => { setToken(''); return session.refetch(); }).catch(e => setError(message(e))).finally(() => setBusy(false)); }}>{copy.auth.signIn}</Action>{error && <Callout danger>{error}</Callout>}</main>;
    return <>{session.data.demo && <Callout>{copy.app.demoMode}</Callout>}
 <div className="connection-picker"><Select label={copy.connection.profile} value={connection?.id ?? ''} options={(connections.data ?? []).map(c => ({ value: c.id, label: c.name }))} onSelect={setSelected}/><span className="muted">{copy.connection.privateWorkspace}</span>{session.data.requiresLogin && <Action onClick={() => void api('/session', { method: 'DELETE' }).then(() => { queryClient.clear(); location.reload(); }).catch(e => setError(message(e)))}>{copy.auth.signOut}</Action>}</div>
 {connection && <Suspense fallback={<p className="center" role="status">{copy.auth.opening}</p>}><Workspace key={connection.id} connection={connection} dark={dark} experience={experience} copy={copy} refresh={() => connections.refetch()}/></Suspense>} {connections.error && <Callout danger>{message(connections.error)}</Callout>}</>;
}
function Root() {
    const [theme, setTheme] = useState<Theme>(() => { try {
        const stored = localStorage.getItem('cathedral:theme');
        if (themeValues.includes(stored as Theme))
            return stored as Theme;
        return 'monokai';
    }
    catch {
        return 'monokai';
    } });
    const [experience, setExperience] = useState<ExperienceLevel>(() => { try {
        const stored = localStorage.getItem('cathedral:experience');
        if (stored === 'beginner')
            return 'beginner';
        if (stored === 'advanced' || stored === 'expert')
            return 'expert';
        return 'beginner';
    }
    catch {
        return 'beginner';
    } });
    const [locale, setLocale] = useState<Locale>(() => {
        try {
            const stored = localStorage.getItem('cathedral:locale');
            return localeOptions.some(option => option.value === stored) ? stored as Locale : 'en';
        }
        catch {
            return 'en';
        }
    });
    const copy = getCopy(locale);
    const dark = theme === 'monokai';
    useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.dataset.palette = theme; document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; try {
        localStorage.setItem('cathedral:theme', theme);
    }
    catch { } }, [dark, theme]);
    useEffect(() => { document.documentElement.lang = locale; try {
        localStorage.setItem('cathedral:locale', locale);
    }
    catch { } }, [locale]);
    useEffect(() => { try {
        localStorage.setItem('cathedral:experience', experience);
    }
    catch { } }, [experience]);
    const token = /^\/share\/([^/]+)$/.exec(location.pathname)?.[1];
    return <ClickUIProvider theme={dark ? 'dark' : 'light'}><div className="application"><header className="app-header"><div><span className="wordmark">{copy.app.name}</span></div><div className="app-header-actions"><div className="language-picker"><Select label={copy.app.language} value={locale} options={localeOptions} useFullWidthItems itemCharacterLimit="32ch" triggerProps={{ id: 'header-language-picker' }} onSelect={value => setLocale(value as Locale)}/></div><div className="theme-picker"><span className="theme-charm" aria-hidden="true">✦</span><Select label={copy.app.theme} value={theme} options={themeOptions} useFullWidthItems itemCharacterLimit="32ch" triggerProps={{ id: 'header-theme-picker' }} onSelect={value => setTheme(value as Theme)}/></div><div className="level-picker"><Select label={copy.app.experience} value={experience} options={experienceOptions(copy)} useFullWidthItems itemCharacterLimit="32ch" triggerProps={{ id: 'header-level-picker' }} onSelect={value => setExperience(value as ExperienceLevel)}/></div></div></header><Boundary copy={copy}>{token ? <Shared token={token} copy={copy} locale={locale}/> : <Authenticated dark={dark} experience={experience} copy={copy}/>}</Boundary></div></ClickUIProvider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><Root /></QueryClientProvider></React.StrictMode>);
