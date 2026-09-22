import { useEffect, useRef, useState } from 'react';
import type { Run } from '../../shared/types';
import type { Copy } from '../i18n';
import { api, message, post } from '../api';
import { Action, Callout } from '../ui';

type VoiceState = 'idle' | 'connecting' | 'connected' | 'finishing' | 'error';
type Speaker = 'you' | 'assistant';
interface TranscriptLine {
    id: number;
    speaker: Speaker;
    text: string;
}
interface VoiceResponse {
    sdp: string;
    model: string;
}
interface VoiceStatus {
    available: boolean;
    model: string;
    reason?: string;
}

const eventText = (event: Record<string, unknown>) => typeof event.transcript === 'string' ? event.transcript : typeof event.delta === 'string' ? event.delta : undefined;
const waitForIce = (peer: RTCPeerConnection) => new Promise<void>((resolve, reject) => {
    if (peer.iceGatheringState === 'complete') {
        resolve();
        return;
    }
    const timeout = window.setTimeout(() => {
        peer.removeEventListener('icegatheringstatechange', onState);
        reject(new Error('Timed out while preparing the voice connection'));
    }, 10000);
    function onState() {
        if (peer.iceGatheringState !== 'complete')
            return;
        window.clearTimeout(timeout);
        peer.removeEventListener('icegatheringstatechange', onState);
        resolve();
    }
    peer.addEventListener('icegatheringstatechange', onState);
});

