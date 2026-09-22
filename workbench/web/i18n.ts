export const messages = {
    en: {
        app: {
            name: 'CATHEDRAL',
            tagline: 'ClickHouse evidence workspace',
            lightMode: 'Light mode',
            darkMode: 'Dark mode',
            nextLanguage: 'Deutsch'
        },
        connection: {
            profile: 'Connection profile',
            privateWorkspace: 'Single-owner workspace · private drafts · server-owned credentials',
            test: 'Test connection',
            trust: 'Trust connection',
            revokeTrust: 'Revoke trust',
            commands: 'Commands Ctrl/⌘K',
            readOnly: 'read-only exploration',
            testCompleted: 'Connection capability check completed.',
            activeQueriesCancelled: 'Active queries will be cancelled.',
            trustDescription: 'The application may inspect schema and execute bounded read-only queries only when you request them.',
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
    },
    de: {
        app: {
            name: 'CATHEDRAL',
            tagline: 'ClickHouse-Evidenz-Workspace',
            lightMode: 'Heller Modus',
            darkMode: 'Dunkler Modus',
            nextLanguage: 'English'
        },
        connection: {
            profile: 'Verbindungsprofil',
            privateWorkspace: 'Workspace mit einem Eigentümer · private Entwürfe · serverseitig verwaltete Zugangsdaten',
            test: 'Verbindung testen',
            trust: 'Verbindung vertrauen',
            revokeTrust: 'Vertrauen widerrufen',
            commands: 'Befehle Strg/⌘K',
            readOnly: 'schreibgeschützte Exploration',
            testCompleted: 'Die Prüfung der Verbindungskapazitäten ist abgeschlossen.',
            activeQueriesCancelled: 'Aktive Abfragen werden abgebrochen.',
            trustDescription: 'Die Anwendung darf das Schema prüfen und nur auf deine ausdrückliche Anforderung begrenzte schreibgeschützte Abfragen ausführen.',
            reviewBeforeTrust: 'Prüfe Host, Datenbank und Identität. Vertraue dann der Verbindung, um das Schema zu prüfen oder eine Abfrage auszuführen.'
        },
        workspace: {
            view: 'Workspace-Ansicht',
            hideFiles: 'Dateien ausblenden',
            showFiles: 'Dateien anzeigen',
            focusMode: 'Fokusmodus',
            exitFocusMode: 'Fokusmodus verlassen',
            sidePanelsHidden: 'Seitenleisten sind ausgeblendet, nicht zurückgesetzt.',
            title: 'Workspace',
            newTab: 'Neuer SQL-Tab',
            importBackup: 'SQL / Backup importieren',
            searchPlaceholder: 'Dateien, Tabellen, Spalten suchen',
            savedFiles: 'Gespeicherte Dateien',
            schema: 'Schema',
            refreshSchema: 'Schema aktualisieren',
            statementOutline: 'Anweisungsübersicht',
            exportDrafts: 'Lokale Entwürfe exportieren',
            openLocalFiles: 'Lokale Dateien öffnen',
            closeTab: 'Tab schließen',
            reopenTab: 'Geschlossenen Tab erneut öffnen',
            advancedControls: 'Erweiterte Ausführungseinstellungen',
            parameters: 'Gebundene Abfrageparameter'
        },
        editor: {
            runStatement: 'Anweisung ausführen',
            runScript: 'Skript ausführen',
            cancelRun: 'Ausführung abbrechen',
            cancelScript: 'Skript abbrechen',
            saveRevision: 'Revision speichern',
            publish: 'Veröffentlichen / teilen',
            branch: 'Experiment-Branch',
            explain: 'EXPLAIN',
            pipeline: 'Pipeline',
            indent: 'Auswahl einrücken',
            exportSql: 'SQL exportieren',
            statementBoundary: 'Anweisungsgrenze',
            yourSql: 'Dein SQL bleibt maßgeblich.',
            emptyHint: 'Führe das Beispiel aus, um eine typisierte Tabelle, ein Diagramm, eine Query-ID und gespeicherte Evidenz zu sehen. Nichts wird automatisch ausgeführt.'
        },
        panels: {
            assistant: 'Assistent',
            library: 'Bibliothek',
            import: 'Import',
            evidence: 'Evidenz',
            monitors: 'Monitore',
            tools: 'Workspace-Werkzeuge',
            inspector: 'Inspektor',
            workflow: 'Prüfbarer Workflow',
            close: 'Schließen'
        }
    }
} as const;

export type Locale = keyof typeof messages;
export type Copy = {
    [Section in keyof typeof messages.en]: {
        [Key in keyof typeof messages.en[Section]]: string;
    };
};

export function getCopy(locale: Locale = 'en'): Copy {
    return messages[locale];
}

export const copy = getCopy();
