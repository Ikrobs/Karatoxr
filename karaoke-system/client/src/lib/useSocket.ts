import { useEffect, useRef } from 'react';
import { WS_URL } from './api';

type Handler = (msg: any) => void;

/**
 * Opens a WebSocket to the karaoke server and calls `onMessage` for every
 * parsed JSON message. Reconnects automatically with a short backoff.
 * Returns a ref-like `send` function stable across renders.
 */
export function useSocket(onMessage: Handler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const queueRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        for (const payload of queueRef.current) ws.send(payload);
        queueRef.current = [];
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          onMessageRef.current(msg);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (!cancelled) retryTimer = setTimeout(connect, 1500);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, []);

  function send(payload: object) {
    const data = JSON.stringify(payload);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      queueRef.current.push(data);
    }
  }

  return { send };
}
