import { mod12, spellNote, type KeyQuality, keyRootSpelling } from './notes';
import type { ScaleType } from './scales';

export type ChordQuality = 'maj7' | 'm7' | 'dom7' | 'm7b5' | 'mMaj7' | 'dim7';
export type ChordSource = 'diatonic' | 'secondary' | 'interchange';
export type ChordNotation = 'triad' | 'seventh';

export const CHORD_SOURCE_LABEL: Record<ChordSource, string> = {
  diatonic: 'ダイアトニック',
  secondary: 'セカンダリードミナント',
  interchange: 'モーダルインターチェンジ',
};

const SEVENTH_SUFFIX: Record<ChordQuality, string> = {
  maj7: 'maj7', m7: 'm7', dom7: '7', m7b5: 'm7b5', mMaj7: 'mM7', dim7: 'dim7',
};
const TRIAD_SUFFIX: Record<ChordQuality, string> = {
  maj7: '', m7: 'm', dom7: '7', m7b5: 'm7b5', mMaj7: 'mM7', dim7: 'dim',
};

export const CHORD_TONE_INTERVALS: Record<ChordQuality, number[]> = {
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10],
  mMaj7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9],
};

export interface DegreeSpec {
  /** ディグリー表記 ('IIm7', 'V7', 'V7/II', 'bVImaj7') */
  roman: string;
  /** キーのルートからの半音数 */
  semitone: number;
  /** キーのルート音名から何文字ずらすか (0-6) */
  letterOffset: number;
  quality: ChordQuality;
  /** そのコード上で弾くスケール */
  scale: ScaleType;
  source: ChordSource;
}

const MAJOR_DIATONIC: DegreeSpec[] = [
  { roman: 'Imaj7', semitone: 0, letterOffset: 0, quality: 'maj7', scale: 'ionian', source: 'diatonic' },
  { roman: 'IIm7', semitone: 2, letterOffset: 1, quality: 'm7', scale: 'dorian', source: 'diatonic' },
  { roman: 'IIIm7', semitone: 4, letterOffset: 2, quality: 'm7', scale: 'phrygian', source: 'diatonic' },
  { roman: 'IVmaj7', semitone: 5, letterOffset: 3, quality: 'maj7', scale: 'lydian', source: 'diatonic' },
  { roman: 'V7', semitone: 7, letterOffset: 4, quality: 'dom7', scale: 'mixolydian', source: 'diatonic' },
  { roman: 'VIm7', semitone: 9, letterOffset: 5, quality: 'm7', scale: 'aeolian', source: 'diatonic' },
  { roman: 'VIIm7b5', semitone: 11, letterOffset: 6, quality: 'm7b5', scale: 'locrian', source: 'diatonic' },
];

const MINOR_DIATONIC: DegreeSpec[] = [
  { roman: 'Im7', semitone: 0, letterOffset: 0, quality: 'm7', scale: 'aeolian', source: 'diatonic' },
  { roman: 'IIm7b5', semitone: 2, letterOffset: 1, quality: 'm7b5', scale: 'locrian', source: 'diatonic' },
  { roman: 'bIIImaj7', semitone: 3, letterOffset: 2, quality: 'maj7', scale: 'ionian', source: 'diatonic' },
  { roman: 'IVm7', semitone: 5, letterOffset: 3, quality: 'm7', scale: 'dorian', source: 'diatonic' },
  { roman: 'Vm7', semitone: 7, letterOffset: 4, quality: 'm7', scale: 'phrygian', source: 'diatonic' },
  { roman: 'bVImaj7', semitone: 8, letterOffset: 5, quality: 'maj7', scale: 'lydian', source: 'diatonic' },
  { roman: 'bVII7', semitone: 10, letterOffset: 6, quality: 'dom7', scale: 'mixolydian', source: 'diatonic' },
];

const MAJOR_SECONDARY: DegreeSpec[] = [
  { roman: 'V7/II', semitone: 9, letterOffset: 5, quality: 'dom7', scale: 'hmp5b', source: 'secondary' },
  { roman: 'V7/III', semitone: 11, letterOffset: 6, quality: 'dom7', scale: 'hmp5b', source: 'secondary' },
  { roman: 'V7/IV', semitone: 0, letterOffset: 0, quality: 'dom7', scale: 'mixolydian', source: 'secondary' },
  { roman: 'V7/V', semitone: 2, letterOffset: 1, quality: 'dom7', scale: 'mixolydian', source: 'secondary' },
  { roman: 'V7/VI', semitone: 4, letterOffset: 2, quality: 'dom7', scale: 'hmp5b', source: 'secondary' },
];

const MINOR_SECONDARY: DegreeSpec[] = [
  { roman: 'V7', semitone: 7, letterOffset: 4, quality: 'dom7', scale: 'hmp5b', source: 'secondary' },
  { roman: 'V7/bIII', semitone: 10, letterOffset: 6, quality: 'dom7', scale: 'mixolydian', source: 'secondary' },
  { roman: 'V7/IV', semitone: 0, letterOffset: 0, quality: 'dom7', scale: 'hmp5b', source: 'secondary' },
  { roman: 'V7/V', semitone: 2, letterOffset: 1, quality: 'dom7', scale: 'hmp5b', source: 'secondary' },
  { roman: 'V7/bVI', semitone: 3, letterOffset: 2, quality: 'dom7', scale: 'mixolydian', source: 'secondary' },
  { roman: 'V7/bVII', semitone: 5, letterOffset: 3, quality: 'dom7', scale: 'mixolydian', source: 'secondary' },
];

