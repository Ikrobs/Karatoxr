import type { LyricLine } from './types.js';

const TIME_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/**
 * Parses standard .lrc lyric file content into a sorted array of LyricLine.
 * Supports multiple timestamps per line (e.g. "[00:12.00][00:45.00] La la la").
 * Ignores metadata tags like [ti:], [ar:], [al:], [by:], [offset:].
 */
export function parseLrc(content: string): LyricLine[] {
  const lines = content.split(/\r?\n/);
  const result: LyricLine[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const matches = [...line.matchAll(TIME_TAG)];
    if (matches.length === 0) continue;

    // Skip pure metadata lines like [ti:Song Title]
    if (/^\[[a-zA-Z]+:/.test(line)) continue;

    const text = line.replace(TIME_TAG, '').trim();

    for (const m of matches) {
      const minutes = parseInt(m[1], 10);
      const seconds = parseInt(m[2], 10);
      const fraction = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const time = minutes * 60 + seconds + fraction / 1000;
      result.push({ time, text });
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

/** Returns the index of the currently active lyric line for a given playback time. */
export function activeLineIndex(lines: LyricLine[], time: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= time) idx = i;
    else break;
  }
  return idx;
}
