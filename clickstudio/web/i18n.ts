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
    },
};

const translations: Record<Exclude<Locale, 'en'>, Partial<Copy['app'] & Copy['common'] & Copy['auth']>> = {
    de: { language: 'Sprache', theme: 'Thema', beginner: 'Kompakt', expert: 'Erweitert', run: 'Ausführen', runStatement: 'Abfrage ausführen', cancel: 'Abbrechen', save: 'Speichern', saveRevision: 'Revision speichern', schema: 'Schema', history: 'Läufe', assistant: 'KI', results: 'Ergebnisse', chart: 'Diagramm', insights: 'Einblicke', open: 'Arbeitsbereich öffnen', opening: 'Arbeitsbereich wird geöffnet…' },
    es: { language: 'Idioma', theme: 'Tema', beginner: 'Compacto', expert: 'Avanzado', run: 'Ejecutar', runStatement: 'Ejecutar consulta', cancel: 'Cancelar', save: 'Guardar', saveRevision: 'Guardar revisión', schema: 'Esquema', history: 'Historial', assistant: 'IA', results: 'Resultados', chart: 'Gráfico', insights: 'Insights', open: 'Abrir espacio', opening: 'Abriendo espacio…' },
    nl: { language: 'Taal', theme: 'Thema', beginner: 'Compact', expert: 'Geavanceerd', run: 'Uitvoeren', runStatement: 'Query uitvoeren', cancel: 'Annuleren', save: 'Opslaan', saveRevision: 'Revisie opslaan', schema: 'Schema', history: 'Runs', assistant: 'AI', results: 'Resultaten', chart: 'Grafiek', insights: 'Inzichten', open: 'Werkruimte openen', opening: 'Werkruimte openen…' },
    zh: { language: '语言', theme: '主题', beginner: '紧凑', expert: '高级', run: '运行', runStatement: '运行查询', cancel: '取消', save: '保存', saveRevision: '保存修订', schema: '架构', history: '运行记录', assistant: 'AI', results: '结果', chart: '图表', insights: '洞察', open: '打开工作区', opening: '正在打开工作区…' },
    ru: { language: 'Язык', theme: 'Тема', beginner: 'Компактный', expert: 'Расширенный', run: 'Запустить', runStatement: 'Выполнить запрос', cancel: 'Отмена', save: 'Сохранить', saveRevision: 'Сохранить ревизию', schema: 'Схема', history: 'Запуски', assistant: 'ИИ', results: 'Результаты', chart: 'График', insights: 'Инсайты', open: 'Открыть рабочую область', opening: 'Открытие рабочей области…' },
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
    { value: 'click-dark', label: '🌙' },
    { value: 'click-light', label: '☀️' },
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
