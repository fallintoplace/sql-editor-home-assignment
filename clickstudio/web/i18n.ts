import type { SelectOption } from './workspace-types.js';

export type Locale = 'en' | 'de' | 'es' | 'nl' | 'zh' | 'ru';
export type Theme = 'click-dark' | 'click-light';
export type ExperienceLevel = 'beginner' | 'expert';

export const themeAppearance: Record<Theme, { dark: boolean; chromeColor: string }> = {
    'click-dark': { dark: true, chromeColor: '#101010' },
    'click-light': { dark: false, chromeColor: '#f5f6f1' },
};

export interface Copy {
    app: {
        name: string;
        tagline: string;
        language: string;
        theme: string;
        beginner: string;
        expert: string;
    };
    auth: {
        title: string;
        description: string;
        token: string;
        open: string;
        opening: string;
    };
    common: {
        run: string;
        runStatement: string;
        cancel: string;
        save: string;
        saveRevision: string;
        schema: string;
        history: string;
        assistant: string;
        results: string;
        chart: string;
        insights: string;
        newSql: string;
        restore: string;
        closedSqlTabs: string;
        startBlankSql: string;
        help: string;
        examples: string;
        sqlExamples: string;
        examplesHint: string;
        closeExamples: string;
        exampleCategories: string;
        allExamples: string;
        exampleBasics: string;
        exampleAggregation: string;
        exampleTimeSeries: string;
        exampleClickHouse: string;
        exampleCharts: string;
        exampleSchema: string;
        exampleChartTable: string;
        exampleChartNumber: string;
        exampleChartLine: string;
        exampleChartBar: string;
        exampleChartScatter: string;
        exampleChartHeatmap: string;
        exampleChartCandlestick: string;
        examplePreviewTable: string;
        exampleReadRows: string;
        workspaceMode: string;
        parserMode: string;
        browse: string;
        readOnly: string;
        tables: string;
        queries: string;
        more: string;
        localDraft: string;
        query: string;
        format: string;
        parserUnavailable: string;
        retryParser: string;
        sqlMap: string;
        visualizeSqlStructure: string;
        runScript: string;
        runActionTrustRequired: string;
        runActionWait: string;
        runActionRemoveParameters: string;
        playgroundScriptUnavailable: string;
        explain: string;
        explainPipeline: string;
        askAi: string;
        running: string;
        selectQuery: string;
        selectCurrentSqlStatement: string;
        jumpToSqlStatement: string;
        clickhouseSnippet: string;
        clickhouseSnippets: string;
        snippetSelectHelp: string;
        addQuery: string;
        addSnippetAsNewQuery: string;
        incompleteSql: string;
        noSqlStatements: string;
        oneStatement: string;
        manyStatements: string;
        queryVisualization: string;
        workspaceOutput: string;
        sqlStructure: string;
        queryResults: string;
        expand: string;
        collapse: string;
        expandQuery: string;
        collapseQuery: string;
        expandOutput: string;
        collapseOutput: string;
        sqlFlowTitle: string;
        sqlFlowDescription: string;
        sqlFlowClickStage: string;
        sqlFlowParserStarting: string;
        sqlFlowParserUnavailable: string;
        sqlFlowCodeMirror: string;
        sqlFlowEmpty: string;
        sqlFlowAstDetail: string;
        sqlFlowSqlDetail: string;
        sqlFlowNativeHeading: string;
        sqlFlowFallbackHeading: string;
        sqlFlowGraphHint: string;
        sqlFlowReturnResult: string;
        sqlFlowOutputColumns: string;
        sqlFlowSelectedStage: string;
        sqlFlowInspectStage: string;
        sqlFlowStageDetails: string;
        sqlFlowStages: string;
        sqlFlowOperators: string;
        sqlFlowConnections: string;
        sqlFlowInputs: string;
        sqlFlowOutputs: string;
        sqlFlowReadKind: string;
        sqlFlowOutputKind: string;
        sqlFlowEstimatedStatus: string;
        sqlFlowSourceDetail: string;
        sqlFlowNoStages: string;
        statusReady: string;
        statusQueued: string;
        statusRunning: string;
        statusSucceeded: string;
        statusTruncated: string;
        statusFailed: string;
        statusCancelled: string;
        statusTimedOut: string;
        statusInterrupted: string;
        statusComplete: string;
        statusLiveUpdates: string;
        statusReconnecting: string;
        rowsRead: string;
        bytesRead: string;
        memory: string;
        import: string;
        export: string;
        refresh: string;
        workspaceInspector: string;
        workspaceBrowser: string;
        workspacePanels: string;
        schemaSearch: string;
        tableCount: string;
        loading: string;
        schemaPrivate: string;
        trustToInspect: string;
        readingSchema: string;
        noTablesMatch: string;
        insertTableName: string;
        rowsEstimated: string;
        parts: string;
        projections: string;
        skipIndexes: string;
        metadataUnavailable: string;
        systemTable: string;
        clickhouseSql: string;
        runActions: string;
        formatSql: string;
        previousStatement: string;
        nextStatement: string;
        sqlFlowNativeAst: string;
        sqlFlowKeywordEstimate: string;
        sqlFlowTruncatedWarning: string;
        sqlFlowFilterKind: string;
        sqlFlowAggregateKind: string;
        sqlFlowSortKind: string;
        sqlFlowJoinKind: string;
        sqlFlowTransformKind: string;
        sqlFlowStageKind: string;
        sqlFlowResizeKind: string;
        characters: string;
        lines: string;
        builtInFormatter: string;
        searchExamples: string;
        noExamplesFound: string;
        openExample: string;
        openInNewSql: string;
    };
    chart: {
        preparing: string;
        noColumns: string;
        fallbackNoMeasure: string;
        visualExploration: string;
        queryResult: string;
        rowsOverTime: string;
        rowsOverTimeBy: string;
        rowsBy: string;
        timeCountDescription: string;
        categoryCountDescription: string;
        xAxis: string;
        yAxis: string;
        xMeasure: string;
        breakdownBy: string;
        allRows: string;
        rowsLabel: string;
        noDimensions: string;
        noRetainedRows: string;
        noValidTimeValues: string;
        minutes: string;
        hours: string;
        days: string;
        weeks: string;
        months: string;
        timeSummary: string;
        categorySummary: string;
        invalidDatesSkipped: string;
        retainedPrefixOnly: string;
        completeQueryResult: string;
        timePointTooltip: string;
        categoryBarTooltip: string;
        reasonSingleNumber: string;
        reasonTimeMeasure: string;
        reasonDimensionMeasure: string;
        heatmapReturnedRows: string;
        sampledForDisplay: string;
        xAxisMeasure: string;
        measures: string;
        measure: string;
        type: string;
        numberType: string;
        lineType: string;
        barType: string;
        scatterType: string;
        heatmapType: string;
        candlestickType: string;
        priceLabel: string;
        openLabel: string;
        highLabel: string;
        lowLabel: string;
        closeLabel: string;
        bidAskLabel: string;
        quoteActivity: string;
        quoteActivityUnavailable: string;
        spreadBps: string;
        spreadUnavailable: string;
        returnedData: string;
        midpointCandles: string;
        candlestickDisplayNote: string;
        candlesLabel: string;
        candlestickSummary: string;
        noValidCandles: string;
        chartRange: string;
        oneDayRange: string;
        threeDayRange: string;
        allRange: string;
        brushRangeHint: string;
        numberNeedsOneRow: string;
        chooseNumericColumn: string;
        singleValue: string;
        exactResultValue: string;
        tooManyHeatmapLabels: string;
        heatmapNeedsDimensions: string;
        heatmapTableAria: string;
        heatmapNotRetained: string;
        heatmapNoReturnedRow: string;
        heatmapNullMeasure: string;
        heatmapCaption: string;
        heatmapTruncatedNote: string;
        heatmapCompleteNote: string;
        scatterNeedsTwoNumeric: string;
        useLineOrBar: string;
        chooseNumericMeasure: string;
        chartComparing: string;
        oneValue: string;
        retainedRows: string;
        populatedCells: string;
        rowsSuffix: string;
        plottedPoints: string;
        sampledRowsSummary: string;
        retainedRowsAcrossOneMeasure: string;
        retainedRowsAcrossManyMeasures: string;
    };
}

