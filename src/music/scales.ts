import { degreeToLetterOffset, degreeToSemitone, mod12, spellNote } from './notes';

export type ScaleType =
  | 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian'
  | 'harmonicMinor' | 'melodicMinor'
  | 'majorPenta' | 'minorPenta' | 'blues'
  | 'hmp5b' | 'wholeTone' | 'dimWH' | 'dimHW';

export type ScaleGroup = 'modes' | 'minor' | 'penta' | 'other';

export interface ScaleDef {
  id: ScaleType;
  name: string;
  nameJa: string;
  group: ScaleGroup;
  /** ルートからの度数ラベル。ここが唯一の定義元(半音数はここから導出) */
  degrees: string[];
  /** 特性音(そのスケールらしさを決める音)の度数ラベル */
  characteristic: string[];
  /** 親メジャーキーまでの半音数。ルート - parentOffset = 親メジャーキーのルート */
  parentOffset?: number;
}

const defs: ScaleDef[] = [
  { id: 'ionian', name: 'Ionian', nameJa: 'アイオニアン (メジャー)', group: 'modes',
    degrees: ['1', '2', '3', '4', '5', '6', '7'], characteristic: [], parentOffset: 0 },
  { id: 'dorian', name: 'Dorian', nameJa: 'ドリアン', group: 'modes',
    degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'], characteristic: ['6'], parentOffset: 2 },
  { id: 'phrygian', name: 'Phrygian', nameJa: 'フリジアン', group: 'modes',
    degrees: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'], characteristic: ['b2'], parentOffset: 4 },
  { id: 'lydian', name: 'Lydian', nameJa: 'リディアン', group: 'modes',
    degrees: ['1', '2', '3', '#4', '5', '6', '7'], characteristic: ['#4'], parentOffset: 5 },
  { id: 'mixolydian', name: 'Mixolydian', nameJa: 'ミクソリディアン', group: 'modes',
    degrees: ['1', '2', '3', '4', '5', '6', 'b7'], characteristic: ['b7'], parentOffset: 7 },
  { id: 'aeolian', name: 'Aeolian', nameJa: 'エオリアン (ナチュラルマイナー)', group: 'modes',
    degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'], characteristic: ['b6'], parentOffset: 9 },
  { id: 'locrian', name: 'Locrian', nameJa: 'ロクリアン', group: 'modes',
    degrees: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'], characteristic: ['b5'], parentOffset: 11 },

  { id: 'harmonicMinor', name: 'Harmonic Minor', nameJa: 'ハーモニックマイナー', group: 'minor',
    degrees: ['1', '2', 'b3', '4', '5', 'b6', '7'], characteristic: ['7'] },
  { id: 'melodicMinor', name: 'Melodic Minor', nameJa: 'メロディックマイナー', group: 'minor',
    degrees: ['1', '2', 'b3', '4', '5', '6', '7'], characteristic: ['6', '7'] },

  { id: 'majorPenta', name: 'Major Pentatonic', nameJa: 'メジャーペンタトニック', group: 'penta',
    degrees: ['1', '2', '3', '5', '6'], characteristic: [], parentOffset: 0 },
  { id: 'minorPenta', name: 'Minor Pentatonic', nameJa: 'マイナーペンタトニック', group: 'penta',
    degrees: ['1', 'b3', '4', '5', 'b7'], characteristic: [], parentOffset: 9 },
  { id: 'blues', name: 'Blues', nameJa: 'ブルース', group: 'penta',
    degrees: ['1', 'b3', '4', 'b5', '5', 'b7'], characteristic: ['b5'] },

  { id: 'hmp5b', name: 'Harmonic Minor P5 below', nameJa: 'HMP5B', group: 'other',
    degrees: ['1', 'b2', '3', '4', '5', 'b6', 'b7'], characteristic: ['b2', 'b6'] },
  { id: 'wholeTone', name: 'Whole Tone', nameJa: 'ホールトーン', group: 'other',
    degrees: ['1', '2', '3', '#4', '#5', 'b7'], characteristic: ['#4', '#5'] },
  { id: 'dimWH', name: 'Diminished (W-H)', nameJa: 'ディミニッシュ (全半)', group: 'other',
    degrees: ['1', '2', 'b3', '4', 'b5', 'b6', '6', '7'], characteristic: [] },
  { id: 'dimHW', name: 'Diminished (H-W)', nameJa: 'コンディミ (半全)', group: 'other',
    degrees: ['1', 'b2', 'b3', '3', '#4', '5', '6', 'b7'], characteristic: ['b2', '#4'] },
];

export const SCALES: Record<ScaleType, ScaleDef> = Object.fromEntries(
  defs.map((d) => [d.id, d]),
) as Record<ScaleType, ScaleDef>;

export const SCALE_LIST = defs;

export const SCALE_GROUP_LABEL: Record<ScaleGroup, string> = {
  modes: 'チャーチモード',
  minor: 'マイナー系',
  penta: 'ペンタトニック',
  other: 'その他',
};

/** ルートからの半音数の配列 */
export function scaleIntervals(type: ScaleType): number[] {
  return SCALES[type].degrees.map(degreeToSemitone);
}

/** そのスケールを構成するピッチクラス集合 */
export function scalePitchClasses(root: number, type: ScaleType): Set<number> {
  return new Set(scaleIntervals(type).map((i) => mod12(root + i)));
}

export interface ScaleTone {
  pc: number;
  degree: string;
  /** キーに沿った綴り (F#, Bb ...) */
  name: string;
  isRoot: boolean;
  isCharacteristic: boolean;
}

/** スケールの構成音を、度数ラベル基準で正しく綴って返す */
export function scaleTones(root: number, rootLetterIdx: number, type: ScaleType): ScaleTone[] {
  const def = SCALES[type];
  const preferFlat = /b/.test(spellNote(rootLetterIdx, root));
  return def.degrees.map((deg) => {
    const pc = mod12(root + degreeToSemitone(deg));
    const letterIdx = rootLetterIdx + degreeToLetterOffset(deg);
    return {
      pc,
      degree: deg,
      name: spellNote(letterIdx, pc, preferFlat),
      isRoot: deg === '1',
      isCharacteristic: def.characteristic.includes(deg),
    };
  });
}

/** ピッチクラス → 度数ラベル (そのスケール内での) の索引 */
export function degreeMap(tones: ScaleTone[]): Map<number, ScaleTone> {
  const m = new Map<number, ScaleTone>();
  for (const t of tones) if (!m.has(t.pc)) m.set(t.pc, t);
  return m;
}
