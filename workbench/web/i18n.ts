export const messages = {
    en: {
        app: {
            name: 'CATHEDRAL',
            tagline: 'ClickHouse evidence workspace',
            lightMode: 'Light mode',
            darkMode: 'Dark mode'
        },
        connection: {
            profile: 'Connection profile',
            privateWorkspace: 'Single-owner workspace · private drafts · server-owned credentials',
            test: 'Test connection',
            trust: 'Trust connection',
            revokeTrust: 'Revoke trust',
            commands: 'Commands Ctrl/⌘K',
            readOnly: 'read-only exploration',
            reviewBeforeTrust: 'Review the configured host, database and identity, then trust the connection to inspect schema or run a query.'
        },
        workspace: {
            view: 'Workspace view',
            hideFiles: 'Hide files',
            showFiles: 'Show files',
            focusMode: 'Focus mode',
            exitFocusMode: 'Exit focus mode',
            sidePanelsHidden: 'Side panels are hidden, not reset.',
            title: 'Workspace',
            newTab: 'New SQL tab',
            importBackup: 'Import SQL / backup',
            searchPlaceholder: 'Find files, tables, columns',
            savedFiles: 'Saved files',
            schema: 'Schema',
            refreshSchema: 'Refresh schema',
            statementOutline: 'Statement outline',
            exportDrafts: 'Export local drafts',
            openLocalFiles: 'Open local files',
            closeTab: 'Close tab',
            reopenTab: 'Reopen closed tab',
            advancedControls: 'Advanced run controls',
            parameters: 'Bound query parameters'
        },
        editor: {
            runStatement: 'Run statement',
            runScript: 'Run script',
            cancelRun: 'Cancel run',
            cancelScript: 'Cancel script',
            saveRevision: 'Save revision',
            publish: 'Publish / share',
            branch: 'Branch experiment',
            explain: 'EXPLAIN',
            pipeline: 'Pipeline',
            indent: 'Indent selection',
            exportSql: 'Export SQL',
            statementBoundary: 'Statement boundary',
            yourSql: 'Your SQL stays in charge.',
            emptyHint: 'Run the example to see a typed table, chart, query ID, and retained evidence. Nothing runs automatically.'
        },
        panels: {
            assistant: 'assistant',
            library: 'library',
            import: 'import',
            evidence: 'evidence',
            monitors: 'monitors',
            tools: 'Workspace tools',
            inspector: 'Inspector',
            workflow: 'Inspectable workflow',
            close: 'Close'
        }
    }
} as const;

export type Locale = keyof typeof messages;
export type Copy = typeof messages.en;

export function getCopy(locale: Locale = 'en'): Copy {
    return messages[locale];
}

export const copy = getCopy();
