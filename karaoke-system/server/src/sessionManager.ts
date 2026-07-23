import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { getSongRow, uploadsDir } from './songs.js';
import { parseLrc } from './lrcParser.js';
import { applyFrame, finalizeSlot } from './scoring.js';
import type { LyricLine, Session, SingerSlot, SessionMode } from './types.js';

const COUNTDOWN_MS = 4000;
const LIVE_BROADCAST_MIN_INTERVAL_MS = 120;

interface ClientInfo {
  ws: WebSocket;
  role: 'tv' | 'admin' | 'singer' | 'unknown';
  sessionId?: string;
  slotLetter?: 'A' | 'B';
}

function newSlot(name: string, socketId: string): SingerSlot {
  return {
    id: crypto.randomUUID(),
    name,
    socketId,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hitFrames: 0,
    activeFrames: 0,
  };
}

function summarizeSong(row: any) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
  };
}

export class KaraokeHub {
  private clients = new Map<string, ClientInfo>();
  private queue: Session[] = [];
  private active: Session | null = null;
  private activeLyrics: LyricLine[] = [];
  private lastLiveBroadcast = 0;
  private currentOffset = 0; // segundos, controlado pelo admin

  attach(wss: WebSocketServer) {
    wss.on('connection', (ws) => {
      const id = crypto.randomUUID();
      this.clients.set(id, { ws, role: 'unknown' });

      ws.on('message', (raw) => {
        let msg: any;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        this.handleMessage(id, msg);
      });

      ws.on('close', () => {
        const info = this.clients.get(id);
        this.clients.delete(id);
        if (info?.role === 'singer' && info.sessionId) {
          this.handleSingerDisconnect(info.sessionId, info.slotLetter);
        }
      });
    });
  }

  // ---- outbound helpers -------------------------------------------------

  private send(id: string, payload: unknown) {
    const info = this.clients.get(id);
    if (info && info.ws.readyState === WebSocket.OPEN) {
      info.ws.send(JSON.stringify(payload));
    }
  }

  private sendToSocketId(socketId: string, payload: unknown) {
    this.send(socketId, payload);
  }

  private broadcast(payload: unknown, roles?: Array<ClientInfo['role']>) {
    const data = JSON.stringify(payload);
    for (const info of this.clients.values()) {
      if (roles && !roles.includes(info.role)) continue;
      if (info.ws.readyState === WebSocket.OPEN) info.ws.send(data);
    }
  }

  private publicState() {
    return {
      type: 'state',
      queue: this.queue.map((s) => this.summarizeSession(s)),
      active: this.active ? this.fullSessionPayload(this.active) : null,
    };
  }

  private summarizeSession(s: Session) {
    const row = getSongRow(s.songId);
    return {
      id: s.id,
      mode: s.mode,
      status: s.status,
      song: row ? summarizeSong(row) : null,
      singerA: s.slotA.name,
      singerB: s.slotB?.name ?? null,
    };
  }

  private fullSessionPayload(s: Session) {
    const row = getSongRow(s.songId);
    return {
      id: s.id,
      mode: s.mode,
      status: s.status,
      startAt: s.startAt,
      song: row
        ? {
            id: row.id,
            title: row.title,
            artist: row.artist,
            audioUrl: `/uploads/${path.basename(row.audio_path)}`,
          }
        : null,
      lyrics: this.active === s ? this.activeLyrics : [],
      singerA: { name: s.slotA.name, score: Math.round(s.slotA.score), combo: s.slotA.combo },
      singerB: s.slotB
        ? { name: s.slotB.name, score: Math.round(s.slotB.score), combo: s.slotB.combo }
        : null,
    };
  }

  private broadcastState() {
    this.broadcast(this.publicState(), ['tv', 'admin']);
  }

  // ---- message handling ---------------------------------------------------

