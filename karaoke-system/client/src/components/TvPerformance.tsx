import { useEffect, useRef, useState } from 'react';
import type { ActiveSessionPayload } from '../types';
import { assetUrl } from '../lib/api';
import { activeLineIndex } from '../utils/lrcParser';

interface LiveScores {
  singerA: { score: number; combo: number };
  singerB: { score: number; combo: number } | null;
}

interface Props {
  session: ActiveSessionPayload;
  live: LiveScores | null;
  onEnded: () => void;
}

function ScoreGauge({ label, score, combo }: { label: string; score: number; combo: number }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-6 py-4 min-w-[220px]">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-4xl font-extrabold tabular-nums">{score}</span>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all duration-150"
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      {combo > 1 && <span className="text-xs text-amber-300 font-semibold">combo x{combo}</span>}
    </div>
  );
}

export function TvPerformance({ session, live, onEnded }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!session.startAt) return;
    const tick = () => {
      const msLeft = session.startAt! - Date.now();
      if (msLeft <= 0) {
        setCountdown(null);
        audioRef.current?.play().catch(() => {});
      } else {
        setCountdown(Math.ceil(msLeft / 1000));
        requestAnimationFrame(tick);
      }
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [session.startAt]);

  const lines = session.lyrics;
  const idx = activeLineIndex(lines, currentTime);

  return (
    <div className="min-h-dvh flex flex-col">
      <audio
        ref={audioRef}
        src={session.song ? assetUrl(session.song.audioUrl) : undefined}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={onEnded}
      />

      <div className="flex items-center justify-between px-8 pt-6 text-white/50 text-sm">
        <span>{session.song?.title}</span>
        <span>{session.song?.artist}</span>
      </div>

      {countdown !== null ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-9xl font-extrabold bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
            {countdown}
          </span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-10">
          {lines.length === 0 ? (
            <p className="text-white/30 text-lg">🎤 Cantando... (sem letra sincronizada)</p>
          ) : (
            [idx - 1, idx, idx + 1].map((i, slot) => {
              const line = lines[i];
              return (
                <p
                  key={slot}
                  className={
                    i === idx
                      ? 'text-4xl font-bold text-center bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-transparent'
                      : 'text-2xl text-center text-white/25'
                  }
                >
                  {line?.text || '\u266A'}
                </p>
              );
            })
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-6 pb-10">
        <ScoreGauge
          label={session.singerA.name}
          score={live?.singerA.score ?? 0}
          combo={live?.singerA.combo ?? 0}
        />
        {session.singerB && (
          <ScoreGauge
            label={session.singerB.name}
            score={live?.singerB?.score ?? 0}
            combo={live?.singerB?.combo ?? 0}
          />
        )}
      </div>
    </div>
  );
}