const english: Copy = {
    app: {
        name: 'ClickStudio',
        tagline: 'ClickHouse SQL, results, and performance',
        language: 'Language',
        theme: 'Theme',
        beginner: 'Compact',
        expert: 'Advanced',
    },
    auth: {
        title: 'Open your workspace',
        description: 'A focused ClickHouse SQL studio. Credentials stay on the server.',
        token: 'Workspace access token',
        open: 'Open workspace',
        opening: 'Opening workspace…',
    },
    common: {
        run: 'Run',
        runStatement: 'Run statement',
        cancel: 'Cancel',
        save: 'Save',
        saveRevision: 'Save revision',
        schema: 'Schema',
        history: 'Runs',
        assistant: 'AI',
        results: 'Results',
        chart: 'Chart',
        insights: 'Insights',
        newSql: 'New SQL',
        restore: 'Restore',
        closedSqlTabs: 'Recently closed SQL tabs',
        startBlankSql: 'Blank SQL',
        help: 'Help',
        examples: 'Examples',
        sqlExamples: 'SQL examples',
        examplesHint: 'Preview an example or start with blank SQL. Nothing runs automatically.',
        closeExamples: 'Close SQL examples',
        exampleCategories: 'Example categories',
        allExamples: 'All',
        exampleBasics: 'Basics',
        exampleAggregation: 'Aggregations',
        exampleTimeSeries: 'Time series',
        exampleClickHouse: 'ClickHouse',
        exampleCharts: 'Charts',
        exampleSchema: 'Your tables',
        exampleChartTable: 'Table',
        exampleChartNumber: 'Number',
        exampleChartLine: 'Line chart',
        exampleChartBar: 'Bar chart',
        exampleChartScatter: 'Scatter chart',
        exampleChartHeatmap: 'Heatmap',
        exampleChartCandlestick: 'Candlestick chart',
        examplePreviewTable: 'Preview {table}',
        exampleReadRows: 'Read up to 50 rows from this table.',
        workspaceMode: 'WORKSPACE',
        parserMode: 'PARSER',
        browse: 'BROWSE',
        readOnly: 'Read only',
        tables: 'Tables',
        queries: 'Queries',
        more: 'More',
        localDraft: 'Local draft',
        query: 'QUERY',
        format: 'Format',
        parserUnavailable: 'Parser unavailable',
        retryParser: 'Retry parser',
        sqlMap: 'SQL map',
        visualizeSqlStructure: 'Visualize SQL structure',
        runScript: 'Run script', runActionTrustRequired: 'Trust this connection before running SQL.', runActionWait: 'Wait for the current operation to finish.', runActionRemoveParameters: 'Remove query parameters before running this action.', playgroundScriptUnavailable: 'The public Playground accepts one read-only statement per request. Run script is unavailable here.',
        explain: 'EXPLAIN',
        explainPipeline: 'EXPLAIN PIPELINE',
        askAi: 'Ask AI',
        running: 'Running…',
        selectQuery: 'Select query',
        selectCurrentSqlStatement: 'Select current SQL statement',
        jumpToSqlStatement: 'Jump to SQL statement',
        clickhouseSnippet: 'ClickHouse snippet',
        clickhouseSnippets: 'ClickHouse snippets…',
        snippetSelectHelp: 'Choose a template, then add it as a new query. Existing SQL is preserved.',
        addQuery: 'Add query',
        addSnippetAsNewQuery: 'Add snippet as a new query',
        incompleteSql: 'Incomplete SQL',
        noSqlStatements: 'No SQL statements',
        oneStatement: '{count} statement',
        manyStatements: '{count} statements',
        queryVisualization: 'QUERY VISUALIZATION',
        workspaceOutput: 'WORKSPACE OUTPUT',
        sqlStructure: 'SQL structure',
        queryResults: 'Query results',
        expand: 'Expand',
        collapse: 'Collapse',
        expandQuery: 'Expand SQL query',
        collapseQuery: 'Collapse SQL query',
        expandOutput: 'Expand output',
        collapseOutput: 'Collapse output',
        sqlFlowTitle: 'How this query is composed',
        sqlFlowDescription: 'This is a logical map, not a server execution plan.',
        sqlFlowClickStage: 'Click a stage to jump to its SQL.',
        sqlFlowParserStarting: 'Parser starting',
        sqlFlowParserUnavailable: 'Parser unavailable',
        sqlFlowCodeMirror: 'CodeMirror mode',
        sqlFlowEmpty: 'Write a SELECT query to build its structure map.',
        sqlFlowAstDetail: 'AST detail: ',
        sqlFlowSqlDetail: 'SQL detail: ',
        sqlFlowNativeHeading: 'CLICKHOUSE SQL FLOW',
        sqlFlowFallbackHeading: 'SQL FLOW · BEST EFFORT',
        sqlFlowGraphHint: 'Click a node to inspect its clause and jump to it in the editor',
        sqlFlowReturnResult: 'Return result',
        sqlFlowOutputColumns: 'Columns produced by the SELECT list',
        sqlFlowSelectedStage: 'Selected stage',
        sqlFlowInspectStage: 'Inspect stage',
        sqlFlowStageDetails: 'Selected stage details',
        sqlFlowStages: 'stages',
        sqlFlowOperators: 'operators',
        sqlFlowConnections: 'connections',
        sqlFlowInputs: 'Inputs',
        sqlFlowOutputs: 'Outputs',
        sqlFlowReadKind: 'Read',
        sqlFlowOutputKind: 'Output',
        sqlFlowEstimatedStatus: 'estimated',
        sqlFlowSourceDetail: 'Table source',
        sqlFlowNoStages: 'No SQL stages were found in this statement.',
        statusReady: 'Ready',
        statusQueued: 'Queued',
        statusRunning: 'Running',
        statusSucceeded: 'Succeeded',
        statusTruncated: 'Truncated',
        statusFailed: 'Failed',
        statusCancelled: 'Cancelled',
        statusTimedOut: 'Timed out',
        statusInterrupted: 'Interrupted',
        statusComplete: 'Complete',
        statusLiveUpdates: 'Live updates',
        statusReconnecting: 'Reconnecting',
        rowsRead: 'rows read',
        bytesRead: 'read',
        memory: 'memory',
        import: 'Import',
        export: 'Export',
        refresh: 'Refresh',
        workspaceInspector: 'WORKSPACE INSPECTOR',
        workspaceBrowser: 'Workspace browser',
        workspacePanels: 'More workspace panels',
        schemaSearch: 'Search tables, columns, and dictionaries…',
        tableCount: '{count} TABLES',
        loading: 'Loading…',
        schemaPrivate: 'Schema is private',
        trustToInspect: 'Trust the connection to inspect tables and columns.',
        readingSchema: 'Reading ClickHouse schema…',
        noTablesMatch: 'No tables or dictionaries match this search.',
        insertTableName: 'Insert table name',
        rowsEstimated: 'rows est.',
        parts: 'parts',
        projections: 'projections',
        skipIndexes: 'skip indexes',
        metadataUnavailable: 'ClickHouse metadata unavailable',
        systemTable: 'ClickHouse system table',
        clickhouseSql: 'ClickHouse SQL',
        runActions: 'Run actions',
        formatSql: 'Format SQL',
        previousStatement: 'Previous SQL statement',
        nextStatement: 'Next SQL statement',
        sqlFlowNativeAst: 'Native AST',
        sqlFlowKeywordEstimate: 'Keyword estimate',
        sqlFlowTruncatedWarning: 'This query is large. The graph shows a bounded set of SQL stages.',
        sqlFlowFilterKind: 'Filter',
        sqlFlowAggregateKind: 'Aggregate',
        sqlFlowSortKind: 'Sort',
        sqlFlowJoinKind: 'Join',
        sqlFlowTransformKind: 'Transform',
        sqlFlowStageKind: 'Stage',
        sqlFlowResizeKind: 'Resize',
        characters: 'characters',
        lines: 'lines',
        builtInFormatter: 'Built-in',
        searchExamples: 'Search examples',
        noExamplesFound: 'No examples match your search.',
        openExample: 'Open',
        openInNewSql: 'Open in new SQL',
    },
    chart: {
        preparing: 'Preparing a chart from retained rows…',
        noColumns: 'This result has no columns to chart.',
        fallbackNoMeasure: 'This result has no numeric measure to chart, so the typed table is shown.',
        visualExploration: 'VISUAL EXPLORATION',
        queryResult: 'Query result',
        rowsOverTime: 'Rows over time',
        rowsOverTimeBy: 'Rows over time by {dimension}',
        rowsBy: 'Rows by {dimension}',
        timeCountDescription: 'Rows are counted in time buckets ({unit}) from the retained result. No aggregate query is sent.',
        categoryCountDescription: 'Rows are counted by {dimension} from the retained result. No aggregate query is sent.',
        xAxis: 'X axis',
        yAxis: 'Y axis',
        xMeasure: 'X measure',
        breakdownBy: 'Break down by',
        allRows: 'All rows',
        rowsLabel: 'Rows',
        noDimensions: 'This result has no dimensions to group.',
        noRetainedRows: 'This result has no retained rows to chart.',
        noValidTimeValues: 'No retained rows contain a valid value for this time column.',
        minutes: 'minutes',
        hours: 'hours',
        days: 'days',
        weeks: 'weeks',
        months: 'months',
        timeSummary: '{buckets} time buckets ({unit}) from {rows} returned rows',
        categorySummary: '{categories} categories from {rows} returned rows',
        invalidDatesSkipped: '{count} invalid dates skipped',
        retainedPrefixOnly: 'retained prefix only',
        completeQueryResult: 'complete query result',
        timePointTooltip: '{bucket} · {series}: {count} rows',
        categoryBarTooltip: '{category}: {count} rows',
        reasonSingleNumber: 'One row with a numeric measure.',
        reasonTimeMeasure: 'A date/time dimension with numeric measures.',
        reasonDimensionMeasure: 'A dimension with numeric measures; no hidden aggregation is performed.',
        heatmapReturnedRows: 'Cells come from returned rows; missing groups are left blank.',
        sampledForDisplay: 'Long results are evenly sampled for display.',
        xAxisMeasure: 'X measure',
        measures: 'Measures',
        measure: 'Measure',
        type: 'Type',
        numberType: 'Number',
        lineType: 'Line',
        barType: 'Bar',
        scatterType: 'Scatter',
        heatmapType: 'Heatmap',
        candlestickType: 'Candlestick',
        priceLabel: 'Price',
        openLabel: 'Open',
        highLabel: 'High',
        lowLabel: 'Low',
        closeLabel: 'Close',
        bidAskLabel: 'Bid / ask',
        quoteActivity: 'Quote updates',
        quoteActivityUnavailable: 'No quote-activity column is mapped.',
        spreadBps: 'Average spread (bps)',
        spreadUnavailable: 'No spread column is mapped.',
        returnedData: 'Returned data',
        midpointCandles: 'OHLC candles',
        candlestickDisplayNote: 'Large results are combined into wider OHLC display candles. The query is not rerun.',
        candlesLabel: 'candles',
        candlestickSummary: '{candles} displayed candles from {rows} retained rows',
        noValidCandles: 'No valid candles. Check that the time and OHLC columns contain valid values.',
        chartRange: 'Visible time range',
        oneDayRange: '1 day',
        threeDayRange: '3 days',
        allRange: 'All',
        brushRangeHint: 'Drag the handles below to zoom the time range. Only returned rows are shown; the query is not rerun.',
        numberNeedsOneRow: 'Number view needs one retained row. Choose Line or Bar for multiple rows.',
        chooseNumericColumn: 'Choose a numeric result column to show one value.',
        singleValue: 'SINGLE VALUE',
        exactResultValue: '1 retained row · exact result value',
        tooManyHeatmapLabels: 'This result has too many row and column labels for a readable heatmap. Group it into a smaller grid first.',
        heatmapNeedsDimensions: 'Heatmap needs two dimensions and one numeric measure.',
        heatmapTableAria: '{measure} by {groupBy} and {xAxis}',
        heatmapNotRetained: 'not retained',
        heatmapNoReturnedRow: 'no returned row',
        heatmapNullMeasure: 'null measure',
        heatmapCaption: '{measure} · {rows} rows × {columns} columns · {note}',
        heatmapTruncatedNote: 'blank cells may be outside the retained result',
        heatmapCompleteNote: 'blank cells had no returned group',
        scatterNeedsTwoNumeric: 'Scatter needs two numeric columns. Choose another result or use Line or Bar.',
        useLineOrBar: 'Choose another result or use Line or Bar.',
        chooseNumericMeasure: 'Choose a numeric measure to plot.',
        chartComparing: '{type} chart comparing {x} and {y}',
        oneValue: '1 value',
        retainedRows: '{rows} retained rows',
        populatedCells: '{cells} populated cells from {rows} rows',
        rowsSuffix: 'rows',
        plottedPoints: '{points} plotted points',
        sampledRowsSummary: '{sampled} sampled rows from {rows} retained rows',
        retainedRowsAcrossOneMeasure: '{rows} retained rows across 1 measure',
        retainedRowsAcrossManyMeasures: '{rows} retained rows across {measures} measures',
    },
};