  private handleMessage(socketId: string, msg: any) {
    switch (msg.type) {
      case 'tv:hello':
      case 'admin:hello': {
        const info = this.clients.get(socketId)!;
        info.role = msg.type === 'tv:hello' ? 'tv' : 'admin';
        this.send(socketId, this.publicState());
        // Envia o offset atual para quem acabou de conectar
        if (info.role === 'tv') {
          this.send(socketId, { type: 'operator:offset', offset: this.currentOffset });
        }
        return;
      }

      case 'singer:createSolo':
        this.createSession(socketId, 'solo', msg.name, msg.songId);
        return;

      case 'singer:createDuel':
        this.createSession(socketId, 'duel', msg.name, msg.songId);
        return;

      case 'singer:listOpenDuels': {
        const duels = this.queue
          .filter((s) => s.status === 'waiting_opponent')
          .map((s) => {
            const row = getSongRow(s.songId);
            return {
              sessionId: s.id,
              hostName: s.slotA.name,
              song: row ? summarizeSong(row) : null,
            };
          });
        this.send(socketId, { type: 'openDuels', duels });
        return;
      }

      case 'singer:joinDuel':
        this.joinDuel(socketId, msg.sessionId, msg.name);
        return;

      case 'operator:startNext':
        this.startNext();
        return;

      case 'operator:cancelActive':
        this.cancelActive();
        return;

      // Admin ajusta offset da letra em tempo real
      case 'operator:setOffset': {
        const raw = Number(msg.offset);
        if (isNaN(raw)) return;
        this.currentOffset = Math.max(-10, Math.min(10, raw));
        // Faz broadcast só para a TV
        this.broadcast(
          { type: 'operator:offset', offset: this.currentOffset },
          ['tv']
        );
        return;
      }

      case 'tv:sessionEnded':
        this.finishActive();
        return;

      case 'frame':
        this.handleFrame(socketId, msg);
        return;
    }
  }

  // ---- session lifecycle ---------------------------------------------------

  private createSession(socketId: string, mode: SessionMode, name: string, songId: string) {
    const row = getSongRow(songId);
    if (!row || !name?.trim()) {
      this.send(socketId, { type: 'error', message: 'Música ou nome inválido.' });
      return;
    }

    const info = this.clients.get(socketId);
    if (info) {
      info.role = 'singer';
      info.slotLetter = 'A';
    }

    const session: Session = {
      id: crypto.randomUUID(),
      mode,
      status: mode === 'duel' ? 'waiting_opponent' : 'queued',
      songId,
      createdAt: Date.now(),
      slotA: newSlot(name.trim(), socketId),
      slotB: null,
      startAt: null,
      winner: null,
    };
    if (info) info.sessionId = session.id;

    this.queue.push(session);
    this.send(socketId, { type: 'session:created', session: this.summarizeSession(session), slot: 'A' });
    this.broadcastState();
  }

  private joinDuel(socketId: string, sessionId: string, name: string) {
    const session = this.queue.find((s) => s.id === sessionId);
    if (!session || session.status !== 'waiting_opponent' || !name?.trim()) {
      this.send(socketId, { type: 'error', message: 'Batalha indisponível.' });
      return;
    }

    const info = this.clients.get(socketId);
    if (info) {
      info.role = 'singer';
      info.slotLetter = 'B';
      info.sessionId = session.id;
    }

    session.slotB = newSlot(name.trim(), socketId);
    session.status = 'queued';

    this.send(socketId, { type: 'session:joined', session: this.summarizeSession(session), slot: 'B' });
    this.sendToSocketId(session.slotA.socketId, {
      type: 'session:opponentJoined',
      session: this.summarizeSession(session),
    });
    this.broadcastState();
  }

  private startNext() {
    if (this.active) return;
    const idx = this.queue.findIndex((s) => s.status === 'queued');
    if (idx === -1) return;

    const session = this.queue.splice(idx, 1)[0];
    session.status = 'countdown';
    session.startAt = Date.now() + COUNTDOWN_MS;
    this.active = session;
    this.currentOffset = 0; // reseta offset a cada nova música

    const row = getSongRow(session.songId);
    this.activeLyrics = row?.lrc_path && fs.existsSync(row.lrc_path)
      ? parseLrc(fs.readFileSync(row.lrc_path, 'utf-8'))
      : [];

    const payload = { type: 'session:countdown', session: this.fullSessionPayload(session) };
    this.broadcast(payload, ['tv']);
    this.sendToSocketId(session.slotA.socketId, payload);
    if (session.slotB) this.sendToSocketId(session.slotB.socketId, payload);

    // Informa TV que o offset foi resetado
    this.broadcast({ type: 'operator:offset', offset: 0 }, ['tv']);

    this.broadcastState();

    setTimeout(() => {
      if (this.active?.id === session.id) {
        session.status = 'active';
        this.broadcastState();
      }
    }, COUNTDOWN_MS);
  }

