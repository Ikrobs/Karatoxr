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
export type SessionStatus = 'waiting_opponent' | 'queued' | 'countdown' | 'active' | 'finished';
export type ScoreCategory = 'Perfect' | 'Excellent' | 'Great' | 'Good' | 'Bad' | 'Miss';

export interface SingerSlot {
  id: string; // singer connection id
  name: string;
  socketId: string;
  score: number;
  combo: number;
  maxCombo: number;
  hitFrames: number;
  activeFrames: number;
  finalResult?: {
    finalScore: number;
    accuracyPercent: number;
    category: ScoreCategory;
  };
}

export interface Session {
  id: string;
  mode: SessionMode;
  status: SessionStatus;
  songId: string;
  createdAt: number;
  slotA: SingerSlot;
  slotB: SingerSlot | null;
  startAt: number | null; // epoch ms when playback should start
  winner: 'A' | 'B' | 'draw' | null;
}
