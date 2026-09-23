import type { Connection, Principal } from '../shared/types';

export type Connected = Connection & { trusted: boolean };
export type Session = { principal: Principal | null; requiresLogin: boolean; demo: boolean };
export type Inspector = 'schema' | 'history' | 'documents' | 'details' | 'profile' | 'pipeline' | 'assistant';
export type ResultsView = 'results' | 'chart' | 'insights';
export type BusyAction = 'run' | 'script' | 'save' | 'ai' | '';
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
export type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
