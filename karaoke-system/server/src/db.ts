import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data.sqlite');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  bpm INTEGER,
  song_key TEXT,
  difficulty TEXT,
  audio_path TEXT NOT NULL,
  lrc_path TEXT,
  cover_path TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  singer_a_name TEXT NOT NULL,
  singer_a_score INTEGER NOT NULL,
  singer_a_category TEXT NOT NULL,
  singer_b_name TEXT,
  singer_b_score INTEGER,
  singer_b_category TEXT,
  winner TEXT,
  played_at INTEGER NOT NULL
);
`);