/** メジャーキーで同主短調から借用 */
const MAJOR_INTERCHANGE: DegreeSpec[] = [
  { roman: 'Im7', semitone: 0, letterOffset: 0, quality: 'm7', scale: 'aeolian', source: 'interchange' },
  { roman: 'IIm7b5', semitone: 2, letterOffset: 1, quality: 'm7b5', scale: 'locrian', source: 'interchange' },
  { roman: 'bIIImaj7', semitone: 3, letterOffset: 2, quality: 'maj7', scale: 'ionian', source: 'interchange' },
  { roman: 'IVm7', semitone: 5, letterOffset: 3, quality: 'm7', scale: 'dorian', source: 'interchange' },
  { roman: 'bVImaj7', semitone: 8, letterOffset: 5, quality: 'maj7', scale: 'lydian', source: 'interchange' },
  { roman: 'bVII7', semitone: 10, letterOffset: 6, quality: 'dom7', scale: 'mixolydian', source: 'interchange' },
];

/** マイナーキーで同主長調ほかから借用 */
const MINOR_INTERCHANGE: DegreeSpec[] = [
  { roman: 'ImM7', semitone: 0, letterOffset: 0, quality: 'mMaj7', scale: 'melodicMinor', source: 'interchange' },
  { roman: 'bIImaj7', semitone: 1, letterOffset: 1, quality: 'maj7', scale: 'lydian', source: 'interchange' },
  { roman: 'IIm7', semitone: 2, letterOffset: 1, quality: 'm7', scale: 'dorian', source: 'interchange' },
  { roman: 'IVmaj7', semitone: 5, letterOffset: 3, quality: 'maj7', scale: 'lydian', source: 'interchange' },
  { roman: 'IV7', semitone: 5, letterOffset: 3, quality: 'dom7', scale: 'mixolydian', source: 'interchange' },
];

export function degreePool(quality: KeyQuality, sources: ChordSource[]): DegreeSpec[] {
  const isMajor = quality === 'major';
  const out: DegreeSpec[] = [];
  if (sources.includes('diatonic')) out.push(...(isMajor ? MAJOR_DIATONIC : MINOR_DIATONIC));
  if (sources.includes('secondary')) out.push(...(isMajor ? MAJOR_SECONDARY : MINOR_SECONDARY));
  if (sources.includes('interchange')) out.push(...(isMajor ? MAJOR_INTERCHANGE : MINOR_INTERCHANGE));
  return out;
}

/**
 * ディグリー表記を表示用に整える。
 * 'IIm7' はコード表記がトライアドなら 'IIm'、7th なら 'IIm7' と、
 * コードネーム側の表記に合わせる (セカンダリードミナントは 'V7/II' 固定)。
 */
export function romanLabel(spec: DegreeSpec, notation: ChordNotation): string {
  if (spec.source === 'secondary') return spec.roman;
  const numeral = spec.roman.replace(/(m7b5|maj7|mM7|m7|7)$/, '');
  const suffix = notation === 'seventh' ? SEVENTH_SUFFIX[spec.quality] : TRIAD_SUFFIX[spec.quality];
  return numeral + suffix;
}

export interface ResolvedChord {
  spec: DegreeSpec;
  rootPc: number;
  rootLetterIdx: number;
  rootName: string;
  /** 表示用コードネーム ("F#m" / "F#m7") */
  symbol: string;
  /** 表示用ディグリー ("V" / "V7" / "V7/II") */
  roman: string;
  scale: ScaleType;
}

export function resolveChord(
  keyPc: number,
  keyQuality: KeyQuality,
  spec: DegreeSpec,
  notation: ChordNotation = 'triad',
): ResolvedChord {
  const keyRoot = keyRootSpelling(keyPc, keyQuality);
  const rootPc = mod12(keyPc + spec.semitone);
  const rootLetterIdx = keyRoot.letterIdx + spec.letterOffset;
  const preferFlat = keyRoot.name.includes('b');
  const rootName = spellNote(rootLetterIdx, rootPc, preferFlat);
  const suffix = notation === 'seventh' ? SEVENTH_SUFFIX[spec.quality] : TRIAD_SUFFIX[spec.quality];
  return {
    spec,
    rootPc,
    rootLetterIdx,
    rootName,
    symbol: rootName + suffix,
    roman: romanLabel(spec, notation),
    scale: spec.scale,
  };
}

/** コードトーンの MIDI ノート (Lv4 の再生用) */
export function chordVoicing(rootPc: number, quality: ChordQuality, baseOctave = 3): number[] {
  const base = 12 * (baseOctave + 1) + rootPc;
  return CHORD_TONE_INTERVALS[quality].map((i) => base + i);
}
