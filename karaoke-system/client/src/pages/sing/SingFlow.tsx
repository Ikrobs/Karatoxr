import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSocket } from '../../lib/useSocket';
import { fetchSongs } from '../../lib/api';
import { useMicAnalyser } from '../../hooks/useMicAnalyser';
import { BigButton } from '../../components/BigButton';
import { activeLineIndex } from '../../utils/lrcParser';
import type { LyricLine, Song, SessionResult, SessionStatus } from '../../types';

type Step =
  | 'name'
  | 'mode'
  | 'soloSongList'
  | 'duelChoice'
  | 'duelSongList'
  | 'duelJoinList'
  | 'waiting'
  | 'countdown'
  | 'performing'
  | 'result';

interface OpenDuel {
  sessionId: string;
  hostName: string;
  song: { id: string; title: string; artist: string } | null;
}

export function SingFlow() {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoaded, setSongsLoaded] = useState(false);
  const [openDuels, setOpenDuels] = useState<OpenDuel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mySlot, setMySlot] = useState<'A' | 'B' | null>(null);
  const [waitingStatus, setWaitingStatus] = useState<SessionStatus | null>(null);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [liveMine, setLiveMine] = useState<{ score: number; combo: number } | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);

  // letra sincronizada
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [songTime, setSongTime] = useState(0);

  const sessionIdRef = useRef<string | null>(null);
  const mySlotRef = useRef<'A' | 'B' | null>(null);
  const startAtRef = useRef<number | null>(null);
  sessionIdRef.current = sessionId;
  mySlotRef.current = mySlot;
  startAtRef.current = startAt;

  // loop de tempo local — calcula songTime pelo relógio, igual à TV
  useEffect(() => {
    if (step !== 'performing') return;
    let raf: number;
    const tick = () => {
      if (startAtRef.current) {
        setSongTime((Date.now() - startAtRef.current) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  function onMessage(msg: any) {
    switch (msg.type) {
      case 'session:created':
        setSessionId(msg.session.id);
        setMySlot(msg.slot);
        setWaitingStatus(msg.session.status);
        setStep('waiting');
        break;
      case 'session:joined':
        setSessionId(msg.session.id);
        setMySlot(msg.slot);
        setWaitingStatus(msg.session.status);
        setStep('waiting');
        break;
      case 'session:opponentJoined':
        if (msg.session.id === sessionIdRef.current) {
          setWaitingStatus(msg.session.status);
        }
        break;
      case 'openDuels':
        setOpenDuels(msg.duels);
        break;
      case 'session:countdown':
        if (msg.session.id === sessionIdRef.current) {
          setStartAt(msg.session.startAt);
          setLyrics(msg.session.lyrics ?? []);
          setSongTime(0);
          setStep('countdown');
          startMic();
        }
        break;
      case 'live':
        if (msg.sessionId === sessionIdRef.current) {
          const mine = mySlotRef.current === 'B' ? msg.singerB : msg.singerA;
          if (mine) setLiveMine(mine);
        }
        break;
      case 'session:end':
        setResult(msg.result);
        setStep('result');
        stopMic();
        break;
      case 'error':
        setError(msg.message);
        break;
    }
  }

  const { send } = useSocket(onMessage);
  const { start, stop, reading } = useMicAnalyser({
    onFrame: (r) => {
      if (!sessionIdRef.current) return;
      send({
        type: 'frame',
        sessionId: sessionIdRef.current,
        volume: r.rms,
        clarity: r.clarity,
      });
    },
  });

  function startMic() { start(); }
  function stopMic() { stop(); }

  // contagem regressiva
  useEffect(() => {
    if (!startAt) return;
    let raf: number;
    const tick = () => {
      const msLeft = startAt - Date.now();
      if (msLeft <= 0) {
        setCountdown(null);
        setStep('performing');
      } else {
        setCountdown(Math.ceil(msLeft / 1000));
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startAt]);

  async function loadSongsIfNeeded() {
    if (songsLoaded) return;
    try {
      setSongs(await fetchSongs());
    } catch {
      setError('Não consegui carregar a lista de músicas.');
    } finally {
      setSongsLoaded(true);
    }
  }

  function reset() {
    setStep('mode');
    setSessionId(null);
    setMySlot(null);
    setStartAt(null);
    setCountdown(null);
    setLiveMine(null);
    setResult(null);
    setWaitingStatus(null);
    setLyrics([]);
    setSongTime(0);
    setError(null);
  }

  // ---- step renders --------------------------------------------------

  if (step === 'name') {
    return (
      <Screen title="KaraTox Pro" subtitle="Digite seu nome para começar">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-3 outline-none focus:border-fuchsia-400/60 text-center text-lg"
          autoFocus
        />
        <BigButton disabled={!name.trim()} onClick={() => setStep('mode')}>
          Continuar
        </BigButton>
      </Screen>
    );
  }

  if (step === 'mode') {
    return (
      <Screen title={`Fala, ${name}!`} subtitle="Como você quer cantar?">
        <BigButton
          onClick={() => {
            loadSongsIfNeeded();
            setStep('soloSongList');
          }}
        >
          Cantar solo
        </BigButton>
        <BigButton variant="secondary" onClick={() => setStep('duelChoice')}>
          Batalha de dois
        </BigButton>
      </Screen>
    );
  }

  if (step === 'duelChoice') {
    return (
      <Screen title="Batalha de dois" subtitle="Criar uma batalha ou entrar em uma existente?">
        <BigButton
          onClick={() => {
            loadSongsIfNeeded();
            setStep('duelSongList');
          }}
        >
          Criar batalha (escolher música)
        </BigButton>
        <BigButton
          variant="secondary"
          onClick={() => {
            send({ type: 'singer:listOpenDuels' });
            setStep('duelJoinList');
          }}
        >
          Entrar em batalha existente
        </BigButton>
        <BigButton variant="secondary" onClick={() => setStep('mode')}>
          Voltar
        </BigButton>
      </Screen>
    );
  }

  if (step === 'soloSongList' || step === 'duelSongList') {
    return (
      <Screen title="Escolha a música" subtitle={`${songs.length} disponíveis`}>
        <SongList
          songs={songs}
          loaded={songsLoaded}
          onPick={(songId) => {
            setError(null);
            send({
              type: step === 'soloSongList' ? 'singer:createSolo' : 'singer:createDuel',
              name,
              songId,
            });
          }}
        />
        <BigButton variant="secondary" onClick={() => setStep(step === 'soloSongList' ? 'mode' : 'duelChoice')}>
          Voltar
        </BigButton>
      </Screen>
    );
  }

  if (step === 'duelJoinList') {
    return (
      <Screen title="Batalhas abertas" subtitle="Escolha uma para entrar">
        <div className="flex flex-col gap-2">
          {openDuels.length === 0 && (
            <p className="text-white/40 text-sm text-center py-4">
              Nenhuma batalha esperando oponente agora.
            </p>
          )}
          {openDuels.map((d) => (
            <button
              key={d.sessionId}
              onClick={() => send({ type: 'singer:joinDuel', sessionId: d.sessionId, name })}
              className="text-left bg-white/5 border border-white/10 rounded-lg px-4 py-3 active:scale-[0.98] transition"
            >
              <p className="font-medium">{d.hostName}</p>
              <p className="text-xs text-white/40">{d.song?.title ?? '—'}</p>
            </button>
          ))}
        </div>
        <BigButton
          variant="secondary"
          onClick={() => send({ type: 'singer:listOpenDuels' })}
        >
          Atualizar lista
        </BigButton>
        <BigButton variant="secondary" onClick={() => setStep('duelChoice')}>
          Voltar
        </BigButton>
      </Screen>
    );
  }

  if (step === 'waiting') {
    return (
      <Screen
        title={waitingStatus === 'waiting_opponent' ? 'Aguardando oponente...' : 'Você está na fila!'}
        subtitle="Olhe para a tela principal — você será chamado em breve"
      >
        <div className="flex items-center justify-center py-6">
          <span className="animate-pulse text-5xl">🎤</span>
        </div>
      </Screen>
    );
  }

  if (step === 'countdown') {
    return (
      <Screen title="Prepare-se!" subtitle="A música vai começar">
        <div className="flex items-center justify-center py-6">
          <span className="text-7xl font-extrabold">{countdown ?? '...'}</span>
        </div>
      </Screen>
    );
  }

  if (step === 'performing') {
    const level = Math.min(1, reading.rms * 6);
    const idx = activeLineIndex(lyrics, songTime);

    return (
      <div className="min-h-dvh flex flex-col">
        {/* barra de pontuação no topo */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <span className="text-3xl font-extrabold tabular-nums w-14 text-right">
            {Math.round(liveMine?.score ?? 0)}
          </span>
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all duration-100"
              style={{ width: `${level * 100}%` }}
            />
          </div>
          {liveMine && liveMine.combo > 1 && (
            <span className="text-amber-300 text-sm font-bold">x{liveMine.combo}</span>
          )}
        </div>

        {/* letra sincronizada — ocupa o espaço principal */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          {lyrics.length === 0 ? (
            <p className="text-white/30 text-sm text-center">Sem letra sincronizada</p>
          ) : (
            [idx - 1, idx, idx + 1].map((i, slot) => {
              const line = lyrics[i];
              return (
                <p
                  key={slot}
                  className={
                    i === idx
                      ? 'text-2xl font-bold text-center bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-transparent leading-snug'
                      : 'text-base text-center text-white/30 leading-snug'
                  }
                >
                  {line?.text || '\u266A'}
                </p>
              );
            })
          )}
        </div>

        {/* nota detectada no rodapé */}
        <div className="px-6 pb-6 text-center">
          <span className="text-white/30 text-xs">{reading.note ?? '—'}</span>
        </div>
      </div>
    );
  }

  if (step === 'result' && result) {
    const mine = mySlot === 'B' ? result.singerB : result.singerA;
    const other = mySlot === 'B' ? result.singerA : result.singerB;
    const won =
      (mySlot === 'A' && result.winner === 'A') || (mySlot === 'B' && result.winner === 'B');
    return (
      <Screen
        title={mine?.category ?? ''}
        subtitle={result.mode === 'duel' ? (won ? 'Você venceu! 🎉' : result.winner === 'draw' ? 'Empate!' : 'Não foi dessa vez') : ''}
      >
        <div className="flex flex-col items-center gap-2 py-4">
          <span className="text-7xl font-extrabold">{mine?.finalScore ?? 0}</span>
          <span className="text-white/40 text-sm">{mine?.accuracyPercent ?? 0}% de precisão</span>
          {other && (
            <p className="text-white/40 text-xs mt-3">
              {other.name}: {other.finalScore} pontos
            </p>
          )}
        </div>
        <BigButton onClick={reset}>Cantar de novo</BigButton>
      </Screen>
    );
  }

  return (
    <Screen title="Carregando..." subtitle="">
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </Screen>
  );
}

function SongList({
  songs,
  loaded,
  onPick,
}: {
  songs: Song[];
  loaded: boolean;
  onPick: (songId: string) => void;
}) {
  if (!loaded) return <p className="text-white/40 text-sm text-center py-4">Carregando...</p>;
  if (songs.length === 0)
    return (
      <p className="text-white/40 text-sm text-center py-4">
        Nenhuma música cadastrada. Peça para o operador adicionar no painel admin.
      </p>
    );
  return (
    <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
      {songs.map((s) => (
        <button
          key={s.id}
          onClick={() => onPick(s.id)}
          className="text-left bg-white/5 border border-white/10 rounded-lg px-4 py-3 active:scale-[0.98] transition"
        >
          <p className="font-medium">{s.title}</p>
          <p className="text-xs text-white/40">
            {s.artist} {s.difficulty ? `· ${s.difficulty}` : ''}
          </p>
        </button>
      ))}
    </div>
  );
}

function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col justify-center px-6 py-10 gap-5 max-w-sm mx-auto w-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-white/50 mt-1">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}