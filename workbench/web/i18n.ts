export type Locale = 'en' | 'de' | 'es' | 'nl' | 'zh' | 'ru';
export type Theme = 'monokai' | 'catppuccin-latte';
export type ExperienceLevel = 'beginner' | 'expert';

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
        cancel: string;
        save: string;
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
        beginner: 'Beginner',
        expert: 'Expert',
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
        cancel: 'Cancel',
        save: 'Save',
        schema: 'Schema',
        history: 'Runs',
        assistant: 'AI',
        results: 'Results',
        chart: 'Chart',
        insights: 'Insights',
    },
};

const translations: Record<Exclude<Locale, 'en'>, Partial<Copy['app'] & Copy['common'] & Copy['auth']>> = {
    de: { language: 'Sprache', theme: 'Thema', beginner: 'Anfänger', expert: 'Experte', run: 'Ausführen', cancel: 'Abbrechen', save: 'Speichern', schema: 'Schema', history: 'Läufe', assistant: 'KI', results: 'Ergebnisse', chart: 'Diagramm', insights: 'Einblicke', open: 'Arbeitsbereich öffnen', opening: 'Arbeitsbereich wird geöffnet…' },
    es: { language: 'Idioma', theme: 'Tema', beginner: 'Principiante', expert: 'Experto', run: 'Ejecutar', cancel: 'Cancelar', save: 'Guardar', schema: 'Esquema', history: 'Historial', assistant: 'IA', results: 'Resultados', chart: 'Gráfico', insights: 'Insights', open: 'Abrir espacio', opening: 'Abriendo espacio…' },
    nl: { language: 'Taal', theme: 'Thema', beginner: 'Beginner', expert: 'Expert', run: 'Uitvoeren', cancel: 'Annuleren', save: 'Opslaan', schema: 'Schema', history: 'Runs', assistant: 'AI', results: 'Resultaten', chart: 'Grafiek', insights: 'Inzichten', open: 'Werkruimte openen', opening: 'Werkruimte openen…' },
    zh: { language: '语言', theme: '主题', beginner: '入门', expert: '专家', run: '运行', cancel: '取消', save: '保存', schema: '架构', history: '运行记录', assistant: 'AI', results: '结果', chart: '图表', insights: '洞察', open: '打开工作区', opening: '正在打开工作区…' },
    ru: { language: 'Язык', theme: 'Тема', beginner: 'Начальный', expert: 'Эксперт', run: 'Запустить', cancel: 'Отмена', save: 'Сохранить', schema: 'Схема', history: 'Запуски', assistant: 'ИИ', results: 'Результаты', chart: 'График', insights: 'Инсайты', open: 'Открыть рабочую область', opening: 'Открытие рабочей области…' },
};

export const localeOptions: Array<{ value: Locale; label: string }> = [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
    { value: 'nl', label: 'Nederlands' },
    { value: 'zh', label: '中文' },
    { value: 'ru', label: 'Русский' },
];

export const themeOptions: Array<{ value: Theme; label: string }> = [
    { value: 'monokai', label: 'Monokai' },
    { value: 'catppuccin-latte', label: 'Catppuccin Latte' },
];

export const experienceOptions = (copy: Copy): Array<{ value: ExperienceLevel; label: string }> => [
    { value: 'beginner', label: copy.app.beginner },
    { value: 'expert', label: copy.app.expert },
];

export function getCopy(locale: Locale): Copy {
    if (locale === 'en') return english;
    const translated = translations[locale];
    return {
        app: { ...english.app, ...translated },
        auth: { ...english.auth, ...translated },
        common: { ...english.common, ...translated },
    };
}
