export const messages = {
    en: {
        app: {
            name: 'Query Studio',
            tagline: 'ClickHouse SQL, results, and performance',
            lightMode: 'Light mode',
            darkMode: 'Dark mode',
            demoMode: 'DEMO MODE — no ClickHouse queries or imports are executed. SQL text is not evaluated; this mode exercises UI and lifecycle behavior only.',
            language: 'Language'
        },
        common: {
            cancel: 'Cancel',
            confirm: 'Confirm',
            dismiss: 'Dismiss',
            retry: 'Retry',
            copy: 'Copy',
            previous: 'Previous',
            next: 'Next',
            page: 'Page',
            of: 'of'
        },
        auth: {
            opening: 'Opening Query Studio…',
            title: 'Open Query Studio',
            description: 'Use the access token configured by your server operator. Database and OpenAI credentials never belong in this form.',
            tokenLabel: 'Workspace access token',
            signIn: 'Sign in',
            signOut: 'Sign out'
        },
        shared: {
            title: 'Query Studio · shared result',
            description: 'Read-only result. This link cannot execute SQL or grant access to the source database.',
            fixture: 'DEMO SNAPSHOT — no SQL was evaluated and these rows are not live database data.',
            complete: 'Complete result',
            truncated: 'Truncated result',
            executed: 'executed',
            expires: 'expires',
            connection: 'Connection reference',
            parameters: 'Parameters',
            executedAs: 'Executed as',
            page: 'Page',
            evidenceJson: 'Result JSON',
            csv: 'CSV'
        },
        errors: {
            renderTitle: 'Query Studio could not render.',
            persistedDrafts: 'Previously saved drafts remain in this browser. Do not clear browser storage.',
            reload: 'Reload Query Studio'
        },
        connection: {
            profile: 'Connection profile',
            privateWorkspace: 'Private workspace · local drafts · server-managed credentials',
            test: 'Test connection',
            trust: 'Trust connection',
            revokeTrust: 'Revoke trust',
            commands: 'Commands Ctrl/⌘K',
            readOnly: 'read-only mode',
            testCompleted: 'Connection check completed.',
            activeQueriesCancelled: 'Active queries will be cancelled.',
            trustDescription: 'The app can inspect schema and run bounded read-only queries only when you request them.',
            reviewBeforeTrust: 'Review the host, database, and identity, then trust the connection to inspect schema or run a query.'
        },
        workspace: {
            view: 'Studio view',
            hideFiles: 'Hide files',
            showFiles: 'Show files',
            focusMode: 'Focus mode',
            exitFocusMode: 'Exit focus mode',
            sidePanelsHidden: 'Side panels are hidden, not reset.',
            title: 'Explorer',
            newTab: 'New SQL tab',
            importBackup: 'Import SQL / backup',
            searchPlaceholder: 'Search files, tables, and columns',
            savedFiles: 'Saved files',
            schema: 'Schema',
            refreshSchema: 'Refresh schema',
            statementOutline: 'Statement outline',
            exportDrafts: 'Export local drafts',
            openLocalFiles: 'Open local files',
            closeTab: 'Close tab',
            reopenTab: 'Reopen closed tab',
            advancedControls: 'Advanced execution',
            parameters: 'Query parameters'
        },
        editor: {
            runStatement: 'Run statement',
            runScript: 'Run script',
            cancelRun: 'Cancel run',
            cancelScript: 'Cancel script',
            saveRevision: 'Save revision',
            publish: 'Publish / share',
            branch: 'Create experiment branch',
            explain: 'EXPLAIN',
            pipeline: 'Pipeline',
            indent: 'Indent selection',
            exportSql: 'Export SQL',
            statementBoundary: 'Statement boundary',
            yourSql: 'Your SQL stays in control.',
            emptyHint: 'Run the sample to see a typed result, chart, query ID, and retained rows. Nothing runs automatically.'
        },
        panels: {
            assistant: 'Assistant',
            library: 'Library',
            import: 'Import',
            evidence: 'Run details',
            monitors: 'Monitors',
            tools: 'Studio tools',
            inspector: 'Inspector',
            workflow: 'Run inspector',
            close: 'Close'
        }
    },
    de: {
        app: {
            name: 'Query Studio',
            tagline: 'ClickHouse-SQL, Ergebnisse und Performance',
            lightMode: 'Heller Modus',
            darkMode: 'Dunkler Modus',
            demoMode: 'DEMO-MODUS — es werden keine ClickHouse-Abfragen oder Importe ausgeführt. SQL wird nicht ausgewertet; dieser Modus testet nur Oberfläche und Ablauf.',
            language: 'Sprache'
        },
        common: {
            cancel: 'Abbrechen',
            confirm: 'Bestätigen',
            dismiss: 'Schließen',
            retry: 'Erneut versuchen',
            copy: 'Kopieren',
            previous: 'Zurück',
            next: 'Weiter',
            page: 'Seite',
            of: 'von'
        },
        auth: {
            opening: 'Query Studio wird geöffnet…',
            title: 'Query Studio öffnen',
            description: 'Verwende den vom Serverbetreiber konfigurierten Zugriffstoken. Datenbank- und OpenAI-Zugangsdaten gehören nicht in dieses Formular.',
            tokenLabel: 'Zugriffstoken für den Workspace',
            signIn: 'Anmelden',
            signOut: 'Abmelden'
        },
        shared: {
            title: 'Query Studio · geteiltes Ergebnis',
            description: 'Schreibgeschütztes Ergebnis. Dieser Link kann kein SQL ausführen und keinen Zugriff auf die Quelldatenbank gewähren.',
            fixture: 'DEMO-SNAPSHOT — SQL wurde nicht ausgewertet. Diese Zeilen stammen nicht aus einer Live-Datenbank.',
            complete: 'Vollständiges Ergebnis',
            truncated: 'Gekürztes Ergebnis',
            executed: 'ausgeführt',
            expires: 'läuft ab',
            connection: 'Verbindungsreferenz',
            parameters: 'Parameter',
            executedAs: 'Ausgeführt als',
            page: 'Seite',
            evidenceJson: 'Ergebnis-JSON',
            csv: 'CSV'
        },
        errors: {
            renderTitle: 'Query Studio konnte nicht geladen werden.',
            persistedDrafts: 'Bereits gespeicherte Entwürfe sind weiterhin in diesem Browser vorhanden. Lösche den Browserspeicher nicht.',
            reload: 'Query Studio neu laden'
        },
        connection: {
            profile: 'Verbindungsprofil',
            privateWorkspace: 'Privater Workspace · lokale Entwürfe · serververwaltete Zugangsdaten',
            test: 'Verbindung testen',
            trust: 'Verbindung vertrauen',
            revokeTrust: 'Vertrauen widerrufen',
            commands: 'Befehle Strg/⌘K',
            readOnly: 'schreibgeschützter Modus',
            testCompleted: 'Verbindungsprüfung abgeschlossen.',
            activeQueriesCancelled: 'Aktive Abfragen werden abgebrochen.',
            trustDescription: 'Die Anwendung kann das Schema prüfen und nur auf deine Anforderung begrenzte schreibgeschützte Abfragen ausführen.',
            reviewBeforeTrust: 'Prüfe Host, Datenbank und Identität. Vertraue dann der Verbindung, um das Schema zu prüfen oder eine Abfrage auszuführen.'
        },
        workspace: {
            view: 'Studio-Ansicht',
            hideFiles: 'Dateien ausblenden',
            showFiles: 'Dateien anzeigen',
            focusMode: 'Fokusmodus',
            exitFocusMode: 'Fokusmodus verlassen',
            sidePanelsHidden: 'Seitenleisten sind ausgeblendet, nicht zurückgesetzt.',
            title: 'Explorer',
            newTab: 'Neuer SQL-Tab',
            importBackup: 'SQL / Backup importieren',
            searchPlaceholder: 'Dateien, Tabellen und Spalten suchen',
            savedFiles: 'Gespeicherte Dateien',
            schema: 'Schema',
            refreshSchema: 'Schema aktualisieren',
            statementOutline: 'Anweisungsübersicht',
            exportDrafts: 'Lokale Entwürfe exportieren',
            openLocalFiles: 'Lokale Dateien öffnen',
            closeTab: 'Tab schließen',
            reopenTab: 'Geschlossenen Tab erneut öffnen',
            advancedControls: 'Erweiterte Ausführung',
            parameters: 'Abfrageparameter'
        },
        editor: {
            runStatement: 'Anweisung ausführen',
            runScript: 'Skript ausführen',
            cancelRun: 'Ausführung abbrechen',
            cancelScript: 'Skript abbrechen',
            saveRevision: 'Revision speichern',
            publish: 'Veröffentlichen / teilen',
            branch: 'Experiment-Branch erstellen',
            explain: 'EXPLAIN',
            pipeline: 'Pipeline',
            indent: 'Auswahl einrücken',
            exportSql: 'SQL exportieren',
            statementBoundary: 'Anweisungsgrenze',
            yourSql: 'Dein SQL bleibt unter deiner Kontrolle.',
            emptyHint: 'Führe das Beispiel aus, um ein typisiertes Ergebnis, ein Diagramm, eine Query-ID und gespeicherte Zeilen zu sehen. Nichts wird automatisch ausgeführt.'
        },
        panels: {
            assistant: 'Assistent',
            library: 'Bibliothek',
            import: 'Import',
            evidence: 'Ausführungsdetails',
            monitors: 'Monitore',
            tools: 'Studio-Werkzeuge',
            inspector: 'Inspektor',
            workflow: 'Ausführungsinspektor',
            close: 'Schließen'
        }
    },
    es: {
        app: {
            name: 'Query Studio',
            tagline: 'SQL, resultados y rendimiento de ClickHouse',
            lightMode: 'Modo claro',
            darkMode: 'Modo oscuro',
            demoMode: 'MODO DEMO — no se ejecutan consultas de ClickHouse ni importaciones. El texto SQL no se evalúa; este modo solo prueba la interfaz y el ciclo de vida.',
            language: 'Idioma'
        },
        common: {
            cancel: 'Cancelar',
            confirm: 'Confirmar',
            dismiss: 'Cerrar',
            retry: 'Reintentar',
            copy: 'Copiar',
            previous: 'Anterior',
            next: 'Siguiente',
            page: 'Página',
            of: 'de'
        },
        auth: {
            opening: 'Abriendo Query Studio…',
            title: 'Abrir Query Studio',
            description: 'Usa el token de acceso configurado por el operador del servidor. Las credenciales de la base de datos y de OpenAI no deben introducirse aquí.',
            tokenLabel: 'Token de acceso al workspace',
            signIn: 'Iniciar sesión',
            signOut: 'Cerrar sesión'
        },
        shared: {
            title: 'Query Studio · resultado compartido',
            description: 'Resultado de solo lectura. Este enlace no puede ejecutar SQL ni conceder acceso a la base de datos de origen.',
            fixture: 'INSTANTÁNEA DE DEMO — no se evaluó SQL y estas filas no son datos de una base de datos activa.',
            complete: 'Resultado completo',
            truncated: 'Resultado truncado',
            executed: 'ejecutado',
            expires: 'caduca',
            connection: 'Referencia de conexión',
            parameters: 'Parámetros',
            executedAs: 'Ejecutado como',
            page: 'Página',
            evidenceJson: 'JSON del resultado',
            csv: 'CSV'
        },
        errors: {
            renderTitle: 'Query Studio no pudo cargarse.',
            persistedDrafts: 'Los borradores guardados siguen en este navegador. No borres el almacenamiento del navegador.',
            reload: 'Recargar Query Studio'
        },
        connection: {
            profile: 'Perfil de conexión',
            privateWorkspace: 'Espacio privado · borradores locales · credenciales gestionadas por el servidor',
            test: 'Probar conexión',
            trust: 'Confiar en la conexión',
            revokeTrust: 'Revocar confianza',
            commands: 'Comandos Ctrl/⌘K',
            readOnly: 'modo de solo lectura',
            testCompleted: 'Comprobación de la conexión completada.',
            activeQueriesCancelled: 'Las consultas activas se cancelarán.',
            trustDescription: 'La aplicación puede inspeccionar el esquema y ejecutar consultas limitadas de solo lectura solo cuando lo solicites.',
            reviewBeforeTrust: 'Revisa el host, la base de datos y la identidad. Después, confía en la conexión para inspeccionar el esquema o ejecutar una consulta.'
        },
        workspace: {
            view: 'Vista del estudio',
            hideFiles: 'Ocultar archivos',
            showFiles: 'Mostrar archivos',
            focusMode: 'Modo enfoque',
            exitFocusMode: 'Salir del modo enfoque',
            sidePanelsHidden: 'Los paneles laterales están ocultos, no restablecidos.',
            title: 'Explorador',
            newTab: 'Nueva pestaña SQL',
            importBackup: 'Importar SQL / copia de seguridad',
            searchPlaceholder: 'Buscar archivos, tablas y columnas',
            savedFiles: 'Archivos guardados',
            schema: 'Esquema',
            refreshSchema: 'Actualizar esquema',
            statementOutline: 'Resumen de instrucciones',
            exportDrafts: 'Exportar borradores locales',
            openLocalFiles: 'Abrir archivos locales',
            closeTab: 'Cerrar pestaña',
            reopenTab: 'Reabrir pestaña cerrada',
            advancedControls: 'Ejecución avanzada',
            parameters: 'Parámetros de consulta'
        },
        editor: {
            runStatement: 'Ejecutar instrucción',
            runScript: 'Ejecutar script',
            cancelRun: 'Cancelar ejecución',
            cancelScript: 'Cancelar script',
            saveRevision: 'Guardar revisión',
            publish: 'Publicar / compartir',
            branch: 'Crear rama de experimento',
            explain: 'EXPLAIN',
            pipeline: 'Pipeline',
            indent: 'Indentar selección',
            exportSql: 'Exportar SQL',
            statementBoundary: 'Límite de instrucción',
            yourSql: 'Tu SQL está bajo tu control.',
            emptyHint: 'Ejecuta el ejemplo para ver un resultado tipado, un gráfico, un ID de consulta y filas conservadas. Nada se ejecuta automáticamente.'
        },
        panels: {
            assistant: 'Asistente',
            library: 'Biblioteca',
            import: 'Importar',
            evidence: 'Detalles de ejecución',
            monitors: 'Monitores',
            tools: 'Herramientas del estudio',
            inspector: 'Inspector',
            workflow: 'Inspector de ejecución',
            close: 'Cerrar'
        }
    },
    nl: {
        app: {
            name: 'Query Studio',
            tagline: 'ClickHouse-SQL, resultaten en prestaties',
            lightMode: 'Lichte modus',
            darkMode: 'Donkere modus',
            demoMode: 'DEMOMODUS — er worden geen ClickHouse-query’s of imports uitgevoerd. SQL wordt niet geëvalueerd; deze modus test alleen de interface en levenscyclus.',
            language: 'Taal'
        },
        common: {
            cancel: 'Annuleren',
            confirm: 'Bevestigen',
            dismiss: 'Sluiten',
            retry: 'Opnieuw proberen',
            copy: 'Kopiëren',
            previous: 'Vorige',
            next: 'Volgende',
            page: 'Pagina',
            of: 'van'
        },
        auth: {
            opening: 'Query Studio wordt geopend…',
            title: 'Query Studio openen',
            description: 'Gebruik het toegangstoken dat door de serverbeheerder is ingesteld. Database- en OpenAI-referenties horen niet in dit formulier.',
            tokenLabel: 'Toegangstoken voor de workspace',
            signIn: 'Aanmelden',
            signOut: 'Afmelden'
        },
        shared: {
            title: 'Query Studio · gedeeld resultaat',
            description: 'Alleen-lezenresultaat. Met deze link kun je geen SQL uitvoeren en krijg je geen toegang tot de brondatabase.',
            fixture: 'DEMOSNAPSHOT — er is geen SQL uitgevoerd en deze rijen zijn geen live databasegegevens.',
            complete: 'Volledig resultaat',
            truncated: 'Afgekapt resultaat',
            executed: 'uitgevoerd',
            expires: 'vervalt',
            connection: 'Verbindingsreferentie',
            parameters: 'Parameters',
            executedAs: 'Uitgevoerd als',
            page: 'Pagina',
            evidenceJson: 'Resultaat-JSON',
            csv: 'CSV'
        },
        errors: {
            renderTitle: 'Query Studio kon niet worden geladen.',
            persistedDrafts: 'Eerder opgeslagen concepten staan nog in deze browser. Wis de browseropslag niet.',
            reload: 'Query Studio opnieuw laden'
        },
        connection: {
            profile: 'Verbindingsprofiel',
            privateWorkspace: 'Privéwerkruimte · lokale concepten · door de server beheerde referenties',
            test: 'Verbinding testen',
            trust: 'Verbinding vertrouwen',
            revokeTrust: 'Vertrouwen intrekken',
            commands: 'Opdrachten Ctrl/⌘K',
            readOnly: 'alleen-lezenmodus',
            testCompleted: 'Verbindingscontrole voltooid.',
            activeQueriesCancelled: 'Actieve query’s worden geannuleerd.',
            trustDescription: 'De applicatie kan het schema bekijken en alleen op jouw verzoek begrensde alleen-lezenquery’s uitvoeren.',
            reviewBeforeTrust: 'Controleer de host, database en identiteit. Vertrouw daarna de verbinding om het schema te bekijken of een query uit te voeren.'
        },
        workspace: {
            view: 'Studio-weergave',
            hideFiles: 'Bestanden verbergen',
            showFiles: 'Bestanden tonen',
            focusMode: 'Focusmodus',
            exitFocusMode: 'Focusmodus verlaten',
            sidePanelsHidden: 'Zijpanelen zijn verborgen, niet teruggezet.',
            title: 'Verkenner',
            newTab: 'Nieuw SQL-tabblad',
            importBackup: 'SQL / back-up importeren',
            searchPlaceholder: 'Bestanden, tabellen en kolommen zoeken',
            savedFiles: 'Opgeslagen bestanden',
            schema: 'Schema',
            refreshSchema: 'Schema vernieuwen',
            statementOutline: 'Instructieoverzicht',
            exportDrafts: 'Lokale concepten exporteren',
            openLocalFiles: 'Lokale bestanden openen',
            closeTab: 'Tabblad sluiten',
            reopenTab: 'Gesloten tabblad opnieuw openen',
            advancedControls: 'Geavanceerde uitvoering',
            parameters: 'Queryparameters'
        },
        editor: {
            runStatement: 'Instructie uitvoeren',
            runScript: 'Script uitvoeren',
            cancelRun: 'Uitvoering annuleren',
            cancelScript: 'Script annuleren',
            saveRevision: 'Revisie opslaan',
            publish: 'Publiceren / delen',
            branch: 'Experimenttak maken',
            explain: 'EXPLAIN',
            pipeline: 'Pipeline',
            indent: 'Selectie inspringen',
            exportSql: 'SQL exporteren',
            statementBoundary: 'Instructiegrens',
            yourSql: 'Jouw SQL blijft leidend.',
            emptyHint: 'Voer het voorbeeld uit om een getypeerd resultaat, grafiek, query-ID en bewaarde rijen te zien. Er wordt niets automatisch uitgevoerd.'
        },
        panels: {
            assistant: 'Assistent',
            library: 'Bibliotheek',
            import: 'Importeren',
            evidence: 'Uitvoeringsdetails',
            monitors: 'Monitors',
            tools: 'Studio-tools',
            inspector: 'Inspector',
            workflow: 'Uitvoeringsinspector',
            close: 'Sluiten'
        }
    }
} as const;

export type Locale = keyof typeof messages;
export type Copy = {
    [Section in keyof typeof messages.en]: {
        [Key in keyof typeof messages.en[Section]]: string;
    };
};

export const localeOptions: Array<{ value: Locale; label: string }> = [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
    { value: 'nl', label: 'Nederlands' }
];

export function getCopy(locale: Locale = 'en'): Copy {
    return messages[locale];
}

export const copy = getCopy();
