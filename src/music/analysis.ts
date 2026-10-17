import {
  degreePool,
  type ChordQuality,
  type ChordSource,
  type DegreeSpec,
} from './chords';
import { mod12, type KeyQuality } from './notes';

export interface ChordRef {
  rootPc: number;
  quality: ChordQuality;
}

export interface KeyId {
  pc: number;
  quality: KeyQuality;
}

export const ALL_KEY_IDS: KeyId[] = [
  ...Array.from({ length: 12 }, (_, pc) => ({ pc, quality: 'major' as const })),
  ...Array.from({ length: 12 }, (_, pc) => ({ pc, quality: 'minor' as const })),
];

export function sameKey(a: KeyId, b: KeyId): boolean {
  return a.pc === b.pc && a.quality === b.quality;
}

/** コードがそのキーに「どれくらい素直に収まるか」 */
const SOURCE_SCORE: Record<ChordSource, number> = {
  diatonic: 3,
  secondary: 2,
  interchange: 1.5,
};

export interface KeyFit {
  key: KeyId;
  /** 各コードがそのキーで何度にあたるか。説明できないコードは null */
  degrees: (DegreeSpec | null)[];
  /** 全コードを説明できたか */
  explained: boolean;
  /** トニックがどこかに現れるか。これが無い進行はキーを名指しできない */
  containsTonic: boolean;
  score: number;
  /** 点数の内訳 (デバッグと答え合わせの説明に使う) */
  reasons: string[];
}

function isTonic(spec: DegreeSpec | null, key: KeyId): boolean {
  if (!spec || spec.semitone !== 0) return false;
  return key.quality === 'major'
    ? spec.quality === 'maj7'
    : spec.quality === 'm7' || spec.quality === 'mMaj7';
}

function isDominantOfKey(spec: DegreeSpec | null): boolean {
  return !!spec && spec.semitone === 7 && spec.quality === 'dom7';
}

/**
 * 進行を1つのキーとして解釈してみる。
 *
 * 平行調 (C と Am) は構成音が同じなので、コードの種類だけでは絶対に区別できない。
 * 区別できる根拠は「どこで終わるか」「ドミナントが何か」なので、そこに点を振る。
 */
export function fitKey(chords: ChordRef[], key: KeyId, sources: ChordSource[]): KeyFit {
  const pool = degreePool(key.quality, sources);
  const degrees: (DegreeSpec | null)[] = [];
  let score = 0;
  const reasons: string[] = [];

  for (const c of chords) {
    const matches = pool.filter(
      (s) => mod12(key.pc + s.semitone) === c.rootPc && s.quality === c.quality,
    );
    if (matches.length === 0) {
      degrees.push(null);
      continue;
    }
    // いちばん素直な解釈 (ダイアトニック優先) を採る
    const best = matches.reduce((a, b) =>
      SOURCE_SCORE[b.source] > SOURCE_SCORE[a.source] ? b : a,
    );
    degrees.push(best);
    score += SOURCE_SCORE[best.source];
  }

  const explained = degrees.every((d) => d !== null);
  const containsTonic = degrees.some((d) => isTonic(d, key));
  if (!explained) {
    return {
      key,
      degrees,
      explained: false,
      containsTonic,
      score: -Infinity,
      reasons: ['説明できないコードがある'],
    };
  }

  const last = degrees[degrees.length - 1];
  const first = degrees[0];

  if (isTonic(last, key)) {
    score += 4;
    reasons.push('トニックで終わる');
  }
  if (isTonic(first, key)) {
    score += 2;
    reasons.push('トニックで始まる');
  }

  const domIndex = degrees.findIndex(isDominantOfKey);
  if (domIndex >= 0) {
    score += 2.5;
    reasons.push('このキーの V7 を含む');
    // V7 → I の終止はキーを決定づける
    if (domIndex + 1 < degrees.length && isTonic(degrees[domIndex + 1], key)) {
      score += 3;
      reasons.push('V7 → I の終止');
    }
    // マイナーの V7 はハーモニックマイナー由来で、平行長調には無い音を含む
    if (key.quality === 'minor') {
      score += 1.5;
      reasons.push('マイナーキーの V7');
    }
  }

  if (containsTonic && !isTonic(first, key) && !isTonic(last, key)) {
    score += 1;
    reasons.push('途中にトニックがある');
  }

  return { key, degrees, explained, containsTonic, score, reasons };
}

export function rankKeys(chords: ChordRef[], sources: ChordSource[]): KeyFit[] {
  return ALL_KEY_IDS.map((k) => fitKey(chords, k, sources)).sort((a, b) => b.score - a.score);
}

export interface UniquenessCheck {
  ok: boolean;
  best: KeyFit;
  runnerUp: KeyFit | null;
  margin: number;
  /** 落ちた理由 (出題生成のデバッグ用) */
  reject?: string;
}

/** キーを名指しするのに最低限必要なコード数 */
export const MIN_PROGRESSION_LENGTH = 3;

/**
 * 「この進行はそのキーだと言い切れるか」を確かめる。
 *
 * 過去に「対象コードが答えに影響しない」出題を作ってしまった反省から、
 * 出題を作るたびにこれを通し、通らなければ捨てる。
 */
export function checkUniqueness(
  chords: ChordRef[],
  intended: KeyId,
  sources: ChordSource[],
  requiredMargin = 3,
): UniquenessCheck {
  const ranked = rankKeys(chords, sources);
  const best = ranked[0];
  const runnerUp = ranked[1] ?? null;
  const margin = runnerUp ? best.score - runnerUp.score : Infinity;

  // 「C - G」のような短い断片は、理屈の上で絞れても実質どのキーとも言える。
  // 情報量そのものを条件にする。
  let reject: string | undefined;
  if (chords.length < MIN_PROGRESSION_LENGTH) reject = 'コード数が足りない';
  else if (!sameKey(best.key, intended)) reject = '意図したキーが最有力にならない';
  else if (!best.containsTonic) reject = 'トニックが現れない';
  else if (margin < requiredMargin) reject = `平行調などと差がつかない (margin=${margin})`;

  return { ok: !reject, best, runnerUp, margin, reject };
}

/** そのコードをダイアトニックに含むキーを全部挙げる */
export function keysContainingChord(chord: ChordRef): KeyId[] {
  return ALL_KEY_IDS.filter((k) =>
    degreePool(k.quality, ['diatonic']).some(
      (s) => mod12(k.pc + s.semitone) === chord.rootPc && s.quality === chord.quality,
    ),
  );
}

/** そのキーのダイアトニックに、このコードが含まれるか */
export function keyContainsChord(key: KeyId, chord: ChordRef): boolean {
  return degreePool(key.quality, ['diatonic']).some(
    (s) => mod12(key.pc + s.semitone) === chord.rootPc && s.quality === chord.quality,
  );
}