type LocalizedCopy = Partial<Copy['app'] & Copy['common'] & Copy['auth']> & Copy['chart'];
const translations: Record<Exclude<Locale, 'en'>, LocalizedCopy> = {
    de: {
        language: 'Sprache', theme: 'Thema', beginner: 'Kompakt', expert: 'Erweitert', run: 'Ausführen', runStatement: 'Abfrage ausführen', cancel: 'Abbrechen', save: 'Speichern', saveRevision: 'Revision speichern', schema: 'Schema', history: 'Läufe', assistant: 'KI', results: 'Ergebnisse', chart: 'Diagramm', insights: 'Einblicke', newSql: 'Neue SQL-Abfrage', restore: 'Wiederherstellen', closedSqlTabs: 'Zuletzt geschlossene SQL-Tabs', startBlankSql: 'Leere SQL-Abfrage', help: 'Hilfe', examples: 'Beispiele', sqlExamples: 'SQL-Beispiele', examplesHint: 'Beispielvorschau ansehen oder mit leerem SQL starten. Es wird nichts automatisch ausgeführt.', closeExamples: 'SQL-Beispiele schließen', exampleCategories: 'Beispielkategorien', allExamples: 'Alle', exampleBasics: 'Grundlagen', exampleAggregation: 'Aggregationen', exampleTimeSeries: 'Zeitreihen', exampleClickHouse: 'ClickHouse', exampleSchema: 'Ihre Tabellen', searchExamples: 'Beispiele suchen', noExamplesFound: 'Keine passenden Beispiele gefunden.', openInNewSql: 'In neuem SQL öffnen', open: 'Arbeitsbereich öffnen', opening: 'Arbeitsbereich wird geöffnet…',
        preparing: 'Diagramm aus gespeicherten Zeilen wird erstellt…', noColumns: 'Dieses Ergebnis enthält keine Diagrammspalten.', fallbackNoMeasure: 'Dieses Ergebnis enthält keine numerische Kennzahl. Daher wird die typisierte Tabelle angezeigt.', visualExploration: 'VISUALISIERUNG', queryResult: 'Abfrageergebnis', rowsOverTime: 'Zeilen im Zeitverlauf', rowsOverTimeBy: 'Zeilen im Zeitverlauf nach {dimension}', rowsBy: 'Zeilen nach {dimension}', timeCountDescription: 'Zeilen aus dem gespeicherten Ergebnis werden in {unit} zusammengefasst. Es wird keine Aggregatabfrage gesendet.', categoryCountDescription: 'Zeilen aus dem gespeicherten Ergebnis werden nach {dimension} gezählt. Es wird keine Aggregatabfrage gesendet.', xAxis: 'X-Achse', yAxis: 'Y-Achse', xMeasure: 'X-Kennzahl', breakdownBy: 'Aufschlüsseln nach', allRows: 'Alle Zeilen', rowsLabel: 'Zeilen', noDimensions: 'Dieses Ergebnis hat keine Dimensionen zum Gruppieren.', noRetainedRows: 'Dieses Ergebnis enthält keine gespeicherten Zeilen zum Darstellen.', noValidTimeValues: 'Keine gespeicherten Zeilen enthalten einen gültigen Wert für diese Zeitspalte.', minutes: 'Minuten', hours: 'Stunden', days: 'Tagen', weeks: 'Wochen', months: 'Monaten', timeSummary: '{buckets} Zeitabschnitte ({unit}) aus {rows} zurückgegebenen Zeilen', categorySummary: '{categories} Kategorien aus {rows} zurückgegebenen Zeilen', invalidDatesSkipped: '{count} ungültige Datumswerte übersprungen', retainedPrefixOnly: 'nur gespeicherter Anfang des Ergebnisses', completeQueryResult: 'vollständiges Abfrageergebnis', timePointTooltip: '{bucket} · {series}: {count} Zeilen', categoryBarTooltip: '{category}: {count} Zeilen', reasonSingleNumber: 'Eine Zeile mit einer numerischen Kennzahl.', reasonTimeMeasure: 'Eine Datums-/Zeitdimension mit numerischen Kennzahlen.', reasonDimensionMeasure: 'Eine Dimension mit numerischen Kennzahlen; es wird nichts stillschweigend aggregiert.', heatmapReturnedRows: 'Zellen stammen aus zurückgegebenen Zeilen; fehlende Gruppen bleiben leer.', sampledForDisplay: 'Lange Ergebnisse werden für die Anzeige gleichmäßig abgetastet.', xAxisMeasure: 'X-Kennzahl', measures: 'Kennzahlen', measure: 'Kennzahl', type: 'Typ', numberType: 'Zahl', lineType: 'Linie', barType: 'Balken', scatterType: 'Streudiagramm', heatmapType: 'Heatmap', candlestickType: 'Candlestick', priceLabel: 'Preis', openLabel: 'Eröffnung', highLabel: 'Hoch', lowLabel: 'Tief', closeLabel: 'Schluss', bidAskLabel: 'Bid / Ask', quoteActivity: 'Kursaktualisierungen', quoteActivityUnavailable: 'Keine Quote-Aktivitätsspalte zugeordnet.', spreadBps: 'Durchschnittlicher Spread (Bp)', spreadUnavailable: 'Keine Spread-Spalte zugeordnet.', returnedData: 'Zurückgegebene Daten', midpointCandles: 'OHLC-Kerzen', candlestickDisplayNote: 'Große Ergebnisse werden zu breiteren OHLC-Anzeigekerzen zusammengefasst. Die Abfrage wird nicht erneut ausgeführt.', candlesLabel: 'Kerzen', candlestickSummary: '{candles} angezeigte Kerzen aus {rows} gespeicherten Zeilen', noValidCandles: 'Keine gültigen Kerzen. Prüfe die Zeit- und OHLC-Spalten.', chartRange: 'Sichtbarer Zeitraum', oneDayRange: '1 Tag', threeDayRange: '3 Tage', allRange: 'Alle', brushRangeHint: 'Ziehe die Griffe unten, um den Zeitraum zu vergrößern. Es werden nur zurückgegebene Zeilen angezeigt; die Abfrage wird nicht erneut ausgeführt.', numberNeedsOneRow: 'Die Zahlenansicht benötigt eine gespeicherte Zeile. Für mehrere Zeilen Linie oder Balken wählen.', chooseNumericColumn: 'Wähle eine numerische Ergebnisspalte für einen Einzelwert.', singleValue: 'EINZELWERT', exactResultValue: '1 gespeicherte Zeile · exakter Ergebniswert', tooManyHeatmapLabels: 'Dieses Ergebnis hat zu viele Zeilen- und Spaltenbeschriftungen für eine lesbare Heatmap. Gruppiere es zuerst zu einem kleineren Raster.', heatmapNeedsDimensions: 'Eine Heatmap benötigt zwei Dimensionen und eine numerische Kennzahl.', heatmapTableAria: '{measure} nach {groupBy} und {xAxis}', heatmapNotRetained: 'nicht gespeichert', heatmapNoReturnedRow: 'keine zurückgegebene Zeile', heatmapNullMeasure: 'Kennzahl ist NULL', heatmapCaption: '{measure} · {rows} Zeilen × {columns} Spalten · {note}', heatmapTruncatedNote: 'leere Zellen können außerhalb des gespeicherten Ergebnisses liegen', heatmapCompleteNote: 'leere Zellen hatten keine zurückgegebene Gruppe', scatterNeedsTwoNumeric: 'Ein Streudiagramm benötigt zwei numerische Spalten. Wähle ein anderes Ergebnis oder Linie/Balken.', useLineOrBar: 'Wähle ein anderes Ergebnis oder Linie/Balken.', chooseNumericMeasure: 'Wähle eine numerische Kennzahl zum Darstellen.', chartComparing: 'Diagramm „{type}“: {x} und {y}', oneValue: '1 Wert', retainedRows: '{rows} gespeicherte Zeilen', populatedCells: '{cells} belegte Zellen aus {rows} Zeilen', rowsSuffix: 'Zeilen', plottedPoints: '{points} dargestellte Punkte', sampledRowsSummary: '{sampled} abgetastete Zeilen aus {rows} gespeicherten Zeilen', retainedRowsAcrossOneMeasure: '{rows} gespeicherte Zeilen mit 1 Kennzahl', retainedRowsAcrossManyMeasures: '{rows} gespeicherte Zeilen mit {measures} Kennzahlen',
    },
    es: {
        language: 'Idioma', theme: 'Tema', beginner: 'Compacto', expert: 'Avanzado', run: 'Ejecutar', runStatement: 'Ejecutar consulta', cancel: 'Cancelar', save: 'Guardar', saveRevision: 'Guardar revisión', schema: 'Esquema', history: 'Historial', assistant: 'IA', results: 'Resultados', chart: 'Gráfico', insights: 'Insights', newSql: 'Nuevo SQL', restore: 'Restaurar', closedSqlTabs: 'Pestañas SQL cerradas recientemente', startBlankSql: 'SQL en blanco', help: 'Ayuda', examples: 'Ejemplos', sqlExamples: 'Ejemplos SQL', examplesHint: 'Previsualiza un ejemplo o empieza con SQL en blanco. Nada se ejecuta automáticamente.', closeExamples: 'Cerrar ejemplos SQL', exampleCategories: 'Categorías de ejemplos', allExamples: 'Todos', exampleBasics: 'Conceptos básicos', exampleAggregation: 'Agregaciones', exampleTimeSeries: 'Series temporales', exampleClickHouse: 'ClickHouse', exampleSchema: 'Tus tablas', searchExamples: 'Buscar ejemplos', noExamplesFound: 'No hay ejemplos que coincidan.', openInNewSql: 'Abrir en un SQL nuevo', open: 'Abrir espacio', opening: 'Abriendo espacio…',
        preparing: 'Preparando un gráfico con las filas conservadas…', noColumns: 'Este resultado no tiene columnas para representar.', fallbackNoMeasure: 'Este resultado no tiene una medida numérica; se muestra la tabla con sus tipos.', visualExploration: 'VISUALIZACIÓN', queryResult: 'Resultado de la consulta', rowsOverTime: 'Filas a lo largo del tiempo', rowsOverTimeBy: 'Filas a lo largo del tiempo por {dimension}', rowsBy: 'Filas por {dimension}', timeCountDescription: 'Las filas se cuentan en intervalos de {unit} a partir del resultado conservado. No se envía ninguna consulta de agregación.', categoryCountDescription: 'Las filas se cuentan por {dimension} a partir del resultado conservado. No se envía ninguna consulta de agregación.', xAxis: 'Eje X', yAxis: 'Eje Y', xMeasure: 'Medida X', breakdownBy: 'Desglosar por', allRows: 'Todas las filas', rowsLabel: 'Filas', noDimensions: 'Este resultado no tiene dimensiones para agrupar.', noRetainedRows: 'Este resultado no tiene filas conservadas para representar.', noValidTimeValues: 'Ninguna fila conservada tiene un valor válido para esta columna temporal.', minutes: 'minutos', hours: 'horas', days: 'días', weeks: 'semanas', months: 'meses', timeSummary: '{buckets} intervalos de {unit} de {rows} filas devueltas', categorySummary: '{categories} categorías de {rows} filas devueltas', invalidDatesSkipped: 'Se omitieron {count} fechas no válidas', retainedPrefixOnly: 'solo el prefijo conservado', completeQueryResult: 'resultado completo de la consulta', timePointTooltip: '{bucket} · {series}: {count} filas', categoryBarTooltip: '{category}: {count} filas', reasonSingleNumber: 'Una fila con una medida numérica.', reasonTimeMeasure: 'Una dimensión de fecha/hora con medidas numéricas.', reasonDimensionMeasure: 'Una dimensión con medidas numéricas; no se realiza ninguna agregación oculta.', heatmapReturnedRows: 'Las celdas usan las filas devueltas; los grupos ausentes quedan en blanco.', sampledForDisplay: 'Los resultados largos se muestrean uniformemente para mostrarlos.', xAxisMeasure: 'Medida X', measures: 'Medidas', measure: 'Medida', type: 'Tipo', numberType: 'Número', lineType: 'Línea', barType: 'Barras', scatterType: 'Dispersión', heatmapType: 'Mapa de calor', candlestickType: 'Velas', priceLabel: 'Precio', openLabel: 'Apertura', highLabel: 'Máximo', lowLabel: 'Mínimo', closeLabel: 'Cierre', bidAskLabel: 'Bid / ask', quoteActivity: 'Actualizaciones de cotización', quoteActivityUnavailable: 'No hay ninguna columna de actividad de cotizaciones asignada.', spreadBps: 'Spread medio (pb)', spreadUnavailable: 'No hay ninguna columna de spread asignada.', returnedData: 'Datos devueltos', midpointCandles: 'Velas OHLC', candlestickDisplayNote: 'Los resultados grandes se agrupan en velas OHLC de visualización más amplias. No se vuelve a ejecutar la consulta.', candlesLabel: 'velas', candlestickSummary: '{candles} velas mostradas de {rows} filas conservadas', noValidCandles: 'No hay velas válidas. Comprueba las columnas de tiempo y OHLC.', chartRange: 'Intervalo visible', oneDayRange: '1 día', threeDayRange: '3 días', allRange: 'Todo', brushRangeHint: 'Arrastra los controles inferiores para ampliar el intervalo. Solo se muestran las filas devueltas; la consulta no se vuelve a ejecutar.', numberNeedsOneRow: 'La vista numérica necesita una fila conservada. Elige Línea o Barras para varias filas.', chooseNumericColumn: 'Elige una columna numérica del resultado para mostrar un valor.', singleValue: 'VALOR ÚNICO', exactResultValue: '1 fila conservada · valor exacto del resultado', tooManyHeatmapLabels: 'Este resultado tiene demasiadas etiquetas de filas y columnas para un mapa de calor legible. Agrúpalo primero en una cuadrícula más pequeña.', heatmapNeedsDimensions: 'El mapa de calor necesita dos dimensiones y una medida numérica.', heatmapTableAria: '{measure} por {groupBy} y {xAxis}', heatmapNotRetained: 'no conservado', heatmapNoReturnedRow: 'ninguna fila devuelta', heatmapNullMeasure: 'medida nula', heatmapCaption: '{measure} · {rows} filas × {columns} columnas · {note}', heatmapTruncatedNote: 'puede haber celdas fuera del resultado conservado', heatmapCompleteNote: 'las celdas vacías no tuvieron un grupo devuelto', scatterNeedsTwoNumeric: 'El gráfico de dispersión necesita dos columnas numéricas. Elige otro resultado o usa Línea o Barras.', useLineOrBar: 'Elige otro resultado o usa Línea o Barras.', chooseNumericMeasure: 'Elige una medida numérica para representar.', chartComparing: 'Gráfico de {type}: {x} y {y}', oneValue: '1 valor', retainedRows: '{rows} filas conservadas', populatedCells: '{cells} celdas con datos de {rows} filas', rowsSuffix: 'filas', plottedPoints: '{points} puntos representados', sampledRowsSummary: '{sampled} filas muestreadas de {rows} conservadas', retainedRowsAcrossOneMeasure: '{rows} filas conservadas en 1 medida', retainedRowsAcrossManyMeasures: '{rows} filas conservadas en {measures} medidas',
    },
    nl: {
        language: 'Taal', theme: 'Thema', beginner: 'Compact', expert: 'Geavanceerd', run: 'Uitvoeren', runStatement: 'Query uitvoeren', cancel: 'Annuleren', save: 'Opslaan', saveRevision: 'Revisie opslaan', schema: 'Schema', history: 'Runs', assistant: 'AI', results: 'Resultaten', chart: 'Grafiek', insights: 'Inzichten', newSql: 'Nieuwe SQL', restore: 'Herstellen', closedSqlTabs: 'Recent gesloten SQL-tabbladen', startBlankSql: 'Lege SQL', help: 'Help', examples: 'Voorbeelden', sqlExamples: 'SQL-voorbeelden', examplesHint: 'Bekijk een voorbeeld of begin met lege SQL. Er wordt niets automatisch uitgevoerd.', closeExamples: 'SQL-voorbeelden sluiten', exampleCategories: 'Voorbeeldcategorieën', allExamples: 'Alle', exampleBasics: 'Basis', exampleAggregation: 'Aggregaties', exampleTimeSeries: 'Tijdreeksen', exampleClickHouse: 'ClickHouse', exampleSchema: 'Jouw tabellen', searchExamples: 'Voorbeelden zoeken', noExamplesFound: 'Geen voorbeelden gevonden.', openInNewSql: 'Openen in nieuwe SQL', open: 'Werkruimte openen', opening: 'Werkruimte openen…',
        preparing: 'Grafiek van bewaarde rijen voorbereiden…', noColumns: 'Dit resultaat heeft geen kolommen voor een grafiek.', fallbackNoMeasure: 'Dit resultaat heeft geen numerieke meetwaarde. Daarom wordt de getypeerde tabel getoond.', visualExploration: 'VISUALISATIE', queryResult: 'Queryresultaat', rowsOverTime: 'Rijen in de tijd', rowsOverTimeBy: 'Rijen in de tijd per {dimension}', rowsBy: 'Rijen per {dimension}', timeCountDescription: 'Rijen uit het bewaarde resultaat worden geteld in intervallen van {unit}. Er wordt geen aggregatiequery verstuurd.', categoryCountDescription: 'Rijen uit het bewaarde resultaat worden geteld per {dimension}. Er wordt geen aggregatiequery verstuurd.', xAxis: 'X-as', yAxis: 'Y-as', xMeasure: 'X-waarde', breakdownBy: 'Uitsplitsen op', allRows: 'Alle rijen', rowsLabel: 'Rijen', noDimensions: 'Dit resultaat heeft geen dimensies om te groeperen.', noRetainedRows: 'Dit resultaat heeft geen bewaarde rijen voor een grafiek.', noValidTimeValues: 'Geen bewaarde rijen bevatten een geldige waarde voor deze tijdkolom.', minutes: 'minuten', hours: 'uur', days: 'dagen', weeks: 'weken', months: 'maanden', timeSummary: '{buckets} tijdvakken ({unit}) uit {rows} geretourneerde rijen', categorySummary: '{categories} categorieën uit {rows} geretourneerde rijen', invalidDatesSkipped: '{count} ongeldige datums overgeslagen', retainedPrefixOnly: 'alleen bewaard begin van resultaat', completeQueryResult: 'volledig queryresultaat', timePointTooltip: '{bucket} · {series}: {count} rijen', categoryBarTooltip: '{category}: {count} rijen', reasonSingleNumber: 'Eén rij met een numerieke meetwaarde.', reasonTimeMeasure: 'Een datum-/tijddimensie met numerieke meetwaarden.', reasonDimensionMeasure: 'Een dimensie met numerieke meetwaarden; er wordt niet ongemerkt geaggregeerd.', heatmapReturnedRows: 'Cellen zijn gebaseerd op geretourneerde rijen; ontbrekende groepen blijven leeg.', sampledForDisplay: 'Lange resultaten worden gelijkmatig bemonsterd voor weergave.', xAxisMeasure: 'X-waarde', measures: 'Meetwaarden', measure: 'Meetwaarde', type: 'Type', numberType: 'Getal', lineType: 'Lijn', barType: 'Staaf', scatterType: 'Spreiding', heatmapType: 'Heatmap', candlestickType: 'Candlestickgrafiek', priceLabel: 'Prijs', openLabel: 'Opening', highLabel: 'Hoog', lowLabel: 'Laag', closeLabel: 'Slot', bidAskLabel: 'Bied / laat', quoteActivity: 'Quote-updates', quoteActivityUnavailable: 'Er is geen kolom voor quote-activiteit gekoppeld.', spreadBps: 'Gemiddelde spread (bps)', spreadUnavailable: 'Er is geen spreadkolom gekoppeld.', returnedData: 'Geretourneerde gegevens', midpointCandles: 'OHLC-candles', candlestickDisplayNote: 'Grote resultaten worden samengevoegd tot bredere OHLC-candles voor weergave. De query wordt niet opnieuw uitgevoerd.', candlesLabel: 'candles', candlestickSummary: '{candles} getoonde candles uit {rows} bewaarde rijen', noValidCandles: 'Geen geldige candles. Controleer de tijd- en OHLC-kolommen.', chartRange: 'Zichtbaar tijdsbereik', oneDayRange: '1 dag', threeDayRange: '3 dagen', allRange: 'Alles', brushRangeHint: 'Sleep de grepen hieronder om het tijdsbereik te zoomen. Alleen geretourneerde rijen worden getoond; de query wordt niet opnieuw uitgevoerd.', numberNeedsOneRow: 'De getalweergave heeft één bewaarde rij nodig. Kies Lijn of Staaf voor meerdere rijen.', chooseNumericColumn: 'Kies een numerieke resultaatkolom om één waarde te tonen.', singleValue: 'ENKELE WAARDE', exactResultValue: '1 bewaarde rij · exacte resultaatwaarde', tooManyHeatmapLabels: 'Dit resultaat heeft te veel rij- en kolomlabels voor een leesbare heatmap. Groepeer het eerst in een kleiner raster.', heatmapNeedsDimensions: 'Een heatmap heeft twee dimensies en één numerieke meetwaarde nodig.', heatmapTableAria: '{measure} per {groupBy} en {xAxis}', heatmapNotRetained: 'niet bewaard', heatmapNoReturnedRow: 'geen geretourneerde rij', heatmapNullMeasure: 'meetwaarde is NULL', heatmapCaption: '{measure} · {rows} rijen × {columns} kolommen · {note}', heatmapTruncatedNote: 'lege cellen kunnen buiten het bewaarde resultaat vallen', heatmapCompleteNote: 'lege cellen hadden geen geretourneerde groep', scatterNeedsTwoNumeric: 'Een spreidingsdiagram heeft twee numerieke kolommen nodig. Kies een ander resultaat of gebruik Lijn of Staaf.', useLineOrBar: 'Kies een ander resultaat of gebruik Lijn of Staaf.', chooseNumericMeasure: 'Kies een numerieke meetwaarde om te tekenen.', chartComparing: '{type}-grafiek: {x} vergeleken met {y}', oneValue: '1 waarde', retainedRows: '{rows} bewaarde rijen', populatedCells: '{cells} gevulde cellen uit {rows} rijen', rowsSuffix: 'rijen', plottedPoints: '{points} getekende punten', sampledRowsSummary: '{sampled} bemonsterde rijen uit {rows} bewaarde rijen', retainedRowsAcrossOneMeasure: '{rows} bewaarde rijen over 1 meetwaarde', retainedRowsAcrossManyMeasures: '{rows} bewaarde rijen over {measures} meetwaarden',
    },
    zh: {
        language: '语言', theme: '主题', beginner: '紧凑', expert: '高级', run: '运行', runStatement: '运行查询', cancel: '取消', save: '保存', saveRevision: '保存修订', schema: '架构', history: '运行记录', assistant: 'AI', results: '结果', chart: '图表', insights: '洞察', newSql: '新建 SQL', restore: '恢复', closedSqlTabs: '最近关闭的 SQL 标签页', startBlankSql: '新建空白 SQL', help: '帮助', examples: '示例', sqlExamples: 'SQL 示例', examplesHint: '预览示例，或从空白 SQL 开始。不会自动执行查询。', closeExamples: '关闭 SQL 示例', exampleCategories: '示例类别', allExamples: '全部', exampleBasics: '基础', exampleAggregation: '聚合', exampleTimeSeries: '时间序列', exampleClickHouse: 'ClickHouse', exampleSchema: '你的表', searchExamples: '搜索示例', noExamplesFound: '没有匹配的示例。', openInNewSql: '在新 SQL 中打开', open: '打开工作区', opening: '正在打开工作区…',
        preparing: '正在根据保留的行生成图表…', noColumns: '此结果没有可用于图表的列。', fallbackNoMeasure: '此结果没有数值指标，因此显示带类型的表格。', visualExploration: '可视化分析', queryResult: '查询结果', rowsOverTime: '行数趋势', rowsOverTimeBy: '按 {dimension} 查看行数趋势', rowsBy: '按 {dimension} 统计行数', timeCountDescription: '根据保留的结果按{unit}统计行数，不会发送聚合查询。', categoryCountDescription: '根据保留的结果按 {dimension} 统计行数，不会发送聚合查询。', xAxis: 'X 轴', yAxis: 'Y 轴', xMeasure: 'X 轴指标', breakdownBy: '细分方式', allRows: '全部行', rowsLabel: '行数', noDimensions: '此结果没有可分组的维度。', noRetainedRows: '此结果没有可用于图表的保留行。', noValidTimeValues: '保留的行中没有包含此时间列的有效值。', minutes: '分钟', hours: '小时', days: '天', weeks: '周', months: '月', timeSummary: '{rows} 条返回行中的 {buckets} 个{unit}时间段', categorySummary: '{rows} 条返回行中的 {categories} 个类别', invalidDatesSkipped: '已跳过 {count} 个无效日期', retainedPrefixOnly: '仅显示保留的结果前缀', completeQueryResult: '完整查询结果', timePointTooltip: '{bucket} · {series}：{count} 行', categoryBarTooltip: '{category}：{count} 行', reasonSingleNumber: '一行数值指标。', reasonTimeMeasure: '日期/时间维度和数值指标。', reasonDimensionMeasure: '维度和数值指标；不会进行隐藏聚合。', heatmapReturnedRows: '单元格来自返回行；缺失的分组留空。', sampledForDisplay: '长结果会均匀抽样后显示。', xAxisMeasure: 'X 轴指标', measures: '指标', measure: '指标', type: '类型', numberType: '数值', lineType: '折线图', barType: '柱状图', scatterType: '散点图', heatmapType: '热力图', candlestickType: '蜡烛图', priceLabel: '价格', openLabel: '开盘', highLabel: '最高', lowLabel: '最低', closeLabel: '收盘', bidAskLabel: '买价 / 卖价', quoteActivity: '报价更新数', quoteActivityUnavailable: '尚未映射报价活动列。', spreadBps: '平均价差（基点）', spreadUnavailable: '尚未映射价差列。', returnedData: '返回数据', midpointCandles: 'OHLC 蜡烛图', candlestickDisplayNote: '较大的结果会合并为更宽的 OHLC 显示蜡烛，不会重新运行查询。', candlesLabel: '根蜡烛', candlestickSummary: '显示 {candles} 根蜡烛，来自 {rows} 条保留行', noValidCandles: '没有有效蜡烛图数据。请检查时间和 OHLC 列。', chartRange: '可见时间范围', oneDayRange: '1 天', threeDayRange: '3 天', allRange: '全部', brushRangeHint: '拖动下方手柄缩放时间范围。这里只显示已返回的行，不会重新运行查询。', numberNeedsOneRow: '数值视图需要一条保留行。多行结果请选择折线图或柱状图。', chooseNumericColumn: '选择数值结果列以显示一个值。', singleValue: '单值', exactResultValue: '1 条保留行 · 精确结果值', tooManyHeatmapLabels: '行列标签过多，无法清晰显示热力图。请先将结果分组成更小的网格。', heatmapNeedsDimensions: '热力图需要两个维度和一个数值指标。', heatmapTableAria: '{measure}与{groupBy}和{xAxis}的关系', heatmapNotRetained: '未保留', heatmapNoReturnedRow: '没有返回行', heatmapNullMeasure: '指标为空', heatmapCaption: '{measure} · {rows} 行 × {columns} 列 · {note}', heatmapTruncatedNote: '空白单元格可能位于保留结果范围之外', heatmapCompleteNote: '空白单元格没有对应的返回分组', scatterNeedsTwoNumeric: '散点图需要两个数值列。请选择其他结果，或使用折线图/柱状图。', useLineOrBar: '请选择其他结果，或使用折线图/柱状图。', chooseNumericMeasure: '选择数值指标进行绘图。', chartComparing: '{type}：比较 {x} 和 {y}', oneValue: '1 个值', retainedRows: '{rows} 条保留行', populatedCells: '{rows} 行中的 {cells} 个非空单元格', rowsSuffix: '行', plottedPoints: '{points} 个绘制点', sampledRowsSummary: '从 {rows} 条保留行中抽取 {sampled} 行', retainedRowsAcrossOneMeasure: '{rows} 条保留行，1 个指标', retainedRowsAcrossManyMeasures: '{rows} 条保留行，{measures} 个指标',
    },
    ru: {
        language: 'Язык', theme: 'Тема', beginner: 'Компактный', expert: 'Расширенный', run: 'Запустить', runStatement: 'Выполнить запрос', cancel: 'Отмена', save: 'Сохранить', saveRevision: 'Сохранить ревизию', schema: 'Схема', history: 'Запуски', assistant: 'ИИ', results: 'Результаты', chart: 'График', insights: 'Инсайты', newSql: 'Новый SQL', restore: 'Восстановить', closedSqlTabs: 'Недавно закрытые вкладки SQL', startBlankSql: 'Пустой SQL', help: 'Справка', examples: 'Примеры', sqlExamples: 'Примеры SQL', examplesHint: 'Просмотрите пример или начните с пустого SQL. Запросы не выполняются автоматически.', closeExamples: 'Закрыть примеры SQL', exampleCategories: 'Категории примеров', allExamples: 'Все', exampleBasics: 'Основы', exampleAggregation: 'Агрегации', exampleTimeSeries: 'Временные ряды', exampleClickHouse: 'ClickHouse', exampleSchema: 'Ваши таблицы', searchExamples: 'Поиск примеров', noExamplesFound: 'Подходящих примеров нет.', openInNewSql: 'Открыть в новом SQL', open: 'Открыть рабочую область', opening: 'Открытие рабочей области…',
        preparing: 'Строим график по сохранённым строкам…', noColumns: 'В результате нет столбцов для построения графика.', fallbackNoMeasure: 'В результате нет числовой метрики, поэтому показана таблица с типами данных.', visualExploration: 'ВИЗУАЛИЗАЦИЯ', queryResult: 'Результат запроса', rowsOverTime: 'Количество строк во времени', rowsOverTimeBy: 'Количество строк во времени по полю «{dimension}»', rowsBy: 'Количество строк по полю «{dimension}»', timeCountDescription: 'Строки группируются по {unit} из сохранённого результата. Запрос агрегации не отправляется.', categoryCountDescription: 'Строки группируются по полю «{dimension}» из сохранённого результата. Запрос агрегации не отправляется.', xAxis: 'Ось X', yAxis: 'Ось Y', xMeasure: 'Мера по оси X', breakdownBy: 'Разбивка по', allRows: 'Все строки', rowsLabel: 'Строки', noDimensions: 'В результате нет измерений для группировки.', noRetainedRows: 'В результате нет сохранённых строк для графика.', noValidTimeValues: 'В сохранённых строках нет допустимых значений для этого столбца времени.', minutes: 'минутам', hours: 'часам', days: 'дням', weeks: 'неделям', months: 'месяцам', timeSummary: '{buckets} интервалов ({unit}) по {rows} возвращённым строкам', categorySummary: '{categories} категорий по {rows} возвращённым строкам', invalidDatesSkipped: 'Пропущено неверных дат: {count}', retainedPrefixOnly: 'показана только сохранённая часть результата', completeQueryResult: 'полный результат запроса', timePointTooltip: '{bucket} · {series}: строк — {count}', categoryBarTooltip: '{category}: строк — {count}', reasonSingleNumber: 'Одна строка с числовой метрикой.', reasonTimeMeasure: 'Измерение даты/времени с числовыми метриками.', reasonDimensionMeasure: 'Измерение с числовыми метриками; скрытая агрегация не выполняется.', heatmapReturnedRows: 'Ячейки построены по возвращённым строкам; отсутствующие группы оставлены пустыми.', sampledForDisplay: 'Для длинного результата точки равномерно отбираются для отображения.', xAxisMeasure: 'Мера по оси X', measures: 'Метрики', measure: 'Метрика', type: 'Тип', numberType: 'Число', lineType: 'Линия', barType: 'Столбцы', scatterType: 'Диаграмма рассеяния', heatmapType: 'Тепловая карта', candlestickType: 'Свечной график', priceLabel: 'Цена', openLabel: 'Открытие', highLabel: 'Максимум', lowLabel: 'Минимум', closeLabel: 'Закрытие', bidAskLabel: 'Bid / ask', quoteActivity: 'Обновления котировок', quoteActivityUnavailable: 'Столбец активности котировок не сопоставлен.', spreadBps: 'Средний спред (б. п.)', spreadUnavailable: 'Столбец спреда не сопоставлен.', returnedData: 'Полученные данные', midpointCandles: 'Свечи OHLC', candlestickDisplayNote: 'Большие результаты объединяются в более широкие свечи OHLC. Запрос повторно не выполняется.', candlesLabel: 'свечей', candlestickSummary: 'Показано свечей: {candles} из {rows} сохранённых строк', noValidCandles: 'Нет корректных свечей. Проверьте столбцы времени и OHLC.', chartRange: 'Видимый период', oneDayRange: '1 день', threeDayRange: '3 дня', allRange: 'Весь период', brushRangeHint: 'Перетащите маркеры ниже, чтобы изменить период. Показаны только полученные строки; запрос не выполняется повторно.', numberNeedsOneRow: 'Для числового вида нужна одна сохранённая строка. Для нескольких строк выберите линию или столбцы.', chooseNumericColumn: 'Выберите числовой столбец результата для отображения одного значения.', singleValue: 'ОДНО ЗНАЧЕНИЕ', exactResultValue: '1 сохранённая строка · точное значение результата', tooManyHeatmapLabels: 'В результате слишком много подписей строк и столбцов для читаемой тепловой карты. Сначала сгруппируйте данные в меньшую сетку.', heatmapNeedsDimensions: 'Для тепловой карты нужны два измерения и одна числовая метрика.', heatmapTableAria: '{measure} по полю {groupBy} и {xAxis}', heatmapNotRetained: 'не сохранено', heatmapNoReturnedRow: 'нет возвращённой строки', heatmapNullMeasure: 'метрика NULL', heatmapCaption: '{measure} · строк: {rows} × столбцов: {columns} · {note}', heatmapTruncatedNote: 'пустые ячейки могут быть за пределами сохранённого результата', heatmapCompleteNote: 'для пустых ячеек не было возвращённых групп', scatterNeedsTwoNumeric: 'Для диаграммы рассеяния нужны два числовых столбца. Выберите другой результат или линию/столбцы.', useLineOrBar: 'Выберите другой результат или линию/столбцы.', chooseNumericMeasure: 'Выберите числовую метрику для графика.', chartComparing: 'График «{type}»: сравнение {x} и {y}', oneValue: '1 значение', retainedRows: 'Сохранённых строк: {rows}', populatedCells: 'Заполненных ячеек: {cells} из {rows} строк', rowsSuffix: 'строк', plottedPoints: 'Точек на графике: {points}', sampledRowsSummary: 'Выбрано {sampled} строк из {rows} сохранённых', retainedRowsAcrossOneMeasure: 'Сохранённых строк: {rows} · метрика: 1', retainedRowsAcrossManyMeasures: 'Сохранённых строк: {rows} · метрик: {measures}',
    },
};

