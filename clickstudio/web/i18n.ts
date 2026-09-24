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
        examplePreviewTable: string;
        exampleReadRows: string;
        searchExamples: string;
        noExamplesFound: string;
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
        help: 'Help',
        examples: 'Examples',
        sqlExamples: 'SQL examples',
        examplesHint: 'Choose a query to preview it. It opens in a new tab and does not run automatically.',
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
        examplePreviewTable: 'Preview {table}',
        exampleReadRows: 'Read up to 50 rows from this table.',
        searchExamples: 'Search examples',
        noExamplesFound: 'No examples match your search.',
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
        language: 'Sprache', theme: 'Thema', beginner: 'Kompakt', expert: 'Erweitert', run: 'Ausführen', runStatement: 'Abfrage ausführen', cancel: 'Abbrechen', save: 'Speichern', saveRevision: 'Revision speichern', schema: 'Schema', history: 'Läufe', assistant: 'KI', results: 'Ergebnisse', chart: 'Diagramm', insights: 'Einblicke', newSql: 'Neue SQL-Abfrage', help: 'Hilfe', examples: 'Beispiele', sqlExamples: 'SQL-Beispiele', examplesHint: 'Abfrage auswählen und Vorschau ansehen. Sie wird in einem neuen Tab geöffnet und nicht automatisch ausgeführt.', closeExamples: 'SQL-Beispiele schließen', exampleCategories: 'Beispielkategorien', allExamples: 'Alle', exampleBasics: 'Grundlagen', exampleAggregation: 'Aggregationen', exampleTimeSeries: 'Zeitreihen', exampleClickHouse: 'ClickHouse', exampleSchema: 'Ihre Tabellen', searchExamples: 'Beispiele suchen', noExamplesFound: 'Keine passenden Beispiele gefunden.', openInNewSql: 'In neuem SQL öffnen', open: 'Arbeitsbereich öffnen', opening: 'Arbeitsbereich wird geöffnet…',
        preparing: 'Diagramm aus gespeicherten Zeilen wird erstellt…', noColumns: 'Dieses Ergebnis enthält keine Diagrammspalten.', fallbackNoMeasure: 'Dieses Ergebnis enthält keine numerische Kennzahl. Daher wird die typisierte Tabelle angezeigt.', visualExploration: 'VISUALISIERUNG', queryResult: 'Abfrageergebnis', rowsOverTime: 'Zeilen im Zeitverlauf', rowsOverTimeBy: 'Zeilen im Zeitverlauf nach {dimension}', rowsBy: 'Zeilen nach {dimension}', timeCountDescription: 'Zeilen aus dem gespeicherten Ergebnis werden in {unit} zusammengefasst. Es wird keine Aggregatabfrage gesendet.', categoryCountDescription: 'Zeilen aus dem gespeicherten Ergebnis werden nach {dimension} gezählt. Es wird keine Aggregatabfrage gesendet.', xAxis: 'X-Achse', yAxis: 'Y-Achse', xMeasure: 'X-Kennzahl', breakdownBy: 'Aufschlüsseln nach', allRows: 'Alle Zeilen', rowsLabel: 'Zeilen', noDimensions: 'Dieses Ergebnis hat keine Dimensionen zum Gruppieren.', noRetainedRows: 'Dieses Ergebnis enthält keine gespeicherten Zeilen zum Darstellen.', noValidTimeValues: 'Keine gespeicherten Zeilen enthalten einen gültigen Wert für diese Zeitspalte.', minutes: 'Minuten', hours: 'Stunden', days: 'Tagen', weeks: 'Wochen', months: 'Monaten', timeSummary: '{buckets} Zeitabschnitte ({unit}) aus {rows} zurückgegebenen Zeilen', categorySummary: '{categories} Kategorien aus {rows} zurückgegebenen Zeilen', invalidDatesSkipped: '{count} ungültige Datumswerte übersprungen', retainedPrefixOnly: 'nur gespeicherter Anfang des Ergebnisses', completeQueryResult: 'vollständiges Abfrageergebnis', timePointTooltip: '{bucket} · {series}: {count} Zeilen', categoryBarTooltip: '{category}: {count} Zeilen', reasonSingleNumber: 'Eine Zeile mit einer numerischen Kennzahl.', reasonTimeMeasure: 'Eine Datums-/Zeitdimension mit numerischen Kennzahlen.', reasonDimensionMeasure: 'Eine Dimension mit numerischen Kennzahlen; es wird nichts stillschweigend aggregiert.', heatmapReturnedRows: 'Zellen stammen aus zurückgegebenen Zeilen; fehlende Gruppen bleiben leer.', sampledForDisplay: 'Lange Ergebnisse werden für die Anzeige gleichmäßig abgetastet.', xAxisMeasure: 'X-Kennzahl', measures: 'Kennzahlen', measure: 'Kennzahl', type: 'Typ', numberType: 'Zahl', lineType: 'Linie', barType: 'Balken', scatterType: 'Streudiagramm', heatmapType: 'Heatmap', numberNeedsOneRow: 'Die Zahlenansicht benötigt eine gespeicherte Zeile. Für mehrere Zeilen Linie oder Balken wählen.', chooseNumericColumn: 'Wähle eine numerische Ergebnisspalte für einen Einzelwert.', singleValue: 'EINZELWERT', exactResultValue: '1 gespeicherte Zeile · exakter Ergebniswert', tooManyHeatmapLabels: 'Dieses Ergebnis hat zu viele Zeilen- und Spaltenbeschriftungen für eine lesbare Heatmap. Gruppiere es zuerst zu einem kleineren Raster.', heatmapNeedsDimensions: 'Eine Heatmap benötigt zwei Dimensionen und eine numerische Kennzahl.', heatmapTableAria: '{measure} nach {groupBy} und {xAxis}', heatmapNotRetained: 'nicht gespeichert', heatmapNoReturnedRow: 'keine zurückgegebene Zeile', heatmapNullMeasure: 'Kennzahl ist NULL', heatmapCaption: '{measure} · {rows} Zeilen × {columns} Spalten · {note}', heatmapTruncatedNote: 'leere Zellen können außerhalb des gespeicherten Ergebnisses liegen', heatmapCompleteNote: 'leere Zellen hatten keine zurückgegebene Gruppe', scatterNeedsTwoNumeric: 'Ein Streudiagramm benötigt zwei numerische Spalten. Wähle ein anderes Ergebnis oder Linie/Balken.', useLineOrBar: 'Wähle ein anderes Ergebnis oder Linie/Balken.', chooseNumericMeasure: 'Wähle eine numerische Kennzahl zum Darstellen.', chartComparing: 'Diagramm „{type}“: {x} und {y}', oneValue: '1 Wert', retainedRows: '{rows} gespeicherte Zeilen', populatedCells: '{cells} belegte Zellen aus {rows} Zeilen', rowsSuffix: 'Zeilen', plottedPoints: '{points} dargestellte Punkte', sampledRowsSummary: '{sampled} abgetastete Zeilen aus {rows} gespeicherten Zeilen', retainedRowsAcrossOneMeasure: '{rows} gespeicherte Zeilen mit 1 Kennzahl', retainedRowsAcrossManyMeasures: '{rows} gespeicherte Zeilen mit {measures} Kennzahlen',
    },
    es: {
        language: 'Idioma', theme: 'Tema', beginner: 'Compacto', expert: 'Avanzado', run: 'Ejecutar', runStatement: 'Ejecutar consulta', cancel: 'Cancelar', save: 'Guardar', saveRevision: 'Guardar revisión', schema: 'Esquema', history: 'Historial', assistant: 'IA', results: 'Resultados', chart: 'Gráfico', insights: 'Insights', newSql: 'Nuevo SQL', help: 'Ayuda', examples: 'Ejemplos', sqlExamples: 'Ejemplos SQL', examplesHint: 'Elige una consulta para verla. Se abrirá en una pestaña nueva y no se ejecutará automáticamente.', closeExamples: 'Cerrar ejemplos SQL', exampleCategories: 'Categorías de ejemplos', allExamples: 'Todos', exampleBasics: 'Conceptos básicos', exampleAggregation: 'Agregaciones', exampleTimeSeries: 'Series temporales', exampleClickHouse: 'ClickHouse', exampleSchema: 'Tus tablas', searchExamples: 'Buscar ejemplos', noExamplesFound: 'No hay ejemplos que coincidan.', openInNewSql: 'Abrir en un SQL nuevo', open: 'Abrir espacio', opening: 'Abriendo espacio…',
        preparing: 'Preparando un gráfico con las filas conservadas…', noColumns: 'Este resultado no tiene columnas para representar.', fallbackNoMeasure: 'Este resultado no tiene una medida numérica; se muestra la tabla con sus tipos.', visualExploration: 'VISUALIZACIÓN', queryResult: 'Resultado de la consulta', rowsOverTime: 'Filas a lo largo del tiempo', rowsOverTimeBy: 'Filas a lo largo del tiempo por {dimension}', rowsBy: 'Filas por {dimension}', timeCountDescription: 'Las filas se cuentan en intervalos de {unit} a partir del resultado conservado. No se envía ninguna consulta de agregación.', categoryCountDescription: 'Las filas se cuentan por {dimension} a partir del resultado conservado. No se envía ninguna consulta de agregación.', xAxis: 'Eje X', yAxis: 'Eje Y', xMeasure: 'Medida X', breakdownBy: 'Desglosar por', allRows: 'Todas las filas', rowsLabel: 'Filas', noDimensions: 'Este resultado no tiene dimensiones para agrupar.', noRetainedRows: 'Este resultado no tiene filas conservadas para representar.', noValidTimeValues: 'Ninguna fila conservada tiene un valor válido para esta columna temporal.', minutes: 'minutos', hours: 'horas', days: 'días', weeks: 'semanas', months: 'meses', timeSummary: '{buckets} intervalos de {unit} de {rows} filas devueltas', categorySummary: '{categories} categorías de {rows} filas devueltas', invalidDatesSkipped: 'Se omitieron {count} fechas no válidas', retainedPrefixOnly: 'solo el prefijo conservado', completeQueryResult: 'resultado completo de la consulta', timePointTooltip: '{bucket} · {series}: {count} filas', categoryBarTooltip: '{category}: {count} filas', reasonSingleNumber: 'Una fila con una medida numérica.', reasonTimeMeasure: 'Una dimensión de fecha/hora con medidas numéricas.', reasonDimensionMeasure: 'Una dimensión con medidas numéricas; no se realiza ninguna agregación oculta.', heatmapReturnedRows: 'Las celdas usan las filas devueltas; los grupos ausentes quedan en blanco.', sampledForDisplay: 'Los resultados largos se muestrean uniformemente para mostrarlos.', xAxisMeasure: 'Medida X', measures: 'Medidas', measure: 'Medida', type: 'Tipo', numberType: 'Número', lineType: 'Línea', barType: 'Barras', scatterType: 'Dispersión', heatmapType: 'Mapa de calor', numberNeedsOneRow: 'La vista numérica necesita una fila conservada. Elige Línea o Barras para varias filas.', chooseNumericColumn: 'Elige una columna numérica del resultado para mostrar un valor.', singleValue: 'VALOR ÚNICO', exactResultValue: '1 fila conservada · valor exacto del resultado', tooManyHeatmapLabels: 'Este resultado tiene demasiadas etiquetas de filas y columnas para un mapa de calor legible. Agrúpalo primero en una cuadrícula más pequeña.', heatmapNeedsDimensions: 'El mapa de calor necesita dos dimensiones y una medida numérica.', heatmapTableAria: '{measure} por {groupBy} y {xAxis}', heatmapNotRetained: 'no conservado', heatmapNoReturnedRow: 'ninguna fila devuelta', heatmapNullMeasure: 'medida nula', heatmapCaption: '{measure} · {rows} filas × {columns} columnas · {note}', heatmapTruncatedNote: 'puede haber celdas fuera del resultado conservado', heatmapCompleteNote: 'las celdas vacías no tuvieron un grupo devuelto', scatterNeedsTwoNumeric: 'El gráfico de dispersión necesita dos columnas numéricas. Elige otro resultado o usa Línea o Barras.', useLineOrBar: 'Elige otro resultado o usa Línea o Barras.', chooseNumericMeasure: 'Elige una medida numérica para representar.', chartComparing: 'Gráfico de {type}: {x} y {y}', oneValue: '1 valor', retainedRows: '{rows} filas conservadas', populatedCells: '{cells} celdas con datos de {rows} filas', rowsSuffix: 'filas', plottedPoints: '{points} puntos representados', sampledRowsSummary: '{sampled} filas muestreadas de {rows} conservadas', retainedRowsAcrossOneMeasure: '{rows} filas conservadas en 1 medida', retainedRowsAcrossManyMeasures: '{rows} filas conservadas en {measures} medidas',
    },
    nl: {
        language: 'Taal', theme: 'Thema', beginner: 'Compact', expert: 'Geavanceerd', run: 'Uitvoeren', runStatement: 'Query uitvoeren', cancel: 'Annuleren', save: 'Opslaan', saveRevision: 'Revisie opslaan', schema: 'Schema', history: 'Runs', assistant: 'AI', results: 'Resultaten', chart: 'Grafiek', insights: 'Inzichten', newSql: 'Nieuwe SQL', help: 'Help', examples: 'Voorbeelden', sqlExamples: 'SQL-voorbeelden', examplesHint: 'Kies een query om een voorbeeld te bekijken. Deze opent in een nieuw tabblad en wordt niet automatisch uitgevoerd.', closeExamples: 'SQL-voorbeelden sluiten', exampleCategories: 'Voorbeeldcategorieën', allExamples: 'Alle', exampleBasics: 'Basis', exampleAggregation: 'Aggregaties', exampleTimeSeries: 'Tijdreeksen', exampleClickHouse: 'ClickHouse', exampleSchema: 'Jouw tabellen', searchExamples: 'Voorbeelden zoeken', noExamplesFound: 'Geen voorbeelden gevonden.', openInNewSql: 'Openen in nieuwe SQL', open: 'Werkruimte openen', opening: 'Werkruimte openen…',
        preparing: 'Grafiek van bewaarde rijen voorbereiden…', noColumns: 'Dit resultaat heeft geen kolommen voor een grafiek.', fallbackNoMeasure: 'Dit resultaat heeft geen numerieke meetwaarde. Daarom wordt de getypeerde tabel getoond.', visualExploration: 'VISUALISATIE', queryResult: 'Queryresultaat', rowsOverTime: 'Rijen in de tijd', rowsOverTimeBy: 'Rijen in de tijd per {dimension}', rowsBy: 'Rijen per {dimension}', timeCountDescription: 'Rijen uit het bewaarde resultaat worden geteld in intervallen van {unit}. Er wordt geen aggregatiequery verstuurd.', categoryCountDescription: 'Rijen uit het bewaarde resultaat worden geteld per {dimension}. Er wordt geen aggregatiequery verstuurd.', xAxis: 'X-as', yAxis: 'Y-as', xMeasure: 'X-waarde', breakdownBy: 'Uitsplitsen op', allRows: 'Alle rijen', rowsLabel: 'Rijen', noDimensions: 'Dit resultaat heeft geen dimensies om te groeperen.', noRetainedRows: 'Dit resultaat heeft geen bewaarde rijen voor een grafiek.', noValidTimeValues: 'Geen bewaarde rijen bevatten een geldige waarde voor deze tijdkolom.', minutes: 'minuten', hours: 'uur', days: 'dagen', weeks: 'weken', months: 'maanden', timeSummary: '{buckets} tijdvakken ({unit}) uit {rows} geretourneerde rijen', categorySummary: '{categories} categorieën uit {rows} geretourneerde rijen', invalidDatesSkipped: '{count} ongeldige datums overgeslagen', retainedPrefixOnly: 'alleen bewaard begin van resultaat', completeQueryResult: 'volledig queryresultaat', timePointTooltip: '{bucket} · {series}: {count} rijen', categoryBarTooltip: '{category}: {count} rijen', reasonSingleNumber: 'Eén rij met een numerieke meetwaarde.', reasonTimeMeasure: 'Een datum-/tijddimensie met numerieke meetwaarden.', reasonDimensionMeasure: 'Een dimensie met numerieke meetwaarden; er wordt niet ongemerkt geaggregeerd.', heatmapReturnedRows: 'Cellen zijn gebaseerd op geretourneerde rijen; ontbrekende groepen blijven leeg.', sampledForDisplay: 'Lange resultaten worden gelijkmatig bemonsterd voor weergave.', xAxisMeasure: 'X-waarde', measures: 'Meetwaarden', measure: 'Meetwaarde', type: 'Type', numberType: 'Getal', lineType: 'Lijn', barType: 'Staaf', scatterType: 'Spreiding', heatmapType: 'Heatmap', numberNeedsOneRow: 'De getalweergave heeft één bewaarde rij nodig. Kies Lijn of Staaf voor meerdere rijen.', chooseNumericColumn: 'Kies een numerieke resultaatkolom om één waarde te tonen.', singleValue: 'ENKELE WAARDE', exactResultValue: '1 bewaarde rij · exacte resultaatwaarde', tooManyHeatmapLabels: 'Dit resultaat heeft te veel rij- en kolomlabels voor een leesbare heatmap. Groepeer het eerst in een kleiner raster.', heatmapNeedsDimensions: 'Een heatmap heeft twee dimensies en één numerieke meetwaarde nodig.', heatmapTableAria: '{measure} per {groupBy} en {xAxis}', heatmapNotRetained: 'niet bewaard', heatmapNoReturnedRow: 'geen geretourneerde rij', heatmapNullMeasure: 'meetwaarde is NULL', heatmapCaption: '{measure} · {rows} rijen × {columns} kolommen · {note}', heatmapTruncatedNote: 'lege cellen kunnen buiten het bewaarde resultaat vallen', heatmapCompleteNote: 'lege cellen hadden geen geretourneerde groep', scatterNeedsTwoNumeric: 'Een spreidingsdiagram heeft twee numerieke kolommen nodig. Kies een ander resultaat of gebruik Lijn of Staaf.', useLineOrBar: 'Kies een ander resultaat of gebruik Lijn of Staaf.', chooseNumericMeasure: 'Kies een numerieke meetwaarde om te tekenen.', chartComparing: '{type}-grafiek: {x} vergeleken met {y}', oneValue: '1 waarde', retainedRows: '{rows} bewaarde rijen', populatedCells: '{cells} gevulde cellen uit {rows} rijen', rowsSuffix: 'rijen', plottedPoints: '{points} getekende punten', sampledRowsSummary: '{sampled} bemonsterde rijen uit {rows} bewaarde rijen', retainedRowsAcrossOneMeasure: '{rows} bewaarde rijen over 1 meetwaarde', retainedRowsAcrossManyMeasures: '{rows} bewaarde rijen over {measures} meetwaarden',
    },
    zh: {
        language: '语言', theme: '主题', beginner: '紧凑', expert: '高级', run: '运行', runStatement: '运行查询', cancel: '取消', save: '保存', saveRevision: '保存修订', schema: '架构', history: '运行记录', assistant: 'AI', results: '结果', chart: '图表', insights: '洞察', newSql: '新建 SQL', help: '帮助', examples: '示例', sqlExamples: 'SQL 示例', examplesHint: '选择查询预览。它会在新标签页打开，不会自动运行。', closeExamples: '关闭 SQL 示例', exampleCategories: '示例类别', allExamples: '全部', exampleBasics: '基础', exampleAggregation: '聚合', exampleTimeSeries: '时间序列', exampleClickHouse: 'ClickHouse', exampleSchema: '你的表', searchExamples: '搜索示例', noExamplesFound: '没有匹配的示例。', openInNewSql: '在新 SQL 中打开', open: '打开工作区', opening: '正在打开工作区…',
        preparing: '正在根据保留的行生成图表…', noColumns: '此结果没有可用于图表的列。', fallbackNoMeasure: '此结果没有数值指标，因此显示带类型的表格。', visualExploration: '可视化分析', queryResult: '查询结果', rowsOverTime: '行数趋势', rowsOverTimeBy: '按 {dimension} 查看行数趋势', rowsBy: '按 {dimension} 统计行数', timeCountDescription: '根据保留的结果按{unit}统计行数，不会发送聚合查询。', categoryCountDescription: '根据保留的结果按 {dimension} 统计行数，不会发送聚合查询。', xAxis: 'X 轴', yAxis: 'Y 轴', xMeasure: 'X 轴指标', breakdownBy: '细分方式', allRows: '全部行', rowsLabel: '行数', noDimensions: '此结果没有可分组的维度。', noRetainedRows: '此结果没有可用于图表的保留行。', noValidTimeValues: '保留的行中没有包含此时间列的有效值。', minutes: '分钟', hours: '小时', days: '天', weeks: '周', months: '月', timeSummary: '{rows} 条返回行中的 {buckets} 个{unit}时间段', categorySummary: '{rows} 条返回行中的 {categories} 个类别', invalidDatesSkipped: '已跳过 {count} 个无效日期', retainedPrefixOnly: '仅显示保留的结果前缀', completeQueryResult: '完整查询结果', timePointTooltip: '{bucket} · {series}：{count} 行', categoryBarTooltip: '{category}：{count} 行', reasonSingleNumber: '一行数值指标。', reasonTimeMeasure: '日期/时间维度和数值指标。', reasonDimensionMeasure: '维度和数值指标；不会进行隐藏聚合。', heatmapReturnedRows: '单元格来自返回行；缺失的分组留空。', sampledForDisplay: '长结果会均匀抽样后显示。', xAxisMeasure: 'X 轴指标', measures: '指标', measure: '指标', type: '类型', numberType: '数值', lineType: '折线图', barType: '柱状图', scatterType: '散点图', heatmapType: '热力图', numberNeedsOneRow: '数值视图需要一条保留行。多行结果请选择折线图或柱状图。', chooseNumericColumn: '选择数值结果列以显示一个值。', singleValue: '单值', exactResultValue: '1 条保留行 · 精确结果值', tooManyHeatmapLabels: '行列标签过多，无法清晰显示热力图。请先将结果分组成更小的网格。', heatmapNeedsDimensions: '热力图需要两个维度和一个数值指标。', heatmapTableAria: '{measure}与{groupBy}和{xAxis}的关系', heatmapNotRetained: '未保留', heatmapNoReturnedRow: '没有返回行', heatmapNullMeasure: '指标为空', heatmapCaption: '{measure} · {rows} 行 × {columns} 列 · {note}', heatmapTruncatedNote: '空白单元格可能位于保留结果范围之外', heatmapCompleteNote: '空白单元格没有对应的返回分组', scatterNeedsTwoNumeric: '散点图需要两个数值列。请选择其他结果，或使用折线图/柱状图。', useLineOrBar: '请选择其他结果，或使用折线图/柱状图。', chooseNumericMeasure: '选择数值指标进行绘图。', chartComparing: '{type}：比较 {x} 和 {y}', oneValue: '1 个值', retainedRows: '{rows} 条保留行', populatedCells: '{rows} 行中的 {cells} 个非空单元格', rowsSuffix: '行', plottedPoints: '{points} 个绘制点', sampledRowsSummary: '从 {rows} 条保留行中抽取 {sampled} 行', retainedRowsAcrossOneMeasure: '{rows} 条保留行，1 个指标', retainedRowsAcrossManyMeasures: '{rows} 条保留行，{measures} 个指标',
    },
    ru: {
        language: 'Язык', theme: 'Тема', beginner: 'Компактный', expert: 'Расширенный', run: 'Запустить', runStatement: 'Выполнить запрос', cancel: 'Отмена', save: 'Сохранить', saveRevision: 'Сохранить ревизию', schema: 'Схема', history: 'Запуски', assistant: 'ИИ', results: 'Результаты', chart: 'График', insights: 'Инсайты', newSql: 'Новый SQL', help: 'Справка', examples: 'Примеры', sqlExamples: 'Примеры SQL', examplesHint: 'Выберите запрос для просмотра. Он откроется в новом SQL и не запустится автоматически.', closeExamples: 'Закрыть примеры SQL', exampleCategories: 'Категории примеров', allExamples: 'Все', exampleBasics: 'Основы', exampleAggregation: 'Агрегации', exampleTimeSeries: 'Временные ряды', exampleClickHouse: 'ClickHouse', exampleSchema: 'Ваши таблицы', searchExamples: 'Поиск примеров', noExamplesFound: 'Подходящих примеров нет.', openInNewSql: 'Открыть в новом SQL', open: 'Открыть рабочую область', opening: 'Открытие рабочей области…',
        preparing: 'Строим график по сохранённым строкам…', noColumns: 'В результате нет столбцов для построения графика.', fallbackNoMeasure: 'В результате нет числовой метрики, поэтому показана таблица с типами данных.', visualExploration: 'ВИЗУАЛИЗАЦИЯ', queryResult: 'Результат запроса', rowsOverTime: 'Количество строк во времени', rowsOverTimeBy: 'Количество строк во времени по полю «{dimension}»', rowsBy: 'Количество строк по полю «{dimension}»', timeCountDescription: 'Строки группируются по {unit} из сохранённого результата. Запрос агрегации не отправляется.', categoryCountDescription: 'Строки группируются по полю «{dimension}» из сохранённого результата. Запрос агрегации не отправляется.', xAxis: 'Ось X', yAxis: 'Ось Y', xMeasure: 'Мера по оси X', breakdownBy: 'Разбивка по', allRows: 'Все строки', rowsLabel: 'Строки', noDimensions: 'В результате нет измерений для группировки.', noRetainedRows: 'В результате нет сохранённых строк для графика.', noValidTimeValues: 'В сохранённых строках нет допустимых значений для этого столбца времени.', minutes: 'минутам', hours: 'часам', days: 'дням', weeks: 'неделям', months: 'месяцам', timeSummary: '{buckets} интервалов ({unit}) по {rows} возвращённым строкам', categorySummary: '{categories} категорий по {rows} возвращённым строкам', invalidDatesSkipped: 'Пропущено неверных дат: {count}', retainedPrefixOnly: 'показана только сохранённая часть результата', completeQueryResult: 'полный результат запроса', timePointTooltip: '{bucket} · {series}: строк — {count}', categoryBarTooltip: '{category}: строк — {count}', reasonSingleNumber: 'Одна строка с числовой метрикой.', reasonTimeMeasure: 'Измерение даты/времени с числовыми метриками.', reasonDimensionMeasure: 'Измерение с числовыми метриками; скрытая агрегация не выполняется.', heatmapReturnedRows: 'Ячейки построены по возвращённым строкам; отсутствующие группы оставлены пустыми.', sampledForDisplay: 'Для длинного результата точки равномерно отбираются для отображения.', xAxisMeasure: 'Мера по оси X', measures: 'Метрики', measure: 'Метрика', type: 'Тип', numberType: 'Число', lineType: 'Линия', barType: 'Столбцы', scatterType: 'Диаграмма рассеяния', heatmapType: 'Тепловая карта', numberNeedsOneRow: 'Для числового вида нужна одна сохранённая строка. Для нескольких строк выберите линию или столбцы.', chooseNumericColumn: 'Выберите числовой столбец результата для отображения одного значения.', singleValue: 'ОДНО ЗНАЧЕНИЕ', exactResultValue: '1 сохранённая строка · точное значение результата', tooManyHeatmapLabels: 'В результате слишком много подписей строк и столбцов для читаемой тепловой карты. Сначала сгруппируйте данные в меньшую сетку.', heatmapNeedsDimensions: 'Для тепловой карты нужны два измерения и одна числовая метрика.', heatmapTableAria: '{measure} по полю {groupBy} и {xAxis}', heatmapNotRetained: 'не сохранено', heatmapNoReturnedRow: 'нет возвращённой строки', heatmapNullMeasure: 'метрика NULL', heatmapCaption: '{measure} · строк: {rows} × столбцов: {columns} · {note}', heatmapTruncatedNote: 'пустые ячейки могут быть за пределами сохранённого результата', heatmapCompleteNote: 'для пустых ячеек не было возвращённых групп', scatterNeedsTwoNumeric: 'Для диаграммы рассеяния нужны два числовых столбца. Выберите другой результат или линию/столбцы.', useLineOrBar: 'Выберите другой результат или линию/столбцы.', chooseNumericMeasure: 'Выберите числовую метрику для графика.', chartComparing: 'График «{type}»: сравнение {x} и {y}', oneValue: '1 значение', retainedRows: 'Сохранённых строк: {rows}', populatedCells: 'Заполненных ячеек: {cells} из {rows} строк', rowsSuffix: 'строк', plottedPoints: 'Точек на графике: {points}', sampledRowsSummary: 'Выбрано {sampled} строк из {rows} сохранённых', retainedRowsAcrossOneMeasure: 'Сохранённых строк: {rows} · метрика: 1', retainedRowsAcrossManyMeasures: 'Сохранённых строк: {rows} · метрик: {measures}',
    },
};

