import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import './db.js';
import { songsRouter, uploadsDir } from './songs.js';
import { KaraokeHub } from './sessionManager.js';

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use('/api/songs', songsRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const hub = new KaraokeHub();
hub.attach(wss);

server.listen(PORT, () => {
  console.log(`Karaoke server rodando em http://localhost:${PORT}`);
  console.log(`WebSocket em ws://localhost:${PORT}/ws`);
});
