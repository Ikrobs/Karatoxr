export interface LyricLine {
  time: number;
  text: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number | null;
  songKey: string | null;
  difficulty: string | null;
  audioUrl: string;
  lrcUrl: string | null;
  coverUrl: string | null;
}

export type SessionMode = 'solo' | 'duel';
export type SessionStatus =
  | 'waiting_opponent'
  | 'queued'
  | 'countdown'
  | 'active'
  | 'finished';

export interface SessionSummary {
  id: string;
  mode: SessionMode;
  status: SessionStatus;
  song: { id: string; title: string; artist: string } | null;
  singerA: string;
  singerB: string | null;
}

export interface SingerLive {
  name: string;
  score: number;
  combo: number;
}

export interface ActiveSessionPayload {
  id: string;
  mode: SessionMode;
  status: SessionStatus;
  startAt: number | null;
  song: { id: string; title: string; artist: string; audioUrl: string } | null;
  lyrics: LyricLine[];
  singerA: SingerLive;
  singerB: SingerLive | null;
}

export type ScoreCategory = 'Perfect' | 'Excellent' | 'Great' | 'Good' | 'Bad' | 'Miss';

export interface SingerResult {
  name: string;
  finalScore: number;
  accuracyPercent: number;
  category: ScoreCategory;
}

export interface SessionResult {
  mode: SessionMode;
  winner: 'A' | 'B' | 'draw' | null;
  singerA: SingerResult;
  singerB: SingerResult | null;
}