const exampleCommonTranslations: Record<Exclude<Locale, 'en'>, Pick<Copy['common'],
    'exampleCharts' | 'exampleChartTable' | 'exampleChartNumber' | 'exampleChartLine' | 'exampleChartBar' | 'exampleChartScatter' | 'exampleChartHeatmap' | 'exampleChartCandlestick' | 'examplePreviewTable' | 'exampleReadRows' | 'openExample'>> = {
    de: {
        exampleCharts: 'Diagramme', exampleChartTable: 'Tabelle', exampleChartNumber: 'Zahl', exampleChartLine: 'Liniendiagramm',
        exampleChartBar: 'Balkendiagramm', exampleChartScatter: 'Streudiagramm', exampleChartHeatmap: 'Heatmap', exampleChartCandlestick: 'Candlestick-Diagramm',
        examplePreviewTable: 'Vorschau: {table}', exampleReadRows: 'Bis zu 50 Zeilen aus dieser Tabelle lesen.', openExample: 'Öffnen',
    },
    es: {
        exampleCharts: 'Gráficos', exampleChartTable: 'Tabla', exampleChartNumber: 'Número', exampleChartLine: 'Gráfico de líneas',
        exampleChartBar: 'Gráfico de barras', exampleChartScatter: 'Gráfico de dispersión', exampleChartHeatmap: 'Mapa de calor', exampleChartCandlestick: 'Gráfico de velas',
        examplePreviewTable: 'Vista previa: {table}', exampleReadRows: 'Leer hasta 50 filas de esta tabla.', openExample: 'Abrir',
    },
    nl: {
        exampleCharts: 'Grafieken', exampleChartTable: 'Tabel', exampleChartNumber: 'Getal', exampleChartLine: 'Lijndiagram',
        exampleChartBar: 'Staafdiagram', exampleChartScatter: 'Spreidingsdiagram', exampleChartHeatmap: 'Heatmap', exampleChartCandlestick: 'Candlestickgrafiek',
        examplePreviewTable: 'Voorbeeld van {table}', exampleReadRows: 'Lees maximaal 50 rijen uit deze tabel.', openExample: 'Openen',
    },
    zh: {
        exampleCharts: '图表', exampleChartTable: '表格', exampleChartNumber: '数值', exampleChartLine: '折线图',
        exampleChartBar: '柱状图', exampleChartScatter: '散点图', exampleChartHeatmap: '热力图', exampleChartCandlestick: '蜡烛图',
        examplePreviewTable: '预览：{table}', exampleReadRows: '读取此表最多 50 行。', openExample: '打开',
    },
    ru: {
        exampleCharts: 'Графики', exampleChartTable: 'Таблица', exampleChartNumber: 'Число', exampleChartLine: 'Линейный график',
        exampleChartBar: 'Столбчатая диаграмма', exampleChartScatter: 'Диаграмма рассеяния', exampleChartHeatmap: 'Тепловая карта', exampleChartCandlestick: 'Свечной график',
        examplePreviewTable: 'Просмотр: {table}', exampleReadRows: 'Прочитать до 50 строк из этой таблицы.', openExample: 'Открыть',
    },
};

