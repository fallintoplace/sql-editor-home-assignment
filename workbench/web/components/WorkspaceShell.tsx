import type { ReactNode } from 'react';

export function WorkspaceShell({
    experience,
    appName,
    documentName,
    connectionName,
    leftNav,
    rightNav,
    footer,
    children,
}: {
    experience: string;
    appName: string;
    documentName: string;
    connectionName: string;
    leftNav: ReactNode;
    rightNav: ReactNode;
    footer: ReactNode;
    children?: ReactNode;
}) {
    return <div className="workspace-shell" data-experience={experience}>
        <aside className="workspace-rail workspace-rail-left" aria-label="Workspace tools">
            <div className="workspace-rail-heading">
                <span className="eyebrow">{appName}</span>
                <strong title={documentName}>{documentName}</strong>
                <span className="workspace-rail-subtitle">{connectionName}</span>
            </div>
            <nav className="workspace-rail-nav" aria-label="Workspace tools">{leftNav}</nav>
            <div className="workspace-rail-footer">{footer}</div>
        </aside>
        {children && <div className="workspace-shell-main">{children}</div>}
        <aside className="workspace-rail workspace-rail-right" aria-label="Results and analysis">
            <div className="workspace-rail-heading">
                <span className="eyebrow">Studio</span>
                <strong>Output</strong>
                <span className="workspace-rail-subtitle">Run context</span>
            </div>
            <nav className="workspace-rail-nav" aria-label="Results and analysis">{rightNav}</nav>
        </aside>
    </div>;
}
