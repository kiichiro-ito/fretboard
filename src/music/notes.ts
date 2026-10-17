export type KeyQuality = 'major' | 'minor';

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** C D E F G A B の自然音ピッチクラス */
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const LETTERS = 'CDEFGAB';

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function mod7(n: number): number {
  return ((n % 7) + 7) % 7;
}

export function accidentalText(n: number): string {
  if (n === 0) return '';
  return n > 0 ? '#'.repeat(n) : 'b'.repeat(-n);
}

/** 音符記号を綺麗に (# -> ♯, b -> ♭)。ラベル表示用。 */
export function pretty(name: string): string {
  return name.replace(/#/g, '♯').replace(/b/g, '♭');
}

/**
 * 「何番目の音名(C=0)を使うか」と実ピッチクラスから綴りを決める。
 * ダブルシャープ/ダブルフラットを超える場合は異名同音の簡易表記にフォールバック。
 */
export function spellNote(letterIdx: number, pc: number, preferFlat = false): string {
  const li = mod7(letterIdx);
  let d = mod12(pc - LETTER_PC[li]);
  if (d > 6) d -= 12;
  if (d < -2 || d > 2) return (preferFlat ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
  return LETTERS[li] + accidentalText(d);
}

export interface RootSpelling {
  pc: number;
  letterIdx: number;
  name: string;
  /** 調号の数が同じで、どちらの綴りも正解になるキーの相方 (F# / Gb など) */
  alt?: { name: string; letterIdx: number };
}

/** 12 のメジャーキーの標準的な綴り */
export const MAJOR_KEY_ROOTS: RootSpelling[] = [
  { pc: 0, letterIdx: 0, name: 'C' },
  { pc: 1, letterIdx: 1, name: 'Db' },
  { pc: 2, letterIdx: 1, name: 'D' },
  { pc: 3, letterIdx: 2, name: 'Eb' },
  { pc: 4, letterIdx: 2, name: 'E' },
  { pc: 5, letterIdx: 3, name: 'F' },
  // F# (♯6個) と Gb (♭6個) は同数なのでどちらも正解
  { pc: 6, letterIdx: 3, name: 'F#', alt: { name: 'Gb', letterIdx: 4 } },
  { pc: 7, letterIdx: 4, name: 'G' },
  { pc: 8, letterIdx: 5, name: 'Ab' },
  { pc: 9, letterIdx: 5, name: 'A' },
  { pc: 10, letterIdx: 6, name: 'Bb' },
  { pc: 11, letterIdx: 6, name: 'B' },
];

/** 12 のマイナーキーの標準的な綴り */
export const MINOR_KEY_ROOTS: RootSpelling[] = [
  { pc: 0, letterIdx: 0, name: 'C' },
  { pc: 1, letterIdx: 0, name: 'C#' },
  { pc: 2, letterIdx: 1, name: 'D' },
  // Ebm (♭6個) と D#m (♯6個) は同数なのでどちらも正解
  { pc: 3, letterIdx: 2, name: 'Eb', alt: { name: 'D#', letterIdx: 1 } },
  { pc: 4, letterIdx: 2, name: 'E' },
  { pc: 5, letterIdx: 3, name: 'F' },
  { pc: 6, letterIdx: 3, name: 'F#' },
  { pc: 7, letterIdx: 4, name: 'G' },
  { pc: 8, letterIdx: 4, name: 'G#' },
  { pc: 9, letterIdx: 5, name: 'A' },
  { pc: 10, letterIdx: 6, name: 'Bb' },
  { pc: 11, letterIdx: 6, name: 'B' },
];

export function keyRootSpelling(pc: number, quality: KeyQuality): RootSpelling {
  return (quality === 'major' ? MAJOR_KEY_ROOTS : MINOR_KEY_ROOTS)[mod12(pc)];
}

/** "Bm" / "Eb" のようなキー表記 */
export function keyName(pc: number, quality: KeyQuality): string {
  const r = keyRootSpelling(pc, quality);
  return quality === 'minor' ? `${r.name}m` : r.name;
}

/** 度数ラベル("b3", "#4", "1")→ 半音数 */
export function degreeToSemitone(degree: string): number {
  const m = /^([#b]*)(\d)$/.exec(degree);
  if (!m) throw new Error(`invalid degree label: ${degree}`);
  const acc = m[1].split('').reduce((a, c) => a + (c === '#' ? 1 : -1), 0);
  return mod12(LETTER_PC[Number(m[2]) - 1] + acc);
}

/** 度数ラベル → 音名の何文字目ずらすか (1->0, b3->2) */
export function degreeToLetterOffset(degree: string): number {
  const m = /^([#b]*)(\d)$/.exec(degree);
  if (!m) throw new Error(`invalid degree label: ${degree}`);
  return Number(m[2]) - 1;
}

/** ルートからの半音差 → 汎用の度数ラベル */
export const GENERIC_DEGREES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

export function midiToPc(midi: number): number {
  return mod12(midi);
}

/** 異名同音の綴りも正解になるキーなら "F# (= Gb)" のように返す */
export function keyNameWithAlt(pc: number, quality: KeyQuality): string {
  const r = keyRootSpelling(pc, quality);
  const suffix = quality === 'minor' ? 'm' : '';
  if (!r.alt) return r.name + suffix;
  return `${r.name}${suffix} (= ${r.alt.name}${suffix})`;
}

/** 平行調のペア。major の pc を渡すと相対 minor の pc、またはその逆 */
export function relativeKey(pc: number, quality: KeyQuality): { pc: number; quality: KeyQuality } {
  return quality === 'major'
    ? { pc: mod12(pc + 9), quality: 'minor' }
    : { pc: mod12(pc + 3), quality: 'major' };
}

/** "F / Dm" のような平行調ペアの表記 */
export function relativePairLabel(pc: number, quality: KeyQuality): string {
  const major = quality === 'major' ? { pc, quality } : relativeKey(pc, quality);
  const minor = quality === 'minor' ? { pc, quality } : relativeKey(pc, quality);
  return `${keyName(major.pc, 'major')} / ${keyName(minor.pc, 'minor')}`;
}
