import type { SessionResult } from '../types';

function ResultCard({
  name,
  finalScore,
  category,
  accuracyPercent,
  highlight,
}: {
  name: string;
  finalScore: number;
  category: string;
  accuracyPercent: number;
  highlight: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl px-10 py-8 border ${
        highlight
          ? 'border-amber-300/60 bg-amber-300/10'
          : 'border-white/10 bg-white/5'
      }`}
    >
      {highlight && <span className="text-amber-300 text-xs font-bold uppercase">Vencedor</span>}
      <span className="text-white/60">{name}</span>
      <span className="text-6xl font-extrabold">{finalScore}</span>
      <span className="text-lg font-semibold">{category}</span>
      <span className="text-xs text-white/40">{accuracyPercent}% de precisão</span>
    </div>
  );
}

export function TvResult({ result }: { result: SessionResult }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-8">
      <h2 className="text-2xl text-white/60">Resultado</h2>
      <div className="flex gap-8">
        <ResultCard
          {...result.singerA}
          highlight={result.winner === 'A'}
        />
        {result.singerB && (
          <ResultCard
            {...result.singerB}
            highlight={result.winner === 'B'}
          />
        )}
      </div>
      {result.winner === 'draw' && (
        <p className="text-white/50 text-sm">Empate! Os dois mandaram bem 🎤</p>
      )}
      <p className="text-white/30 text-xs">Voltando para a fila...</p>
    </div>
  );
}
