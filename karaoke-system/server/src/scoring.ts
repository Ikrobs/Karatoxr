import type { LyricLine, ScoreCategory, SingerSlot } from './types.js';

const MAX_LINE_WINDOW = 6;
const CLARITY_GOOD = 0.85;
const CLARITY_OK = 0.55;
const RMS_MIN = 0.02;

function isLineActive(lines: LyricLine[], time: number): boolean {
  if (lines.length === 0) return true;
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].time;
    const nextStart = lines[i + 1]?.time ?? start + MAX_LINE_WINDOW;
    const end = Math.min(nextStart, start + MAX_LINE_WINDOW);
    if (time >= start && time < end) return true;
  }
  return false;
}

/** Applies one analysed voice frame from a phone into a singer's running score. */
export function applyFrame(
  slot: SingerSlot,
  lines: LyricLine[],
  songTime: number,
  rms: number,
  clarity: number
): void {
  const active = isLineActive(lines, songTime);
  if (!active) return;

  slot.activeFrames += 1;
  const singing = rms >= RMS_MIN;

  let points = 0;
  if (singing && clarity >= CLARITY_GOOD) {
    points = 1;
    slot.combo += 1;
  } else if (singing && clarity >= CLARITY_OK) {
    points = 0.6;
    slot.combo += 1;
  } else if (singing) {
    points = 0.25;
    slot.combo = 0;
  } else {
    points = 0;
    slot.combo = 0;
  }

  if (points >= 0.6) slot.hitFrames += 1;
  slot.maxCombo = Math.max(slot.maxCombo, slot.combo);

  const alpha = 0.06;
  slot.score = slot.score + alpha * (points * 100 - slot.score);
}

export function finalizeSlot(slot: SingerSlot): {
  finalScore: number;
  accuracyPercent: number;
  category: ScoreCategory;
} {
  const accuracyPercent =
    slot.activeFrames > 0 ? Math.round((slot.hitFrames / slot.activeFrames) * 100) : 0;
  const comboBonus = Math.min(10, slot.maxCombo / 8);
  const finalScore = Math.min(100, Math.round(accuracyPercent * 0.9 + comboBonus));
  return { finalScore, accuracyPercent, category: categorize(finalScore) };
}

export function categorize(score: number): ScoreCategory {
  if (score >= 95) return 'Perfect';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Great';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Bad';
  return 'Miss';
}
