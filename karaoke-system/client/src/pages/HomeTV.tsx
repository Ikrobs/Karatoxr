import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '../lib/useSocket';
import { TvQueue } from '../components/TvQueue';
import { TvPerformance } from '../components/TvPerformance';
import { TvResult } from '../components/TvResult';
import type { ActiveSessionPayload, SessionResult, SessionSummary } from '../types';

export function HomeTV() {
  const [queue, setQueue] = useState<SessionSummary[]>([]);
  const [active, setActive] = useState<ActiveSessionPayload | null>(null);
  const [live, setLive] = useState<{
    singerA: { score: number; combo: number };
    singerB: { score: number; combo: number } | null;
  } | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);

  const onMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'state':
        setQueue(msg.queue);
        setActive(msg.active);
        if (msg.active) setResult(null);
        break;
      case 'session:countdown':
        setActive(msg.session);
        setLive(null);
        setResult(null);
        break;
      case 'live':
        setLive({ singerA: msg.singerA, singerB: msg.singerB });
        break;
      case 'session:end':
        setResult(msg.result);
        setActive(null);
        setTimeout(() => setResult(null), 8000);
        break;
    }
  }, []);

  const { send } = useSocket(onMessage);

  useEffect(() => {
    send({ type: 'tv:hello' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (result) return <TvResult result={result} />;

  if (active) {
    return (
      <TvPerformance
        session={active}
        live={live}
        onEnded={() => send({ type: 'tv:sessionEnded', sessionId: active.id })}
      />
    );
  }

  return <TvQueue queue={queue} onStartNext={() => send({ type: 'operator:startNext' })} />;
}
