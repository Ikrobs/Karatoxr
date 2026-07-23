import type { SessionSummary } from '../types';
import { QrCard } from './QrCard';

interface Props {
  queue: SessionSummary[];
  onStartNext: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  waiting_opponent: 'Aguardando oponente',
  queued: 'Na fila',
};

export function TvQueue({ queue, onStartNext }: Props) {
  const ready = queue.filter((s) => s.status === 'queued');
  const waiting = queue.filter((s) => s.status === 'waiting_opponent');
  const canStart = ready.length > 0;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-10 px-8 py-10">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
          KaraTox Pro
        </h1>
        <p className="text-white/50 mt-2">Escaneie o QR Code no celular para entrar na fila</p>
      </div>

      <div className="flex items-start gap-12">
        <QrCard />

        <div className="w-80">
          <h2 className="text-sm uppercase tracking-wide text-white/40 mb-3">
            Fila ({ready.length})
          </h2>
          <div className="flex flex-col gap-2 mb-6 min-h-[3rem]">
            {ready.length === 0 && (
              <p className="text-white/30 text-sm">Ninguém na fila ainda.</p>
            )}
            {ready.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-2.5"
              >
                <span className="text-sm font-medium">
                  {i + 1}. {s.singerA}
                  {s.singerB ? ` vs ${s.singerB}` : ''}
                </span>
                <span className="text-xs text-white/40">{s.song?.title ?? '—'}</span>
              </div>
            ))}
          </div>

          {waiting.length > 0 && (
            <>
              <h2 className="text-sm uppercase tracking-wide text-white/40 mb-3">
                Aguardando oponente
              </h2>
              <div className="flex flex-col gap-2 mb-6">
                {waiting.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-white/5 border border-dashed border-white/10 rounded-lg px-4 py-2.5"
                  >
                    <span className="text-sm text-white/60">{s.singerA}</span>
                    <span className="text-xs text-white/30">{STATUS_LABEL[s.status]}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <button
            onClick={onStartNext}
            disabled={!canStart}
            className="w-full rounded-lg py-3 font-semibold bg-gradient-to-r from-fuchsia-500 to-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition"
          >
            Play
          </button>
        </div>
      </div>
    </div>
  );
}