type WorkspaceCommonTranslation = Pick<Copy['common'],
    'workspaceMode' | 'parserMode' | 'browse' | 'readOnly' | 'tables' | 'queries' | 'more' | 'localDraft' | 'query' | 'format' |
    'parserUnavailable' | 'retryParser' | 'sqlMap' | 'visualizeSqlStructure' | 'runScript' | 'runActionTrustRequired' | 'runActionWait' |
    'runActionRemoveParameters' | 'playgroundScriptUnavailable' | 'askAi' | 'running' | 'selectQuery' |
    'selectCurrentSqlStatement' | 'jumpToSqlStatement' | 'clickhouseSnippet' | 'clickhouseSnippets' | 'snippetSelectHelp' | 'addQuery' |
    'addSnippetAsNewQuery' | 'incompleteSql' | 'noSqlStatements' | 'oneStatement' | 'manyStatements' | 'queryVisualization' |
    'workspaceOutput' | 'sqlStructure' | 'queryResults' | 'expand' | 'collapse' | 'expandQuery' | 'collapseQuery' | 'expandOutput' |
    'collapseOutput' | 'sqlFlowTitle' | 'sqlFlowDescription' | 'sqlFlowClickStage' | 'sqlFlowParserStarting' | 'sqlFlowParserUnavailable' |
    'sqlFlowCodeMirror' | 'sqlFlowEmpty' | 'sqlFlowAstDetail' | 'sqlFlowSqlDetail' | 'sqlFlowNativeHeading' | 'sqlFlowFallbackHeading' |
    'sqlFlowGraphHint' | 'sqlFlowReturnResult' | 'sqlFlowOutputColumns' | 'sqlFlowSelectedStage' | 'sqlFlowInspectStage' |
    'sqlFlowStageDetails' | 'sqlFlowStages' | 'sqlFlowOperators' | 'sqlFlowConnections' | 'sqlFlowInputs' | 'sqlFlowOutputs' |
    'sqlFlowReadKind' | 'sqlFlowOutputKind' | 'sqlFlowEstimatedStatus' | 'sqlFlowSourceDetail' | 'sqlFlowNoStages' | 'statusReady' |
    'statusQueued' | 'statusRunning' | 'statusSucceeded' | 'statusTruncated' | 'statusFailed' | 'statusCancelled' | 'statusTimedOut' |
    'statusInterrupted' | 'statusComplete' | 'statusLiveUpdates' | 'statusReconnecting' | 'rowsRead' | 'bytesRead' | 'memory' |
    'import' | 'export' | 'refresh' | 'workspaceInspector' | 'workspaceBrowser' | 'workspacePanels' | 'schemaSearch' | 'tableCount' |
    'loading' | 'schemaPrivate' | 'trustToInspect' | 'readingSchema' | 'noTablesMatch' | 'insertTableName' | 'rowsEstimated' | 'parts' |
    'projections' | 'skipIndexes' | 'metadataUnavailable' | 'systemTable' | 'clickhouseSql' | 'runActions' | 'formatSql' |
    'previousStatement' | 'nextStatement' | 'sqlFlowNativeAst' | 'sqlFlowKeywordEstimate' | 'sqlFlowTruncatedWarning' | 'characters' | 'lines' | 'builtInFormatter' |
    'sqlFlowFilterKind' | 'sqlFlowAggregateKind' | 'sqlFlowSortKind' | 'sqlFlowJoinKind' | 'sqlFlowTransformKind' | 'sqlFlowStageKind' | 'sqlFlowResizeKind'>;

