import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_SESSION_CONFIG,
  type AppSettings,
  type KeyStats,
  type SessionConfig,
  type SessionRecord,
} from './types';
import { keyName } from './music/notes';

const K_APP = 'fretboard.app.v1';
const K_SESSION_CONFIG = 'fretboard.sessionConfig.v1';
const K_SESSIONS = 'fretboard.sessions.v1';
const K_REFERENCE = 'fretboard.reference.v1';

const MAX_SESSIONS = 300;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object') return fallback;
    return { ...fallback, ...(parsed as object) } as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* プライベートモードなどでは黙って諦める (練習自体は続行できる) */
  }
}

export function loadAppSettings(): AppSettings {
  return read<AppSettings>(K_APP, DEFAULT_APP_SETTINGS);
}
export function saveAppSettings(s: AppSettings): void {
  write(K_APP, s);
}

export function loadSessionConfig(): SessionConfig {
  return read<SessionConfig>(K_SESSION_CONFIG, DEFAULT_SESSION_CONFIG);
}
export function saveSessionConfig(c: SessionConfig): void {
  write(K_SESSION_CONFIG, c);
}

export function hasPreviousConfig(): boolean {
  try {
    return localStorage.getItem(K_SESSION_CONFIG) !== null;
  } catch {
    return false;
  }
}

export interface ReferenceState {
  rootPc: number;
  scale: string;
  labelMode: string;
  boxIndex: number;
  showBoxes: boolean;
  preferFlat: boolean;
}

export const DEFAULT_REFERENCE_STATE: ReferenceState = {
  rootPc: 11,
  scale: 'aeolian',
  labelMode: 'degree',
  boxIndex: 0,
  showBoxes: false,
  preferFlat: false,
};

export function loadReferenceState(): ReferenceState {
  return read<ReferenceState>(K_REFERENCE, DEFAULT_REFERENCE_STATE);
}
export function saveReferenceState(s: ReferenceState): void {
  write(K_REFERENCE, s);
}

export function loadSessions(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(K_SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

export function appendSession(rec: SessionRecord): void {
  const all = loadSessions();
  all.push(rec);
  write(K_SESSIONS, all.slice(-MAX_SESSIONS));
}

export function clearSessions(): void {
  try {
    localStorage.removeItem(K_SESSIONS);
  } catch {
    /* noop */
  }
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** 保存済みセッションからキー別統計を集計する */
export function computeKeyStats(
  sessions: SessionRecord[],
  modeFilter?: SessionRecord['mode'],
): KeyStats[] {
  const bucket = new Map<string, KeyStats & { latencies: number[]; completions: number[]; corrects: number }>();
  for (const s of sessions) {
    if (modeFilter && s.mode !== modeFilter) continue;
    for (const a of s.answers) {
      const id = `${a.keyPc}:${a.keyQuality}`;
      let e = bucket.get(id);
      if (!e) {
        e = {
          key: keyName(a.keyPc, a.keyQuality),
          pc: a.keyPc,
          quality: a.keyQuality,
          attempts: 0,
          correctRate: 0,
          avgFirstTapLatencyMs: 0,
          avgCompletionTimeMs: 0,
          lastAttemptedAt: 0,
          latencies: [],
          completions: [],
          corrects: 0,
        };
        bucket.set(id, e);
      }
      e.attempts += 1;
      if (a.isCorrect) e.corrects += 1;
      // スキップ/タイムアウトは「認識できなかった」なので、レイテンシは
      // 平均に混ぜず、代わりに正答率側でペナルティとして効かせる
      if (!a.skipped && !a.timedOut) {
        e.latencies.push(a.firstTapLatencyMs);
        e.completions.push(a.completionTimeMs);
      }
      e.lastAttemptedAt = Math.max(e.lastAttemptedAt, a.answeredAt);
    }
  }
  return [...bucket.values()].map((e) => ({
    key: e.key,
    pc: e.pc,
    quality: e.quality,
    attempts: e.attempts,
    correctRate: e.attempts ? e.corrects / e.attempts : 0,
    avgFirstTapLatencyMs: avg(e.latencies),
    avgCompletionTimeMs: avg(e.completions),
    lastAttemptedAt: e.lastAttemptedAt,
  }));
}

/** 苦手キー = 初手レイテンシが長い / 正答率が低い順 */
export function weakKeys(
  sessions: SessionRecord[],
  limit = 5,
  modeFilter?: SessionRecord['mode'],
): KeyStats[] {
  return computeKeyStats(sessions, modeFilter)
    .filter((k) => k.attempts >= 2)
    .sort((a, b) => weakScore(b) - weakScore(a))
    .slice(0, limit);
}

export function weakScore(k: KeyStats): number {
  // レイテンシ(秒)に不正解ペナルティを加えた総合スコア
  return k.avgFirstTapLatencyMs / 1000 + (1 - k.correctRate) * 5;
}

/**
 * キー×度数クイズで「正解 → 実際に選んだもの」の取り違えを数える。
 * 誤答選択肢をその人の苦手に寄せるために使う。
 */
export function buildConfusion(sessions: SessionRecord[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    if (s.mode !== 'interval') continue;
    for (const a of s.answers) {
      if (a.isCorrect || !a.degreeRoman || !a.pickedDegree) continue;
      let inner = out.get(a.degreeRoman);
      if (!inner) {
        inner = new Map();
        out.set(a.degreeRoman, inner);
      }
      inner.set(a.pickedDegree, (inner.get(a.pickedDegree) ?? 0) + 1);
    }
  }
  return out;
}