  private cancelActive() {
    if (!this.active) return;
    this.active = null;
    this.activeLyrics = [];
    this.currentOffset = 0;
    this.broadcastState();
  }

  private handleFrame(socketId: string, msg: any) {
    const info = this.clients.get(socketId);
    if (!this.active || !info?.sessionId || this.active.id !== info.sessionId) return;
    if (this.active.status !== 'active' && this.active.status !== 'countdown') return;
    if (!this.active.startAt) return;

    const songTime = (Date.now() - this.active.startAt) / 1000;
    if (songTime < 0) return;

    const slot = info.slotLetter === 'B' ? this.active.slotB : this.active.slotA;
    if (!slot) return;

    applyFrame(slot, this.activeLyrics, songTime, msg.volume ?? 0, msg.clarity ?? 0);

    const now = Date.now();
    if (now - this.lastLiveBroadcast > LIVE_BROADCAST_MIN_INTERVAL_MS) {
      this.lastLiveBroadcast = now;
      const livePayload = {
        type: 'live',
        sessionId: this.active.id,
        singerA: { score: Math.round(this.active.slotA.score), combo: this.active.slotA.combo },
        singerB: this.active.slotB
          ? { score: Math.round(this.active.slotB.score), combo: this.active.slotB.combo }
          : null,
      };
      this.broadcast(livePayload, ['tv']);
      this.sendToSocketId(this.active.slotA.socketId, livePayload);
      if (this.active.slotB) this.sendToSocketId(this.active.slotB.socketId, livePayload);
    }
  }

  private finishActive() {
    const session = this.active;
    if (!session) return;

    const resultA = finalizeSlot(session.slotA);
    const resultB = session.slotB ? finalizeSlot(session.slotB) : null;

    let winner: 'A' | 'B' | 'draw' | null = null;
    if (session.mode === 'duel' && resultB) {
      if (resultA.finalScore > resultB.finalScore) winner = 'A';
      else if (resultB.finalScore > resultA.finalScore) winner = 'B';
      else winner = 'draw';
    }

    db.prepare(
      `INSERT INTO history (id, song_id, mode, singer_a_name, singer_a_score, singer_a_category, singer_b_name, singer_b_score, singer_b_category, winner, played_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      session.songId,
      session.mode,
      session.slotA.name,
      resultA.finalScore,
      resultA.category,
      session.slotB?.name ?? null,
      resultB?.finalScore ?? null,
      resultB?.category ?? null,
      winner,
      Date.now()
    );

    const resultPayload = {
      type: 'session:end',
      session: this.summarizeSession(session),
      result: {
        mode: session.mode,
        winner,
        singerA: { name: session.slotA.name, ...resultA },
        singerB: session.slotB ? { name: session.slotB.name, ...resultB } : null,
      },
    };

    this.broadcast(resultPayload, ['tv']);
    this.sendToSocketId(session.slotA.socketId, resultPayload);
    if (session.slotB) this.sendToSocketId(session.slotB.socketId, resultPayload);

    this.active = null;
    this.activeLyrics = [];
    this.currentOffset = 0;
    this.broadcastState();
  }

  private handleSingerDisconnect(sessionId: string, slotLetter?: 'A' | 'B') {
    if (this.active?.id === sessionId) return;
    const idx = this.queue.findIndex((s) => s.id === sessionId);
    if (idx === -1) return;
    const session = this.queue[idx];
    if (slotLetter === 'A' || session.status === 'waiting_opponent') {
      this.queue.splice(idx, 1);
      this.broadcastState();
    }
  }
}