export function VoiceSession({ connectionId, sql, run, trusted, copy }: {
    connectionId: string;
    sql: string;
    run?: Run;
    trusted: boolean;
    copy: Copy;
}) {
    const [state, setState] = useState<VoiceState>('idle'), [error, setError] = useState(''), [lines, setLines] = useState<TranscriptLine[]>([]), [model, setModel] = useState('');
    const peer = useRef<RTCPeerConnection | undefined>(undefined), microphone = useRef<MediaStream | undefined>(undefined), channel = useRef<RTCDataChannel | undefined>(undefined), audio = useRef<HTMLAudioElement>(null), closeTimer = useRef<number | undefined>(undefined), nextLine = useRef(0), stateRef = useRef<VoiceState>('idle');
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | undefined>(undefined);
    const currentAssistant = useRef<number | undefined>(undefined);
    const currentUser = useRef<number | undefined>(undefined);
    useEffect(() => {
        let cancelled = false;
        void api<VoiceStatus>('/voice/status').then(value => { if (!cancelled) { setVoiceStatus(value); setModel(value.model); } }).catch(e => { if (!cancelled) setError(message(e)); });
        return () => { cancelled = true; cleanup(false); };
    }, []);
    const setVoiceState = (next: VoiceState) => { stateRef.current = next; setState(next); };
    const cleanup = (resetState = true) => {
        if (closeTimer.current !== undefined)
            window.clearTimeout(closeTimer.current);
        closeTimer.current = undefined;
        microphone.current?.getTracks().forEach(track => track.stop());
        microphone.current = undefined;
        channel.current?.close();
        channel.current = undefined;
        peer.current?.close();
        peer.current = undefined;
        if (audio.current)
            audio.current.srcObject = null;
        if (resetState)
            setVoiceState('idle');
    };
    const addTranscript = (speaker: Speaker, text: string, append: boolean, replaceId?: number) => {
        const normalized = text.trim();
        if (!normalized)
            return;
        setLines(previous => {
            const target = replaceId ?? (speaker === 'assistant' ? currentAssistant.current : currentUser.current);
            if (target !== undefined) {
                const index = previous.findIndex(line => line.id === target);
                if (index >= 0) {
                    const next = [...previous];
                    next[index] = { ...next[index]!, text: append ? `${next[index]!.text}${text}` : normalized };
                    return next;
                }
            }
            const id = nextLine.current++;
            if (speaker === 'assistant')
                currentAssistant.current = id;
            else
                currentUser.current = id;
            return [...previous, { id, speaker, text: normalized }];
        });
    };
    const handleEvent = (event: Record<string, unknown>) => {
        const type = typeof event.type === 'string' ? event.type : '';
        if (type === 'session.created' || type === 'session.started') {
            setVoiceState('connected');
            return;
        }
        if (type === 'session.closed') {
            cleanup();
            return;
        }
        if (type === 'error') {
            const detail = event.error && typeof event.error === 'object' ? event.error as Record<string, unknown> : undefined;
            setError(String(detail?.message ?? 'The voice session returned an error'));
            setVoiceState('error');
            return;
        }
        const text = eventText(event);
        if (!text)
            return;
        if (type.includes('input_audio_transcription') || type === 'session.input_transcript.delta') {
            addTranscript('you', text, type.endsWith('.delta'));
            return;
        }
        if (type.includes('audio_transcript') || type === 'session.output_transcript.delta')
            addTranscript('assistant', text, type.endsWith('.delta'));
    };
    const start = async () => {
        if (!trusted || !voiceStatus?.available || stateRef.current !== 'idle')
            return;
        setError('');
        setLines([]);
        currentAssistant.current = undefined;
        currentUser.current = undefined;
        setVoiceState('connecting');
        try {
            const nextPeer = new RTCPeerConnection();
            peer.current = nextPeer;
            nextPeer.addEventListener('track', event => {
                if (!audio.current)
                    return;
                audio.current.srcObject = event.streams[0] ?? new MediaStream([event.track]);
                void audio.current.play().catch(() => undefined);
            });
            const nextMicrophone = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphone.current = nextMicrophone;
            for (const track of nextMicrophone.getAudioTracks())
                nextPeer.addTrack(track, nextMicrophone);
            const nextChannel = nextPeer.createDataChannel('oai-events');
            channel.current = nextChannel;
            nextChannel.addEventListener('message', event => {
                try {
                    handleEvent(JSON.parse(event.data) as Record<string, unknown>);
                }
                catch {
                    setError('The voice session returned an unreadable event');
                }
            });
            const offer = await nextPeer.createOffer();
            await nextPeer.setLocalDescription(offer);
            await waitForIce(nextPeer);
            const sdp = nextPeer.localDescription?.sdp;
            if (!sdp)
                throw new Error('The browser did not create a voice offer');
            const context = JSON.stringify({ sql: sql.slice(0, 100000), run: run ? { queryId: run.queryId, status: run.status, elapsedMs: run.elapsedMs, rowCount: run.rowCount, error: run.error?.message } : undefined });
            const response = await post<VoiceResponse>('/voice/session', { connectionId, sdp, context });
            setModel(response.model);
            await nextPeer.setRemoteDescription({ type: 'answer', sdp: response.sdp });
        }
        catch (e) {
            setError(e instanceof DOMException && e.name === 'NotAllowedError' ? copy.voice.microphoneDenied : message(e));
            cleanup();
            setVoiceState('error');
        }
    };
    const stop = () => {
        if (stateRef.current !== 'connected' || channel.current?.readyState !== 'open') {
            cleanup();
            return;
        }
        setVoiceState('finishing');
        channel.current.send(JSON.stringify({ type: 'session.close' }));
        closeTimer.current = window.setTimeout(() => {
            setError(copy.voice.closeTimeout);
            cleanup();
        }, 15000);
    };
    const quickPrompt = (text: string) => {
        if (stateRef.current !== 'connected' || channel.current?.readyState !== 'open')
            return;
        addTranscript('you', text, false);
        channel.current.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } }));
        channel.current.send(JSON.stringify({ type: 'response.create' }));
    };
    const label = state === 'connecting' ? copy.voice.connecting : state === 'connected' ? copy.voice.connected : state === 'finishing' ? copy.voice.finishing : state === 'error' ? copy.voice.error : copy.voice.ready;
    return <section className="voice-session panel-card" aria-label={copy.voice.title}><div className="toolbar spread"><div><h3>{copy.voice.title}</h3><p className="muted">{copy.voice.description}</p></div><span className={`voice-state ${state}`}>{label}</span></div>
        <div className="toolbar wrap"><Action type={state === 'idle' || state === 'error' ? 'primary' : 'secondary'} disabled={!trusted || !voiceStatus?.available || state === 'connecting' || state === 'finishing'} onClick={() => { if (state === 'connected' || state === 'finishing') stop(); else void start(); }}>{state === 'connected' || state === 'finishing' ? copy.voice.stop : copy.voice.start}</Action>{state === 'connected' && <><Action onClick={() => quickPrompt(copy.voice.explainPrompt)}>{copy.voice.explain}</Action><Action onClick={() => quickPrompt(copy.voice.nextPrompt)}>{copy.voice.next}</Action></>}<span className="muted">{model}</span></div>
        {!trusted && <Callout>{copy.voice.trustFirst}</Callout>}{voiceStatus && !voiceStatus.available && <Callout>{voiceStatus.reason ?? copy.voice.unavailable}</Callout>}{error && <Callout danger>{error}</Callout>}
        {lines.length > 0 ? <div className="voice-transcript" aria-live="polite">{lines.map(line => <p key={line.id}><strong>{line.speaker === 'you' ? copy.voice.you : copy.voice.assistant}:</strong> {line.text}</p>)}</div> : <p className="muted">{copy.voice.empty}</p>}
        <audio ref={audio} className="voice-audio" controls aria-label={copy.voice.audio}/>
    </section>;
}
