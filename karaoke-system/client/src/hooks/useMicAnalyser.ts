import { useCallback, useRef, useState } from 'react';
import { detectPitch, frequencyToNote } from '../utils/pitchDetect';

export interface LiveVoiceReading {
  frequency: number | null;
  note: string | null;
  clarity: number;
  rms: number;
}

interface UseMicAnalyserOptions {
  onFrame?: (reading: LiveVoiceReading) => void;
}

export function useMicAnalyser(options: UseMicAnalyserOptions = {}) {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<LiveVoiceReading>({
    frequency: null,
    note: null,
    clarity: 0,
    rms: 0,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const onFrameRef = useRef(options.onFrame);
  onFrameRef.current = options.onFrame;

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setIsActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);

      const loop = () => {
        analyser.getFloatTimeDomainData(buffer);
        const result = detectPitch(buffer, audioCtx.sampleRate);
        const next: LiveVoiceReading = {
          frequency: result.frequency,
          note: result.frequency ? frequencyToNote(result.frequency) : null,
          clarity: result.clarity,
          rms: result.rms,
        };
        setReading(next);
        onFrameRef.current?.(next);
        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
      setIsActive(true);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível acessar o microfone.'
      );
      setIsActive(false);
    }
  }, []);

  return { start, stop, isActive, error, reading };
}