const exampleCommonTranslations: Record<Exclude<Locale, 'en'>, Pick<Copy['common'],
    'exampleCharts' | 'exampleChartTable' | 'exampleChartNumber' | 'exampleChartLine' | 'exampleChartBar' | 'exampleChartScatter' | 'exampleChartHeatmap' | 'examplePreviewTable' | 'exampleReadRows'>> = {
    de: {
        exampleCharts: 'Diagramme', exampleChartTable: 'Tabelle', exampleChartNumber: 'Zahl', exampleChartLine: 'Liniendiagramm',
        exampleChartBar: 'Balkendiagramm', exampleChartScatter: 'Streudiagramm', exampleChartHeatmap: 'Heatmap',
        examplePreviewTable: 'Vorschau: {table}', exampleReadRows: 'Bis zu 50 Zeilen aus dieser Tabelle lesen.',
    },
    es: {
        exampleCharts: 'Gráficos', exampleChartTable: 'Tabla', exampleChartNumber: 'Número', exampleChartLine: 'Gráfico de líneas',
        exampleChartBar: 'Gráfico de barras', exampleChartScatter: 'Gráfico de dispersión', exampleChartHeatmap: 'Mapa de calor',
        examplePreviewTable: 'Vista previa: {table}', exampleReadRows: 'Leer hasta 50 filas de esta tabla.',
    },
    nl: {
        exampleCharts: 'Grafieken', exampleChartTable: 'Tabel', exampleChartNumber: 'Getal', exampleChartLine: 'Lijndiagram',
        exampleChartBar: 'Staafdiagram', exampleChartScatter: 'Spreidingsdiagram', exampleChartHeatmap: 'Heatmap',
        examplePreviewTable: 'Voorbeeld van {table}', exampleReadRows: 'Lees maximaal 50 rijen uit deze tabel.',
    },
    zh: {
        exampleCharts: '图表', exampleChartTable: '表格', exampleChartNumber: '数值', exampleChartLine: '折线图',
        exampleChartBar: '柱状图', exampleChartScatter: '散点图', exampleChartHeatmap: '热力图',
        examplePreviewTable: '预览：{table}', exampleReadRows: '读取此表最多 50 行。',
    },
    ru: {
        exampleCharts: 'Графики', exampleChartTable: 'Таблица', exampleChartNumber: 'Число', exampleChartLine: 'Линейный график',
        exampleChartBar: 'Столбчатая диаграмма', exampleChartScatter: 'Диаграмма рассеяния', exampleChartHeatmap: 'Тепловая карта',
        examplePreviewTable: 'Просмотр: {table}', exampleReadRows: 'Прочитать до 50 строк из этой таблицы.',
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
    const values = translated as Record<string, unknown>;
    for (const key of Object.keys(englishSection)) {
        const value = values[key];
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
        common: { ...mergeSection(english.common, translated), ...exampleCommonTranslations[locale] },
        chart: mergeSection(english.chart, translated),
    };
}
