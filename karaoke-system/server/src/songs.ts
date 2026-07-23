import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import type { Song } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

export const songsRouter = Router();

function rowToSong(row: any): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    bpm: null,
    songKey: null,
    difficulty: null,
    audioUrl: `/uploads/${path.basename(row.audio_path)}`,
    lrcUrl: row.lrc_path ? `/uploads/${path.basename(row.lrc_path)}` : null,
    coverUrl: null,
  };
}

// Lista todas as músicas
songsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM songs ORDER BY created_at DESC').all();
  res.json(rows.map(rowToSong));
});

// Busca letra sincronizada na LRCLIB
songsRouter.get('/search-lrc', async (req, res) => {
  const { title, artist } = req.query as { title?: string; artist?: string };
  if (!title || !artist) {
    res.status(400).json({ error: 'title e artist são obrigatórios.' });
    return;
  }
  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    const response = await fetch(`https://lrclib.net/api/get?${params}`, {
      headers: { 'User-Agent': 'KaraokeAIPro/1.0' },
    });

    if (!response.ok) {
      res.status(404).json({ error: 'Letra não encontrada para essa música.' });
      return;
    }

    const data = await response.json() as any;

    if (!data.syncedLyrics) {
      res.status(404).json({ error: 'Letra encontrada mas sem sincronização de tempo (.lrc).' });
      return;
    }

    res.json({ lrc: data.syncedLyrics });
  } catch {
    res.status(500).json({ error: 'Falha ao consultar a LRCLIB.' });
  }
});

// Cadastra nova música
songsRouter.post(
  '/',
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'lrc', maxCount: 1 },
  ]),
  (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const audioFile = files?.audio?.[0];
    const lrcFile = files?.lrc?.[0];

    if (!audioFile) {
      res.status(400).json({ error: 'Arquivo de áudio é obrigatório.' });
      return;
    }

    const { title, artist } = req.body as Record<string, string>;
    if (!title || !artist) {
      res.status(400).json({ error: 'Título e artista são obrigatórios.' });
      return;
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO songs (id, title, artist, bpm, song_key, difficulty, audio_path, lrc_path, cover_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, title, artist, null, null, null, audioFile.path, lrcFile?.path ?? null, null, Date.now());

    const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
    res.status(201).json(rowToSong(row));
  }
);

// Remove música
songsRouter.delete('/:id', (req, res) => {
  const row: any = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Música não encontrada.' });
    return;
  }
  for (const p of [row.audio_path, row.lrc_path]) {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  }
  db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export function getSongRow(songId: string): any {
  return db.prepare('SELECT * FROM songs WHERE id = ?').get(songId);
}