import type { Song } from '../types';

// DEPOIS — cole a URL real do servidor que apareceu na aba Ports
const SERVER_BASE = 'https://miniature-space-zebra-x74g4p54jgp2pjqg-3001.app.github.dev';

export const API_BASE = SERVER_BASE;
export const WS_URL = SERVER_BASE.replace('https://', 'wss://') + '/ws';
export const SERVER_HOST = SERVER_BASE.replace('https://', '');

export function assetUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function fetchSongs(): Promise<Song[]> {
  const res = await fetch(`${API_BASE}/api/songs`);
  if (!res.ok) throw new Error('Falha ao carregar músicas.');
  return res.json();
}

export async function uploadSong(form: FormData): Promise<Song> {
  const res = await fetch(`${API_BASE}/api/songs`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Falha ao enviar música.');
  }
  return res.json();
}

export async function deleteSong(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/songs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Falha ao remover música.');
}
