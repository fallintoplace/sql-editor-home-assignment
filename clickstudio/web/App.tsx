import { useCallback, useEffect, useRef, useState } from 'react';
import { api, message, post } from './api';
import { Button, cx, Icon, SelectControl } from './components/ui';
import { Workspace } from './Workspace';
import { experienceOptions, getCopy, localeOptions, themeAppearance, themeOptions, type ExperienceLevel, type Locale, type Theme } from './i18n';
import { RadioGroup } from '@clickhouse/click-ui/RadioGroup';
import clickhouseLogomarkDark from './assets/clickhouse-logomark-dark.svg';
import clickhouseLogomarkLight from './assets/clickhouse-logomark-light.svg';
import type { Connected, Session } from './workspace-types';

const connectionLabel = (connection: Connected, demo: boolean) => demo && connection.dataSource === 'fixture' ? connection.id === 'demo' ? 'Sample data' : 'Another sample' : connection.name;
const pref = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    try {
        const value = localStorage.getItem(key);
        return values.find(candidate => candidate === value) ?? fallback;
    } catch { return fallback; }
};

function App() {
    const [locale, setLocale] = useState<Locale>(() => pref('clickstudio:locale', ['en', 'de', 'es', 'nl', 'zh', 'ru'] as const, 'en'));
    const [theme, setTheme] = useState<Theme>(() => pref('clickstudio:theme', ['click-dark', 'click-light'] as const, 'click-dark'));
    const [experience, setExperience] = useState<ExperienceLevel>(() => pref('clickstudio:experience', ['beginner', 'expert'] as const, 'beginner'));
    const [session, setSession] = useState<Session>();
    const [connections, setConnections] = useState<Connected[]>([]);
    const [connectionId, setConnectionId] = useState(() => new URLSearchParams(location.search).get('connection') ?? '');
    const [sessionError, setSessionError] = useState('');
    const [token, setToken] = useState('');
    const [busy, setBusy] = useState(false);
    const [connectionPicker, setConnectionPicker] = useState(false);
    const [connectionActionBusy, setConnectionActionBusy] = useState(false);
    const trustActionRef = useRef<() => Promise<void>>(async () => undefined);
    const testConnectionActionRef = useRef<() => Promise<void>>(async () => undefined);
    const copy = getCopy(locale);
    const connection = connections.find(item => item.id === connectionId) ?? connections[0];
    const otherConnections = connection ? connections.filter(item => item.id !== connection.id && (!session?.demo || experience === 'expert')) : [];
    const dark = themeAppearance[theme].dark;
    const selectConnection = useCallback((id: string) => {
        setConnectionId(id);
        const url = new URL(window.location.href);
        url.searchParams.set('connection', id);
        window.history.replaceState(window.history.state, '', url);
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.lang = locale;
        document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeAppearance[theme].chromeColor);
        try {
            localStorage.setItem('clickstudio:theme', theme);
            localStorage.setItem('clickstudio:locale', locale);
            localStorage.setItem('clickstudio:experience', experience);
        } catch { }
    }, [dark, experience, locale, theme]);

    const loadSession = useCallback(async () => {
        const next = await api<Session>('/session');
        setSession(next);
        if (next.principal) {
            const profiles = await api<Connected[]>('/connections');
            setConnections(profiles);
            setConnectionId(current => profiles.some(item => item.id === current) ? current : profiles[0]?.id ?? '');
        }
    }, []);

    useEffect(() => { void loadSession().catch(error => setSessionError(message(error))); }, [loadSession]);

    const login = async () => {
        if (!token || busy) return;
        setBusy(true); setSessionError('');
        try {
            await post('/session', { token });
            setToken('');
            await loadSession();
        } catch (error) { setSessionError(message(error)); }
        finally { setBusy(false); }
    };

    const runConnectionAction = async (testConnection: boolean) => {
        if (connectionActionBusy) return;
        setConnectionActionBusy(true);
        try { await (testConnection ? testConnectionActionRef.current : trustActionRef.current)(); }
        finally { setConnectionActionBusy(false); }
    };

    if (!session) return <main className="auth-screen"><section className="auth-card animate-enter"><Brand theme={theme}/><span className="eyebrow mt-8">PRIVATE WORKSPACE</span><h1>{sessionError ? 'Workspace unavailable' : copy.auth.opening}</h1>{sessionError ? <><p>{sessionError}</p><Button variant="primary" onClick={() => { setSessionError(''); void loadSession().catch(error => setSessionError(message(error))); }}>Try again</Button></> : <div className="splash-status"><span className="loading-orbit"/><p>{copy.auth.opening}</p></div>}</section></main>;
    if (!session.principal) return <main className="auth-screen"><form className="auth-card animate-enter" onSubmit={event => { event.preventDefault(); void login(); }}><Brand theme={theme}/><span className="eyebrow mt-8">Private workspace</span><h1>{copy.auth.title}</h1><p>{copy.auth.description}</p><label className="field-label">{copy.auth.token}<input className="field-input mt-2" type="password" autoComplete="current-password" value={token} onChange={event => setToken(event.target.value)} autoFocus/></label>{sessionError && <div className="callout callout-error">{sessionError}</div>}<Button variant="primary" type="submit" disabled={busy || !token} className="mt-4 w-full">{busy ? copy.auth.opening : copy.auth.open}<span className="button-arrow">↗</span></Button><div className="auth-footnote"><Icon name="lock"/> Credentials are handled by the workspace server.</div></form></main>;

    const connectionNeedsTest = Boolean(connection && !session.demo && !connection.manifest);
    const connectionStatus = connection?.trusted
        ? connectionNeedsTest ? 'Retest needed' : 'Read-only'
        : connection?.manifest ? 'Review needed' : 'Test needed';

    return <div className="application" data-experience={experience}>
        <header className="topbar">
            <Brand theme={theme}/>
            <div className="topbar-divider"/>
            <div className="connection-wrap">
                <button className="connection-trigger" type="button" aria-haspopup="dialog" aria-expanded={connectionPicker} aria-controls="connection-menu" onClick={() => setConnectionPicker(value => !value)}>
                    <span className={cx('connection-env', session.demo && 'is-demo')} title={session.demo ? 'Queries are not sent to a live database.' : undefined}><span className={cx('status-light', session.demo ? 'is-warning' : connection?.trusted ? 'is-trusted' : 'is-warning')}/>{session.demo ? 'DEMO DATA' : 'LIVE CONNECTION'}</span>
                    {!session.demo && <span className={cx('connection-quick-status', connection?.trusted && !connectionNeedsTest ? 'is-ready' : 'is-review')}>{connectionStatus}</span>}
                    <strong>{connection ? connectionLabel(connection, session.demo) : 'Choose connection'}</strong>
                    <span className="connection-database">{connection?.database ?? '—'} <Icon name="chevron"/></span>
                </button>
                {connectionPicker && connection && <div className="connection-menu animate-enter" id="connection-menu" role="dialog" aria-label="Connection details">
                    <div className="connection-menu-current">
                        <span className="connection-menu-heading">Current connection</span>
                        <strong>{connectionLabel(connection, session.demo)}</strong>
                        <small>{session.demo ? 'Local sample data' : `Database: ${connection.database} · Server: ${connection.host}`}</small>
                    </div>
                    <p className={cx('connection-menu-note', session.demo ? 'is-sample' : connection.trusted && !connectionNeedsTest ? 'is-ready' : 'is-review')} role="status">
                        {session.demo ? 'This demo uses sample data. Your SQL is not sent to a real database.' : connectionNeedsTest ? connection.trusted ? 'Read-only access is on, but this server needs a fresh capability check.' : 'Test this connection to discover its ClickHouse features.' : connection.trusted ? 'Read-only access is on. Queries can read data but cannot change it.' : 'Connection tested. Turn on read-only access when you are ready to query.'}
                    </p>
                    {(!session.demo || !connection.trusted) && <Button variant={!session.demo && connection.trusted ? 'ghost' : 'primary'} className="connection-menu-action" disabled={connectionActionBusy} onClick={() => void runConnectionAction(connectionNeedsTest)}>
                        {connectionActionBusy ? connectionNeedsTest ? 'Testing…' : 'Saving…' : session.demo ? 'Start exploring' : connectionNeedsTest ? connection.trusted ? 'Retest connection' : 'Test connection' : connection.trusted ? 'Turn off read-only access' : 'Trust connection'}
                    </Button>}
                    {otherConnections.length > 0 && <div className="connection-switch-list">
                        <span className="connection-menu-heading">Switch connection</span>
                        {otherConnections.map(item => <button key={item.id} type="button" onClick={() => { selectConnection(item.id); setConnectionPicker(false); }}>
                            <span><strong>{connectionLabel(item, session.demo)}</strong><small>{session.demo ? 'Local sample data' : `${item.database} · ${item.host}`}</small></span>
                            <span className="connection-choice-arrow" aria-hidden="true">›</span>
                        </button>)}
                    </div>}
                </div>}
            </div>
            <div className="topbar-spacer"/>
            <div className="experience-switch">
                <span className="mode-caption">WORKSPACE</span>
                <RadioGroup className="navbar-mode-control" value={experience} onValueChange={value => {
                    const selected = experienceOptions(copy).find(option => option.value === value);
                    if (selected) setExperience(selected.value);
                }} aria-label="Workspace mode" inline orientation="horizontal" dir="end">
                    <RadioGroup.Item value="beginner" className={`navbar-mode-option is-beginner ${experience === 'beginner' ? 'is-active' : ''}`} label={copy.app.beginner}/>
                    <RadioGroup.Item value="expert" className={`navbar-mode-option is-expert ${experience === 'expert' ? 'is-active' : ''}`} label={copy.app.expert}/>
                </RadioGroup>
            </div>
            <div className="topbar-divider topbar-divider-short"/>
            <div className="topbar-preferences">
                <SelectControl label={copy.app.language} value={locale} options={localeOptions} onChange={setLocale}/>
                <SelectControl label={copy.app.theme} value={theme} options={themeOptions} onChange={setTheme}/>
            </div>
        </header>
        {connection ? <Workspace key={connection.id} connection={connection} connectionLabel={connectionLabel(connection, session.demo)} connections={connections} onSelectConnection={selectConnection} onRefreshConnections={async () => { const latest = await api<Connected[]>('/connections'); setConnections(latest); }} trustActionRef={trustActionRef} testConnectionActionRef={testConnectionActionRef} demoMode={session.demo} experience={experience} dark={dark} copy={copy} locale={locale}/> : <div className="empty-connection"><Icon name="schema"/><h1>{copy.app.name}</h1><p>No connection profiles are configured for this workspace.</p></div>}
    </div>;
}

function Brand({ theme }: { theme: Theme }) {
    const logo = themeAppearance[theme].dark ? clickhouseLogomarkDark : clickhouseLogomarkLight;
    return <div className="brand-lockup"><img className="brand-symbol" src={logo} alt="ClickHouse"/><span className="brand-name">Click<span>Studio</span><small>CLICKHOUSE WORKSPACE</small></span></div>;
}

export default App;