const workspaceCommonTranslations: Record<Exclude<Locale, 'en'>, WorkspaceCommonTranslation> = {
    de: {
        workspaceMode: 'ARBEITSBEREICH', parserMode: 'PARSER', browse: 'DURCHSUCHEN', readOnly: 'Schreibgeschützt', tables: 'Tabellen', queries: 'Abfragen', more: 'Mehr', localDraft: 'Lokaler Entwurf', query: 'ABFRAGE', format: 'Formatieren', parserUnavailable: 'Parser nicht verfügbar', retryParser: 'Parser erneut versuchen', sqlMap: 'SQL-Struktur', visualizeSqlStructure: 'SQL-Struktur visualisieren', runScript: 'Skript ausführen', runActionTrustRequired: 'Vertrauen Sie dieser Verbindung, bevor Sie SQL ausführen.', runActionWait: 'Warten Sie, bis der aktuelle Vorgang abgeschlossen ist.', runActionRemoveParameters: 'Entfernen Sie Abfrageparameter, bevor Sie diese Aktion ausführen.', playgroundScriptUnavailable: 'Playground akzeptiert pro Anfrage nur ein schreibgeschütztes Statement. Skriptausführung ist hier nicht verfügbar.', askAi: 'KI fragen', running: 'Wird ausgeführt…', selectQuery: 'Abfrage auswählen', selectCurrentSqlStatement: 'Aktuelles SQL-Statement auswählen', jumpToSqlStatement: 'Zu SQL-Statement springen', clickhouseSnippet: 'ClickHouse-Vorlage', clickhouseSnippets: 'ClickHouse-Vorlagen…', snippetSelectHelp: 'Vorlage auswählen und als neue Abfrage hinzufügen. Vorhandenes SQL bleibt erhalten.', addQuery: 'Abfrage hinzufügen', addSnippetAsNewQuery: 'Vorlage als neue Abfrage hinzufügen', incompleteSql: 'Unvollständiges SQL', noSqlStatements: 'Keine SQL-Statements', oneStatement: '{count} Statement', manyStatements: '{count} Statements', queryVisualization: 'ABFRAGEVISUALISIERUNG', workspaceOutput: 'ARBEITSBEREICH-AUSGABE', sqlStructure: 'SQL-Struktur', queryResults: 'Abfrageergebnisse', expand: 'Erweitern', collapse: 'Einklappen', expandQuery: 'SQL-Abfrage erweitern', collapseQuery: 'SQL-Abfrage einklappen', expandOutput: 'Ausgabe erweitern', collapseOutput: 'Ausgabe einklappen', sqlFlowTitle: 'Aufbau dieser Abfrage', sqlFlowDescription: 'Dies ist eine logische Übersicht, kein serverseitiger Ausführungsplan.', sqlFlowClickStage: 'Auf eine Phase klicken, um zum SQL zu springen.', sqlFlowParserStarting: 'Parser wird gestartet', sqlFlowParserUnavailable: 'Parser nicht verfügbar', sqlFlowCodeMirror: 'CodeMirror-Modus', sqlFlowEmpty: 'Schreibe eine SELECT-Abfrage, um ihre Struktur anzuzeigen.', sqlFlowAstDetail: 'AST-Details: ', sqlFlowSqlDetail: 'SQL-Details: ', sqlFlowNativeHeading: 'CLICKHOUSE-SQL-ABLAUF', sqlFlowFallbackHeading: 'SQL-ABLAUF · BESTMÖGLICH', sqlFlowGraphHint: 'Klicke auf einen Knoten, um die Klausel zu prüfen und im Editor aufzurufen', sqlFlowReturnResult: 'Ergebnis zurückgeben', sqlFlowOutputColumns: 'Spalten der SELECT-Liste', sqlFlowSelectedStage: 'Ausgewählte Phase', sqlFlowInspectStage: 'Phase ansehen', sqlFlowStageDetails: 'Details der ausgewählten Phase', sqlFlowStages: 'Phasen', sqlFlowOperators: 'Operatoren', sqlFlowConnections: 'Verbindungen', sqlFlowInputs: 'Eingaben', sqlFlowOutputs: 'Ausgaben', sqlFlowReadKind: 'Lesen', sqlFlowOutputKind: 'Ausgabe', sqlFlowEstimatedStatus: 'geschätzt', sqlFlowSourceDetail: 'Tabellenquelle', sqlFlowNoStages: 'In diesem Statement wurden keine SQL-Phasen gefunden.', statusReady: 'Bereit', statusQueued: 'In Warteschlange', statusRunning: 'Wird ausgeführt', statusSucceeded: 'Erfolgreich', statusTruncated: 'Abgeschnitten', statusFailed: 'Fehlgeschlagen', statusCancelled: 'Abgebrochen', statusTimedOut: 'Zeitüberschreitung', statusInterrupted: 'Unterbrochen', statusComplete: 'Abgeschlossen', statusLiveUpdates: 'Live-Aktualisierungen', statusReconnecting: 'Verbindung wird wiederhergestellt', rowsRead: 'gelesene Zeilen', bytesRead: 'gelesen', memory: 'Speicher', import: 'Importieren', export: 'Exportieren', refresh: 'Aktualisieren', workspaceInspector: 'ARBEITSBEREICH-INSPEKTOR', workspaceBrowser: 'Arbeitsbereich durchsuchen', workspacePanels: 'Weitere Arbeitsbereich-Bereiche', schemaSearch: 'Tabellen, Spalten und Wörterbücher suchen…', tableCount: '{count} TABELLEN', loading: 'Wird geladen…', schemaPrivate: 'Schema ist privat', trustToInspect: 'Vertrauen für die Verbindung, um Tabellen und Spalten anzuzeigen.', readingSchema: 'ClickHouse-Schema wird gelesen…', noTablesMatch: 'Keine Tabellen oder Wörterbücher entsprechen der Suche.', insertTableName: 'Tabellennamen einfügen', rowsEstimated: 'Zeilen geschätzt', parts: 'Teile', projections: 'Projektionen', skipIndexes: 'Skip-Indizes', metadataUnavailable: 'ClickHouse-Metadaten nicht verfügbar', systemTable: 'ClickHouse-Systemtabelle', clickhouseSql: 'ClickHouse-SQL', runActions: 'Ausführungsaktionen', formatSql: 'SQL formatieren', previousStatement: 'Vorheriges SQL-Statement', nextStatement: 'Nächstes SQL-Statement', sqlFlowNativeAst: 'Native AST', sqlFlowKeywordEstimate: 'Keyword-Schätzung', characters: 'Zeichen', lines: 'Zeilen', sqlFlowTruncatedWarning: 'Diese Abfrage ist groß. Die Grafik zeigt eine begrenzte Anzahl von SQL-Phasen.', sqlFlowFilterKind: 'Filtern', sqlFlowAggregateKind: 'Aggregieren', sqlFlowSortKind: 'Sortieren', sqlFlowJoinKind: 'Verknüpfen', sqlFlowTransformKind: 'Umwandeln', sqlFlowStageKind: 'Phase', sqlFlowResizeKind: 'Skalieren', builtInFormatter: 'Integriert',
    },
    es: {
        workspaceMode: 'ESPACIO DE TRABAJO', parserMode: 'ANALIZADOR', browse: 'EXPLORAR', readOnly: 'Solo lectura', tables: 'Tablas', queries: 'Consultas', more: 'Más', localDraft: 'Borrador local', query: 'CONSULTA', format: 'Formatear', parserUnavailable: 'Analizador no disponible', retryParser: 'Reintentar analizador', sqlMap: 'Estructura SQL', visualizeSqlStructure: 'Visualizar estructura SQL', runScript: 'Ejecutar script', runActionTrustRequired: 'Confía en esta conexión antes de ejecutar SQL.', runActionWait: 'Espera a que termine la operación actual.', runActionRemoveParameters: 'Elimina los parámetros de consulta antes de ejecutar esta acción.', playgroundScriptUnavailable: 'El Playground público acepta una sola instrucción de solo lectura por solicitud. Aquí no se pueden ejecutar scripts.', askAi: 'Preguntar a la IA', running: 'Ejecutando…', selectQuery: 'Seleccionar consulta', selectCurrentSqlStatement: 'Seleccionar la sentencia SQL actual', jumpToSqlStatement: 'Ir a la sentencia SQL', clickhouseSnippet: 'Fragmento de ClickHouse', clickhouseSnippets: 'Fragmentos de ClickHouse…', snippetSelectHelp: 'Elige una plantilla y añádela como consulta nueva. El SQL existente se conserva.', addQuery: 'Añadir consulta', addSnippetAsNewQuery: 'Añadir fragmento como consulta nueva', incompleteSql: 'SQL incompleto', noSqlStatements: 'No hay sentencias SQL', oneStatement: '{count} sentencia', manyStatements: '{count} sentencias', queryVisualization: 'VISUALIZACIÓN DE LA CONSULTA', workspaceOutput: 'SALIDA DEL ESPACIO DE TRABAJO', sqlStructure: 'Estructura SQL', queryResults: 'Resultados de la consulta', expand: 'Expandir', collapse: 'Contraer', expandQuery: 'Expandir consulta SQL', collapseQuery: 'Contraer consulta SQL', expandOutput: 'Expandir salida', collapseOutput: 'Contraer salida', sqlFlowTitle: 'Cómo se compone esta consulta', sqlFlowDescription: 'Este es un mapa lógico, no un plan de ejecución del servidor.', sqlFlowClickStage: 'Haz clic en una etapa para ir a su SQL.', sqlFlowParserStarting: 'Iniciando analizador', sqlFlowParserUnavailable: 'Analizador no disponible', sqlFlowCodeMirror: 'Modo CodeMirror', sqlFlowEmpty: 'Escribe una consulta SELECT para crear su mapa estructural.', sqlFlowAstDetail: 'Detalle del AST: ', sqlFlowSqlDetail: 'Detalle SQL: ', sqlFlowNativeHeading: 'FLUJO SQL DE CLICKHOUSE', sqlFlowFallbackHeading: 'FLUJO SQL · MEJOR ESFUERZO', sqlFlowGraphHint: 'Haz clic en un nodo para inspeccionar su cláusula y seleccionarla en el editor', sqlFlowReturnResult: 'Devolver resultado', sqlFlowOutputColumns: 'Columnas de la lista SELECT', sqlFlowSelectedStage: 'Etapa seleccionada', sqlFlowInspectStage: 'Inspeccionar etapa', sqlFlowStageDetails: 'Detalles de la etapa seleccionada', sqlFlowStages: 'etapas', sqlFlowOperators: 'operadores', sqlFlowConnections: 'conexiones', sqlFlowInputs: 'Entradas', sqlFlowOutputs: 'Salidas', sqlFlowReadKind: 'Lectura', sqlFlowOutputKind: 'Salida', sqlFlowEstimatedStatus: 'estimado', sqlFlowSourceDetail: 'Origen de tabla', sqlFlowNoStages: 'No se encontraron etapas SQL en esta sentencia.', statusReady: 'Listo', statusQueued: 'En cola', statusRunning: 'Ejecutando', statusSucceeded: 'Correcto', statusTruncated: 'Truncado', statusFailed: 'Error', statusCancelled: 'Cancelado', statusTimedOut: 'Tiempo agotado', statusInterrupted: 'Interrumpido', statusComplete: 'Completo', statusLiveUpdates: 'Actualizaciones en vivo', statusReconnecting: 'Reconectando', rowsRead: 'filas leídas', bytesRead: 'leídos', memory: 'memoria', import: 'Importar', export: 'Exportar', refresh: 'Actualizar', workspaceInspector: 'INSPECTOR DEL ESPACIO DE TRABAJO', workspaceBrowser: 'Explorador del espacio de trabajo', workspacePanels: 'Más paneles del espacio de trabajo', schemaSearch: 'Buscar tablas, columnas y diccionarios…', tableCount: '{count} TABLAS', loading: 'Cargando…', schemaPrivate: 'El esquema es privado', trustToInspect: 'Confía en la conexión para inspeccionar tablas y columnas.', readingSchema: 'Leyendo el esquema de ClickHouse…', noTablesMatch: 'Ninguna tabla o diccionario coincide con la búsqueda.', insertTableName: 'Insertar nombre de tabla', rowsEstimated: 'filas estimadas', parts: 'partes', projections: 'proyecciones', skipIndexes: 'índices de omisión', metadataUnavailable: 'Metadatos de ClickHouse no disponibles', systemTable: 'Tabla del sistema de ClickHouse', clickhouseSql: 'SQL de ClickHouse', runActions: 'Acciones de ejecución', formatSql: 'Formatear SQL', previousStatement: 'Sentencia SQL anterior', nextStatement: 'Sentencia SQL siguiente', sqlFlowNativeAst: 'AST nativo', sqlFlowKeywordEstimate: 'Estimación por palabras clave', characters: 'caracteres', lines: 'líneas', sqlFlowTruncatedWarning: 'Esta consulta es grande. El mapa muestra un conjunto limitado de etapas SQL.', sqlFlowFilterKind: 'Filtrar', sqlFlowAggregateKind: 'Agregar', sqlFlowSortKind: 'Ordenar', sqlFlowJoinKind: 'Unir', sqlFlowTransformKind: 'Transformar', sqlFlowStageKind: 'Etapa', sqlFlowResizeKind: 'Cambiar tamaño', builtInFormatter: 'Integrado',
    },
    nl: {
        workspaceMode: 'WERKRUIMTE', parserMode: 'PARSER', browse: 'BLADEREN', readOnly: 'Alleen lezen', tables: 'Tabellen', queries: 'Query’s', more: 'Meer', localDraft: 'Lokaal concept', query: 'QUERY', format: 'Formatteren', parserUnavailable: 'Parser niet beschikbaar', retryParser: 'Parser opnieuw proberen', sqlMap: 'SQL-structuur', visualizeSqlStructure: 'SQL-structuur visualiseren', runScript: 'Script uitvoeren', runActionTrustRequired: 'Vertrouw deze verbinding voordat je SQL uitvoert.', runActionWait: 'Wacht tot de huidige bewerking is voltooid.', runActionRemoveParameters: 'Verwijder queryparameters voordat je deze actie uitvoert.', playgroundScriptUnavailable: 'De openbare Playground accepteert één alleen-lezen statement per verzoek. Scripts uitvoeren is hier niet beschikbaar.', askAi: 'AI vragen', running: 'Bezig met uitvoeren…', selectQuery: 'Query selecteren', selectCurrentSqlStatement: 'Huidige SQL-instructie selecteren', jumpToSqlStatement: 'Naar SQL-instructie gaan', clickhouseSnippet: 'ClickHouse-fragment', clickhouseSnippets: 'ClickHouse-fragmenten…', snippetSelectHelp: 'Kies een sjabloon en voeg het toe als nieuwe query. Bestaande SQL blijft behouden.', addQuery: 'Query toevoegen', addSnippetAsNewQuery: 'Fragment toevoegen als nieuwe query', incompleteSql: 'Onvolledige SQL', noSqlStatements: 'Geen SQL-instructies', oneStatement: '{count} instructie', manyStatements: '{count} instructies', queryVisualization: 'QUERYVISUALISATIE', workspaceOutput: 'WERKRUIMTE-UITVOER', sqlStructure: 'SQL-structuur', queryResults: 'Queryresultaten', expand: 'Uitvouwen', collapse: 'Invouwen', expandQuery: 'SQL-query uitvouwen', collapseQuery: 'SQL-query invouwen', expandOutput: 'Uitvoer uitvouwen', collapseOutput: 'Uitvoer invouwen', sqlFlowTitle: 'Zo is deze query opgebouwd', sqlFlowDescription: 'Dit is een logisch schema, geen uitvoeringsplan van de server.', sqlFlowClickStage: 'Klik op een fase om naar de SQL te gaan.', sqlFlowParserStarting: 'Parser wordt gestart', sqlFlowParserUnavailable: 'Parser niet beschikbaar', sqlFlowCodeMirror: 'CodeMirror-modus', sqlFlowEmpty: 'Schrijf een SELECT-query om de structuur te tonen.', sqlFlowAstDetail: 'AST-details: ', sqlFlowSqlDetail: 'SQL-details: ', sqlFlowNativeHeading: 'CLICKHOUSE SQL-STROOM', sqlFlowFallbackHeading: 'SQL-STROOM · BEST EFFORT', sqlFlowGraphHint: 'Klik op een knooppunt om de clausule te bekijken en in de editor te selecteren', sqlFlowReturnResult: 'Resultaat retourneren', sqlFlowOutputColumns: 'Kolommen uit de SELECT-lijst', sqlFlowSelectedStage: 'Geselecteerde fase', sqlFlowInspectStage: 'Fase bekijken', sqlFlowStageDetails: 'Details van geselecteerde fase', sqlFlowStages: 'fasen', sqlFlowOperators: 'operators', sqlFlowConnections: 'verbindingen', sqlFlowInputs: 'Invoer', sqlFlowOutputs: 'Uitvoer', sqlFlowReadKind: 'Lezen', sqlFlowOutputKind: 'Uitvoer', sqlFlowEstimatedStatus: 'geschat', sqlFlowSourceDetail: 'Tabelbron', sqlFlowNoStages: 'Geen SQL-fasen gevonden in deze instructie.', statusReady: 'Gereed', statusQueued: 'In wachtrij', statusRunning: 'Bezig', statusSucceeded: 'Geslaagd', statusTruncated: 'Afgekapt', statusFailed: 'Mislukt', statusCancelled: 'Geannuleerd', statusTimedOut: 'Time-out', statusInterrupted: 'Onderbroken', statusComplete: 'Voltooid', statusLiveUpdates: 'Live-updates', statusReconnecting: 'Opnieuw verbinden', rowsRead: 'gelezen rijen', bytesRead: 'gelezen', memory: 'geheugen', import: 'Importeren', export: 'Exporteren', refresh: 'Vernieuwen', workspaceInspector: 'WERKRUIMTE-INSPECTOR', workspaceBrowser: 'Werkruimte verkennen', workspacePanels: 'Meer werkruimtepanelen', schemaSearch: 'Tabellen, kolommen en woordenboeken zoeken…', tableCount: '{count} TABELLEN', loading: 'Laden…', schemaPrivate: 'Schema is privé', trustToInspect: 'Vertrouw de verbinding om tabellen en kolommen te bekijken.', readingSchema: 'ClickHouse-schema lezen…', noTablesMatch: 'Geen tabellen of woordenboeken komen overeen met deze zoekopdracht.', insertTableName: 'Tabelnaam invoegen', rowsEstimated: 'rijen geschat', parts: 'delen', projections: 'projecties', skipIndexes: 'skip-indexen', metadataUnavailable: 'ClickHouse-metadata niet beschikbaar', systemTable: 'ClickHouse-systeemtabel', clickhouseSql: 'ClickHouse-SQL', runActions: 'Uitvoeracties', formatSql: 'SQL formatteren', previousStatement: 'Vorige SQL-instructie', nextStatement: 'Volgende SQL-instructie', sqlFlowNativeAst: 'Native AST', sqlFlowKeywordEstimate: 'Schatting op basis van trefwoorden', characters: 'tekens', lines: 'regels', sqlFlowTruncatedWarning: 'Deze query is groot. De grafiek toont een beperkte set SQL-fasen.', sqlFlowFilterKind: 'Filteren', sqlFlowAggregateKind: 'Aggregatie', sqlFlowSortKind: 'Sorteren', sqlFlowJoinKind: 'Samenvoegen', sqlFlowTransformKind: 'Transformeren', sqlFlowStageKind: 'Fase', sqlFlowResizeKind: 'Schalen', builtInFormatter: 'Ingebouwd',
    },
    zh: {
        workspaceMode: '工作区', parserMode: '解析器', browse: '浏览', readOnly: '只读', tables: '表', queries: '查询', more: '更多', localDraft: '本地草稿', query: '查询', format: '格式化', parserUnavailable: '解析器不可用', retryParser: '重试解析器', sqlMap: 'SQL 结构图', visualizeSqlStructure: '可视化 SQL 结构', runScript: '运行脚本', runActionTrustRequired: '运行 SQL 前请先信任此连接。', runActionWait: '请等待当前操作完成。', runActionRemoveParameters: '运行此操作前请移除查询参数。', playgroundScriptUnavailable: '公共 Playground 每次请求只接受一条只读语句。此处无法运行脚本。', askAi: '询问 AI', running: '运行中…', selectQuery: '选择查询', selectCurrentSqlStatement: '选择当前 SQL 语句', jumpToSqlStatement: '跳转到 SQL 语句', clickhouseSnippet: 'ClickHouse 代码片段', clickhouseSnippets: 'ClickHouse 代码片段…', snippetSelectHelp: '选择模板并将其添加为新查询。现有 SQL 会保留。', addQuery: '添加查询', addSnippetAsNewQuery: '将代码片段添加为新查询', incompleteSql: 'SQL 不完整', noSqlStatements: '没有 SQL 语句', oneStatement: '{count} 条语句', manyStatements: '{count} 条语句', queryVisualization: '查询可视化', workspaceOutput: '工作区输出', sqlStructure: 'SQL 结构', queryResults: '查询结果', expand: '展开', collapse: '折叠', expandQuery: '展开 SQL 查询', collapseQuery: '折叠 SQL 查询', expandOutput: '展开输出', collapseOutput: '折叠输出', sqlFlowTitle: '此查询的组成方式', sqlFlowDescription: '这是逻辑结构图，不是服务器执行计划。', sqlFlowClickStage: '点击阶段可跳转到对应 SQL。', sqlFlowParserStarting: '解析器正在启动', sqlFlowParserUnavailable: '解析器不可用', sqlFlowCodeMirror: 'CodeMirror 模式', sqlFlowEmpty: '编写 SELECT 查询以生成结构图。', sqlFlowAstDetail: 'AST 详情：', sqlFlowSqlDetail: 'SQL 详情：', sqlFlowNativeHeading: 'CLICKHOUSE SQL 流程', sqlFlowFallbackHeading: 'SQL 流程 · 尽力解析', sqlFlowGraphHint: '点击节点查看子句，并在编辑器中定位到对应 SQL', sqlFlowReturnResult: '返回结果', sqlFlowOutputColumns: 'SELECT 列表生成的列', sqlFlowSelectedStage: '已选阶段', sqlFlowInspectStage: '查看阶段', sqlFlowStageDetails: '所选阶段详情', sqlFlowStages: '个阶段', sqlFlowOperators: '个算子', sqlFlowConnections: '条连接', sqlFlowInputs: '输入', sqlFlowOutputs: '输出', sqlFlowReadKind: '读取', sqlFlowOutputKind: '输出', sqlFlowEstimatedStatus: '估算', sqlFlowSourceDetail: '表来源', sqlFlowNoStages: '此语句中未找到 SQL 阶段。', statusReady: '就绪', statusQueued: '排队中', statusRunning: '运行中', statusSucceeded: '成功', statusTruncated: '已截断', statusFailed: '失败', statusCancelled: '已取消', statusTimedOut: '已超时', statusInterrupted: '已中断', statusComplete: '已完成', statusLiveUpdates: '实时更新', statusReconnecting: '正在重新连接', rowsRead: '行已读取', bytesRead: '已读取', memory: '内存', import: '导入', export: '导出', refresh: '刷新', workspaceInspector: '工作区检查器', workspaceBrowser: '工作区浏览器', workspacePanels: '更多工作区面板', schemaSearch: '搜索表、列和字典…', tableCount: '{count} 个表', loading: '加载中…', schemaPrivate: '架构为私有', trustToInspect: '信任此连接后即可查看表和列。', readingSchema: '正在读取 ClickHouse 架构…', noTablesMatch: '没有匹配的表或字典。', insertTableName: '插入表名', rowsEstimated: '估算行数', parts: '分区片段', projections: '投影', skipIndexes: '跳过索引', metadataUnavailable: 'ClickHouse 元数据不可用', systemTable: 'ClickHouse 系统表', clickhouseSql: 'ClickHouse SQL', runActions: '运行操作', formatSql: '格式化 SQL', previousStatement: '上一条 SQL 语句', nextStatement: '下一条 SQL 语句', sqlFlowNativeAst: '原生 AST', sqlFlowKeywordEstimate: '关键词估算', characters: '个字符', lines: '行', sqlFlowTruncatedWarning: '此查询较大，图中仅显示有限数量的 SQL 阶段。', sqlFlowFilterKind: '筛选', sqlFlowAggregateKind: '聚合', sqlFlowSortKind: '排序', sqlFlowJoinKind: '联接', sqlFlowTransformKind: '转换', sqlFlowStageKind: '阶段', sqlFlowResizeKind: '调整并行度', builtInFormatter: '内置',
    },
    ru: {
        workspaceMode: 'РАБОЧАЯ ОБЛАСТЬ', parserMode: 'ПАРСЕР', browse: 'ОБЗОР', readOnly: 'Только чтение', tables: 'Таблицы', queries: 'Запросы', more: 'Ещё', localDraft: 'Локальный черновик', query: 'ЗАПРОС', format: 'Форматировать', parserUnavailable: 'Парсер недоступен', retryParser: 'Повторить запуск парсера', sqlMap: 'Структура SQL', visualizeSqlStructure: 'Визуализировать структуру SQL', runScript: 'Выполнить скрипт', runActionTrustRequired: 'Подтвердите доверие к подключению перед запуском SQL.', runActionWait: 'Дождитесь завершения текущей операции.', runActionRemoveParameters: 'Удалите параметры запроса перед запуском этого действия.', playgroundScriptUnavailable: 'Публичный Playground принимает только один запрос на чтение за один вызов. Запуск скриптов здесь недоступен.', askAi: 'Спросить ИИ', running: 'Выполняется…', selectQuery: 'Выбрать запрос', selectCurrentSqlStatement: 'Выбрать текущий SQL-оператор', jumpToSqlStatement: 'Перейти к SQL-оператору', clickhouseSnippet: 'Фрагмент ClickHouse', clickhouseSnippets: 'Фрагменты ClickHouse…', snippetSelectHelp: 'Выберите шаблон и добавьте его как новый запрос. Существующий SQL сохранится.', addQuery: 'Добавить запрос', addSnippetAsNewQuery: 'Добавить фрагмент как новый запрос', incompleteSql: 'Незавершённый SQL', noSqlStatements: 'Нет SQL-операторов', oneStatement: '{count} оператор', manyStatements: '{count} операторов', queryVisualization: 'ВИЗУАЛИЗАЦИЯ ЗАПРОСА', workspaceOutput: 'РЕЗУЛЬТАТЫ РАБОЧЕЙ ОБЛАСТИ', sqlStructure: 'Структура SQL', queryResults: 'Результаты запроса', expand: 'Развернуть', collapse: 'Свернуть', expandQuery: 'Развернуть SQL-запрос', collapseQuery: 'Свернуть SQL-запрос', expandOutput: 'Развернуть результаты', collapseOutput: 'Свернуть результаты', sqlFlowTitle: 'Из чего состоит запрос', sqlFlowDescription: 'Это логическая схема, а не план выполнения на сервере.', sqlFlowClickStage: 'Нажмите этап, чтобы перейти к его SQL.', sqlFlowParserStarting: 'Запуск парсера', sqlFlowParserUnavailable: 'Парсер недоступен', sqlFlowCodeMirror: 'Режим CodeMirror', sqlFlowEmpty: 'Введите SELECT-запрос, чтобы построить его структуру.', sqlFlowAstDetail: 'Сведения AST: ', sqlFlowSqlDetail: 'Сведения SQL: ', sqlFlowNativeHeading: 'ПОТОК CLICKHOUSE SQL', sqlFlowFallbackHeading: 'ПОТОК SQL · ПРИБЛИЗИТЕЛЬНО', sqlFlowGraphHint: 'Нажмите узел, чтобы изучить его условие и найти его в редакторе', sqlFlowReturnResult: 'Вернуть результат', sqlFlowOutputColumns: 'Столбцы из списка SELECT', sqlFlowSelectedStage: 'Выбранный этап', sqlFlowInspectStage: 'Изучить этап', sqlFlowStageDetails: 'Сведения о выбранном этапе', sqlFlowStages: 'этапы', sqlFlowOperators: 'операторы', sqlFlowConnections: 'связи', sqlFlowInputs: 'Входы', sqlFlowOutputs: 'Выходы', sqlFlowReadKind: 'Чтение', sqlFlowOutputKind: 'Результат', sqlFlowEstimatedStatus: 'оценка', sqlFlowSourceDetail: 'Источник таблицы', sqlFlowNoStages: 'В этом операторе не найдены этапы SQL.', statusReady: 'Готово', statusQueued: 'В очереди', statusRunning: 'Выполняется', statusSucceeded: 'Успешно', statusTruncated: 'Обрезано', statusFailed: 'Ошибка', statusCancelled: 'Отменено', statusTimedOut: 'Истекло время', statusInterrupted: 'Прервано', statusComplete: 'Завершено', statusLiveUpdates: 'Обновления в реальном времени', statusReconnecting: 'Переподключение', rowsRead: 'прочитано строк', bytesRead: 'прочитано', memory: 'память', import: 'Импорт', export: 'Экспорт', refresh: 'Обновить', workspaceInspector: 'ОБЗОР РАБОЧЕЙ ОБЛАСТИ', workspaceBrowser: 'Обзор рабочей области', workspacePanels: 'Другие панели рабочей области', schemaSearch: 'Поиск таблиц, столбцов и словарей…', tableCount: 'ТАБЛИЦ: {count}', loading: 'Загрузка…', schemaPrivate: 'Схема закрыта', trustToInspect: 'Доверьте подключение, чтобы просматривать таблицы и столбцы.', readingSchema: 'Чтение схемы ClickHouse…', noTablesMatch: 'Нет таблиц или словарей, соответствующих запросу.', insertTableName: 'Вставить имя таблицы', rowsEstimated: 'строк (оценка)', parts: 'частей', projections: 'проекций', skipIndexes: 'пропускающих индексов', metadataUnavailable: 'Метаданные ClickHouse недоступны', systemTable: 'Системная таблица ClickHouse', clickhouseSql: 'ClickHouse SQL', runActions: 'Действия выполнения', formatSql: 'Форматировать SQL', previousStatement: 'Предыдущий SQL-оператор', nextStatement: 'Следующий SQL-оператор', sqlFlowNativeAst: 'Собственный AST', sqlFlowKeywordEstimate: 'Оценка по ключевым словам', characters: 'символов', lines: 'строк', sqlFlowTruncatedWarning: 'Этот запрос большой. На схеме показан ограниченный набор этапов SQL.', sqlFlowFilterKind: 'Фильтр', sqlFlowAggregateKind: 'Агрегация', sqlFlowSortKind: 'Сортировка', sqlFlowJoinKind: 'Соединение', sqlFlowTransformKind: 'Преобразование', sqlFlowStageKind: 'Этап', sqlFlowResizeKind: 'Изменение параллелизма', builtInFormatter: 'Встроенный',
    },
};

