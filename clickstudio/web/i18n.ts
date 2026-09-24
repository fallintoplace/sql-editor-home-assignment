import type { SelectOption } from './workspace-types';

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
        examples: string;
        sqlExamples: string;
        examplesHint: string;
        closeExamples: string;
        exampleCategories: string;
        allExamples: string;
        exampleBasics: string;
        exampleAggregation: string;
        exampleTimeSeries: string;
        exampleSchema: string;
        searchExamples: string;
        noExamplesFound: string;
        openInNewSql: string;
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
        examples: 'Examples',
        sqlExamples: 'SQL examples',
        examplesHint: 'Choose a query to preview it. It opens in a new tab and does not run automatically.',
        closeExamples: 'Close SQL examples',
        exampleCategories: 'Example categories',
        allExamples: 'All',
        exampleBasics: 'Basics',
        exampleAggregation: 'Aggregations',
        exampleTimeSeries: 'Time series',
        exampleSchema: 'Your tables',
        searchExamples: 'Search examples',
        noExamplesFound: 'No examples match your search.',
        openInNewSql: 'Open in new SQL',
    },
};

const translations: Record<Exclude<Locale, 'en'>, Partial<Copy['app'] & Copy['common'] & Copy['auth']>> = {
    de: { language: 'Sprache', theme: 'Thema', beginner: 'Kompakt', expert: 'Erweitert', run: 'Ausführen', runStatement: 'Abfrage ausführen', cancel: 'Abbrechen', save: 'Speichern', saveRevision: 'Revision speichern', schema: 'Schema', history: 'Läufe', assistant: 'KI', results: 'Ergebnisse', chart: 'Diagramm', insights: 'Einblicke', newSql: 'Neue SQL-Abfrage', examples: 'Beispiele', sqlExamples: 'SQL-Beispiele', examplesHint: 'Abfrage auswählen und Vorschau ansehen. Sie wird in einem neuen Tab geöffnet und nicht automatisch ausgeführt.', closeExamples: 'SQL-Beispiele schließen', exampleCategories: 'Beispielkategorien', allExamples: 'Alle', exampleBasics: 'Grundlagen', exampleAggregation: 'Aggregationen', exampleTimeSeries: 'Zeitreihen', exampleSchema: 'Ihre Tabellen', searchExamples: 'Beispiele suchen', noExamplesFound: 'Keine passenden Beispiele gefunden.', openInNewSql: 'In neuem SQL öffnen', open: 'Arbeitsbereich öffnen', opening: 'Arbeitsbereich wird geöffnet…' },
    es: { language: 'Idioma', theme: 'Tema', beginner: 'Compacto', expert: 'Avanzado', run: 'Ejecutar', runStatement: 'Ejecutar consulta', cancel: 'Cancelar', save: 'Guardar', saveRevision: 'Guardar revisión', schema: 'Esquema', history: 'Historial', assistant: 'IA', results: 'Resultados', chart: 'Gráfico', insights: 'Insights', newSql: 'Nuevo SQL', examples: 'Ejemplos', sqlExamples: 'Ejemplos SQL', examplesHint: 'Elige una consulta para verla. Se abrirá en una pestaña nueva y no se ejecutará automáticamente.', closeExamples: 'Cerrar ejemplos SQL', exampleCategories: 'Categorías de ejemplos', allExamples: 'Todos', exampleBasics: 'Conceptos básicos', exampleAggregation: 'Agregaciones', exampleTimeSeries: 'Series temporales', exampleSchema: 'Tus tablas', searchExamples: 'Buscar ejemplos', noExamplesFound: 'No hay ejemplos que coincidan.', openInNewSql: 'Abrir en un SQL nuevo', open: 'Abrir espacio', opening: 'Abriendo espacio…' },
    nl: { language: 'Taal', theme: 'Thema', beginner: 'Compact', expert: 'Geavanceerd', run: 'Uitvoeren', runStatement: 'Query uitvoeren', cancel: 'Annuleren', save: 'Opslaan', saveRevision: 'Revisie opslaan', schema: 'Schema', history: 'Runs', assistant: 'AI', results: 'Resultaten', chart: 'Grafiek', insights: 'Inzichten', newSql: 'Nieuwe SQL', examples: 'Voorbeelden', sqlExamples: 'SQL-voorbeelden', examplesHint: 'Kies een query om een voorbeeld te bekijken. Deze opent in een nieuw tabblad en wordt niet automatisch uitgevoerd.', closeExamples: 'SQL-voorbeelden sluiten', exampleCategories: 'Voorbeeldcategorieën', allExamples: 'Alle', exampleBasics: 'Basis', exampleAggregation: 'Aggregaties', exampleTimeSeries: 'Tijdreeksen', exampleSchema: 'Jouw tabellen', searchExamples: 'Voorbeelden zoeken', noExamplesFound: 'Geen voorbeelden gevonden.', openInNewSql: 'Openen in nieuwe SQL', open: 'Werkruimte openen', opening: 'Werkruimte openen…' },
    zh: { language: '语言', theme: '主题', beginner: '紧凑', expert: '高级', run: '运行', runStatement: '运行查询', cancel: '取消', save: '保存', saveRevision: '保存修订', schema: '架构', history: '运行记录', assistant: 'AI', results: '结果', chart: '图表', insights: '洞察', newSql: '新建 SQL', examples: '示例', sqlExamples: 'SQL 示例', examplesHint: '选择查询预览。它会在新标签页打开，不会自动运行。', closeExamples: '关闭 SQL 示例', exampleCategories: '示例类别', allExamples: '全部', exampleBasics: '基础', exampleAggregation: '聚合', exampleTimeSeries: '时间序列', exampleSchema: '你的表', searchExamples: '搜索示例', noExamplesFound: '没有匹配的示例。', openInNewSql: '在新 SQL 中打开', open: '打开工作区', opening: '正在打开工作区…' },
    ru: { language: 'Язык', theme: 'Тема', beginner: 'Компактный', expert: 'Расширенный', run: 'Запустить', runStatement: 'Выполнить запрос', cancel: 'Отмена', save: 'Сохранить', saveRevision: 'Сохранить ревизию', schema: 'Схема', history: 'Запуски', assistant: 'ИИ', results: 'Результаты', chart: 'График', insights: 'Инсайты', newSql: 'Новый SQL', examples: 'Примеры', sqlExamples: 'Примеры SQL', examplesHint: 'Выберите запрос для просмотра. Он откроется в новой вкладке и не запустится автоматически.', closeExamples: 'Закрыть примеры SQL', exampleCategories: 'Категории примеров', allExamples: 'Все', exampleBasics: 'Основы', exampleAggregation: 'Агрегации', exampleTimeSeries: 'Временные ряды', exampleSchema: 'Ваши таблицы', searchExamples: 'Поиск примеров', noExamplesFound: 'Подходящих примеров нет.', openInNewSql: 'Открыть в новом SQL', open: 'Открыть рабочую область', opening: 'Открытие рабочей области…' },
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

export function getCopy(locale: Locale): Copy {
    if (locale === 'en') return english;
    const translated = translations[locale];
    return {
        app: { ...english.app, ...translated },
        auth: { ...english.auth, ...translated },
        common: { ...english.common, ...translated },
    };
}
