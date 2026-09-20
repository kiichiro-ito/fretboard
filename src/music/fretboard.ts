import { mod12 } from './notes';
import { scalePitchClasses, type ScaleType } from './scales';

export interface Position {
  /** 1 = 1弦(最高音弦) */
  string: number;
  fret: number;
}

export interface Tuning {
  id: string;
  name: string;
  stringCount: number;
  /** index 0 = 1弦(最高音)。開放弦の MIDI ノート番号 */
  openNotes: number[];
}

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: 'スタンダード (EADGBE)', stringCount: 6, openNotes: [64, 59, 55, 50, 45, 40] },
  { id: 'dropD', name: 'ドロップD', stringCount: 6, openNotes: [64, 59, 55, 50, 45, 38] },
  { id: 'halfDown', name: '半音下げ', stringCount: 6, openNotes: [63, 58, 54, 49, 44, 39] },
  { id: 'wholeDown', name: '全音下げ', stringCount: 6, openNotes: [62, 57, 53, 48, 43, 38] },
  { id: 'dropC', name: 'ドロップC', stringCount: 6, openNotes: [62, 57, 53, 48, 43, 36] },
  { id: 'seven', name: '7弦スタンダード', stringCount: 7, openNotes: [64, 59, 55, 50, 45, 40, 35] },
  { id: 'sevenDropA', name: '7弦ドロップA', stringCount: 7, openNotes: [64, 59, 55, 50, 45, 40, 33] },
];

export function getTuning(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0];
}

export function midiAt(tuning: Tuning, string: number, fret: number): number {
  return tuning.openNotes[string - 1] + fret;
}

export function pcAt(tuning: Tuning, string: number, fret: number): number {
  return mod12(midiAt(tuning, string, fret));
}

export function posKey(p: Position): string {
  return `${p.string}:${p.fret}`;
}

export function parsePosKey(k: string): Position {
  const [s, f] = k.split(':').map(Number);
  return { string: s, fret: f };
}

export function allStrings(tuning: Tuning): number[] {
  return Array.from({ length: tuning.stringCount }, (_, i) => i + 1);
}

export interface FretWindow {
  startFret: number;
  endFret: number;
  /** 対象弦 (1-based)。昇順 */
  strings: number[];
}

export function windowContains(w: FretWindow, p: Position): boolean {
  return p.fret >= w.startFret && p.fret <= w.endFret && w.strings.includes(p.string);
}

/** 窓内で指定ピッチクラス集合に該当する全ポジション */
export function positionsInWindow(
  tuning: Tuning,
  pcs: Set<number>,
  w: FretWindow,
): Position[] {
  const out: Position[] = [];
  for (const s of w.strings) {
    for (let f = w.startFret; f <= w.endFret; f++) {
      if (pcs.has(pcAt(tuning, s, f))) out.push({ string: s, fret: f });
    }
  }
  return out;
}

export function scalePositions(
  tuning: Tuning,
  root: number,
  type: ScaleType,
  w: FretWindow,
): Position[] {
  return positionsInWindow(tuning, scalePitchClasses(root, type), w);
}

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

export function pickRandom<T>(arr: T[]): T {
  return arr[randInt(arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface WindowOptions {
  width: number;
  strings: number[];
  minFret: number;
  maxFret: number;
}

/**
 * 対象コードのルート音が窓内に含まれるようフレット窓を自動配置する。
 * ルートが低音弦側にある配置を「やや」優先しつつ、重み付きランダムで
 * ネック上のいろいろな高さが出るようにする (同じキーが毎回同じ場所だと
 * 位置の丸暗記になってしまうため)。
 * 窓内にルートが取れない場合は null。
 */
export function placeWindow(
  tuning: Tuning,
  rootPc: number,
  opts: WindowOptions,
): FretWindow | null {
  const { width, strings, minFret, maxFret } = opts;
  const span = Math.min(width, maxFret - minFret + 1);
  const lastStart = Math.max(minFret, maxFret - span + 1);
  const lowTwo = strings.slice(-2);

  const candidates: { start: number; weight: number }[] = [];
  for (let start = minFret; start <= lastStart; start++) {
    const end = start + span - 1;
    let hasRoot = false;
    let rootOnLow = false;
    for (const s of strings) {
      for (let f = start; f <= end; f++) {
        if (pcAt(tuning, s, f) !== rootPc) continue;
        hasRoot = true;
        if (lowTwo.includes(s)) rootOnLow = true;
      }
    }
    if (!hasRoot) continue;
    candidates.push({ start, weight: rootOnLow ? 2 : 1 });
  }

  if (candidates.length === 0) return null;
  const total = candidates.reduce((a, c) => a + c.weight, 0);
  let r = Math.random() * total;
  let chosen = candidates[candidates.length - 1];
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) {
      chosen = c;
      break;
    }
  }
  return { startFret: chosen.start, endFret: chosen.start + span - 1, strings };
}

/**
 * ポジション(ボックス)分割。最低音弦上にスケール構成音が現れるフレットを起点に
 * boxWidth フレット幅の窓を作り、低い順に並べる。
 * 12F までなら ペンタで classic な 5 ボックス、7音スケールで 7 ポジションになり、
 * ネックを長く取ると (24F など) その上のオクターブぶんも続けて出る。
 * 端で幅が足りない窓は作らない (半端なボックスを出さないため)。
 */
export function scaleBoxes(
  tuning: Tuning,
  root: number,
  type: ScaleType,
  maxFret: number,
  boxWidth = 5,
): FretWindow[] {
  const strings = allStrings(tuning);
  const lowest = strings[strings.length - 1];
  const pcs = scalePitchClasses(root, type);
  const boxes: FretWindow[] = [];
  const lastStart = maxFret - boxWidth + 1;
  for (let f = 0; f <= lastStart; f++) {
    if (!pcs.has(pcAt(tuning, lowest, f))) continue;
    boxes.push({ startFret: f, endFret: f + boxWidth - 1, strings });
  }
  return boxes;
}

export const POSITION_MARKER_FRETS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
export const DOUBLE_MARKER_FRETS = new Set([12, 24]);