export const localeOptions = [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
    { value: 'nl', label: 'Nederlands' },
    { value: 'zh', label: '中文' },
    { value: 'ru', label: 'Русский' },
] as const satisfies readonly SelectOption<Locale>[];

export const themeOptions = [
    { value: 'click-dark', label: 'Dark theme' },
    { value: 'click-light', label: 'Light theme' },
] as const satisfies readonly SelectOption<Theme>[];

export const experienceOptions = (copy: Copy) => [
    { value: 'beginner', label: copy.app.beginner },
    { value: 'expert', label: copy.app.expert },
] as const satisfies readonly SelectOption<ExperienceLevel>[];

function mergeSection<T extends object>(englishSection: T, translated: object): T {
    const result = { ...englishSection };
    const values = new Map<string, unknown>(Object.entries(translated));
    for (const key of Object.keys(englishSection)) {
        const value = values.get(key);
        if (typeof value === 'string') Object.assign(result, { [key]: value });
    }
    return result;
}

export function getCopy(locale: Locale): Copy {
    if (locale === 'en') return english;
    const translated = translations[locale];
    return {
        app: mergeSection(english.app, translated),
        auth: mergeSection(english.auth, translated),
        common: { ...mergeSection(english.common, translated), ...exampleCommonTranslations[locale], ...workspaceCommonTranslations[locale] },
        chart: mergeSection(english.chart, translated),
    };
}
