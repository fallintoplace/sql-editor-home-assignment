import type { Connection, Principal } from '../shared/types.js';

export type Connected = Connection & { trusted: boolean };
export type Session = { principal: Principal | null; requiresLogin: boolean; demo: boolean };
export type Inspector = 'schema' | 'history' | 'documents' | 'revisions' | 'details' | 'profile' | 'pipeline' | 'parser' | 'assistant';
export type ResultsView = 'results' | 'chart' | 'insights' | 'sqlmap' | 'plan' | 'pipeline';
export type BusyAction = 'run' | 'script' | 'save' | '';
export type RunEventState = 'idle' | 'live' | 'reconnecting';
export type SelectOption<Value extends string> = { value: Value; label: string };
export type AssistantContext = { id: string; summary: string[]; key: string };

export type SpeechRecognitionLike = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
};
export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
}
