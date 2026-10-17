import {
  degreePool,
  diatonicSet,
  resolveChord,
  romanLabel,
  type ChordNotation,
  type DegreeSpec,
  type ResolvedChord,
} from '../music/chords';
import { keyContainsChord } from '../music/analysis';
import { makeUniqueProgression, type Progression } from '../music/progressions';
import {
  allStrings,
  pcAt,
  pickRandom,
  placeWindow,
  positionsInWindow,
  shuffle,
  type FretWindow,
  type Position,
  type Tuning,
} from '../music/fretboard';
import {
  keyName,
  keyRootSpelling,
  mod12,
  relativeKey,
  relativePairLabel,
} from '../music/notes';
import { scaleTones } from '../music/scales';
import { buildFillTarget, type FillTask, type FillTarget } from '../music/tasks';
import type { DiatonicFormat, KeySel, Level, SessionConfig } from '../types';

let seq = 0;
function nextId(): string {
  seq += 1;
  return `q${Date.now().toString(36)}-${seq}`;
}

export interface PositionFillQuestion {
  kind: 'positionFill';
  id: string;
  key: KeySel;
  keyLabel: string;
  chord: ResolvedChord;
  window: FretWindow;
  /** 何をタップさせるか。これがコードごとに変わるので、キーだけでは解けない */
  task: FillTask;
  correct: Position[];
  /** ピッチクラス → コードルートから見た度数ラベル */
  degreeByPc: Map<number, string>;
  /** octaveShape の起点 */
  anchor?: Position;
  rootPositions: Position[];
  level: Level;
}

export interface NoteNameQuestion {
  kind: 'noteName';
  id: string;
  position: Position;
  answerPc: number;
}

export interface IntervalChoice {
  /** 画面に出す文字列 */
  label: string;
  /** 同一性の判定と苦手記録に使うディグリー */
  roman: string;
}

export interface IntervalQuestion {
  kind: 'interval';
  id: string;
  key: KeySel;
  keyLabel: string;
  direction: 'toChord' | 'toDegree';
  chord: ResolvedChord;
  /** 記録用の質問文 */
  question: string;
  choices: IntervalChoice[];
  answer: IntervalChoice;
}

/** 過去に取り違えた組み合わせ: 正解ディグリー → 選んでしまったディグリー → 回数 */
export type ConfusionMap = Map<string, Map<string, number>>;

export type Question =
  | PositionFillQuestion
  | NoteNameQuestion
  | IntervalQuestion
  | DiatonicFillQuestion
  | DiatonicReverseQuestion
  | ScaleToneQuestion
  | ProgressionQuestion;

export const ALL_KEYS: KeySel[] = [
  ...Array.from({ length: 12 }, (_, pc) => ({ pc, quality: 'major' as const })),
  ...Array.from({ length: 12 }, (_, pc) => ({ pc, quality: 'minor' as const })),
];

/** 隣接する n 本の弦をランダムに選ぶ */
function pickStrings(tuning: Tuning, range: SessionConfig['stringRange']): number[] {
  const all = allStrings(tuning);
  if (range === 'all') return all;
  const n = range === 'two' ? 2 : 3;
  const start = Math.floor(Math.random() * (all.length - n + 1));
  return all.slice(start, start + n);
}

function placeAnyWindow(cfg: SessionConfig, tuning: Tuning, rootPc: number): FretWindow {
  const width = cfg.windowWidth > 0 ? cfg.windowWidth : cfg.fretMax - cfg.fretMin + 1;
  // 弦を絞ると窓内にルートを取れない組み合わせがあるので、取れるまで引き直す
  for (let i = 0; i < 12; i++) {
    const w = placeWindow(tuning, rootPc, {
      width,
      strings: pickStrings(tuning, cfg.stringRange),
      minFret: cfg.fretMin,
      maxFret: cfg.fretMax,
    });
    if (w) return w;
  }
  return (
    placeWindow(tuning, rootPc, {
      width,
      strings: allStrings(tuning),
      minFret: cfg.fretMin,
      maxFret: cfg.fretMax,
    }) ?? {
      startFret: cfg.fretMin,
      endFret: Math.min(cfg.fretMax, cfg.fretMin + width - 1),
      strings: allStrings(tuning),
    }
  );
}

export function makePositionFillQuestion(
  cfg: SessionConfig,
  tuning: Tuning,
  key: KeySel,
  notation: ChordNotation = 'triad',
): PositionFillQuestion {
  const pool = degreePool(key.quality, cfg.chordSources);
  const tasks = cfg.fillTasks.length ? cfg.fillTasks : (['root'] as FillTask[]);

  // コード・窓・お題の組み合わせによっては窓内に対象音が足りないので、
  // 成立する組み合わせが出るまで引き直す
  let chord = resolveChord(key.pc, key.quality, pickRandom(pool), notation);
  let win = placeAnyWindow(cfg, tuning, chord.rootPc);
  let target: FillTarget | null = null;
  for (let attempt = 0; attempt < 10 && !target; attempt++) {
    if (attempt > 0) {
      chord = resolveChord(key.pc, key.quality, pickRandom(pool), notation);
      win = placeAnyWindow(cfg, tuning, chord.rootPc);
    }
    for (const task of shuffle(tasks)) {
      target = buildFillTarget(tuning, win, chord, task);
      if (target) break;
    }
  }
  // 最後の砦: ルートは窓の置き方から必ず1つ以上ある
  target ??= buildFillTarget(tuning, win, chord, 'root')!;

  return {
    kind: 'positionFill',
    id: nextId(),
    key,
    keyLabel: keyName(key.pc, key.quality),
    chord,
    window: win,
    task: target.task,
    correct: target.positions,
    degreeByPc: target.degreeByPc,
    anchor: target.anchor,
    rootPositions: positionsInWindow(tuning, new Set([chord.rootPc]), win),
    level: cfg.level,
  };
}

export function makeNoteNameQuestion(cfg: SessionConfig, tuning: Tuning): NoteNameQuestion {
  const strings = cfg.noteQuizStrings.filter((s) => s <= tuning.stringCount);
  const usable = strings.length ? strings : allStrings(tuning);
  const string = pickRandom(usable);
  const lo = Math.min(cfg.noteQuizFretMin, cfg.noteQuizFretMax);
  const hi = Math.max(cfg.noteQuizFretMin, cfg.noteQuizFretMax);
  const fret = lo + Math.floor(Math.random() * (hi - lo + 1));
  return {
    kind: 'noteName',
    id: nextId(),
    position: { string, fret },
    answerPc: pcAt(tuning, string, fret),
  };
}

export function makeIntervalQuestion(
  cfg: SessionConfig,
  key: KeySel,
  notation: ChordNotation = 'triad',
  confusion?: ConfusionMap,
): IntervalQuestion {
  const pool = degreePool(key.quality, cfg.chordSources);
  const spec = pickRandom(pool);
  const chord = resolveChord(key.pc, key.quality, spec, notation);
  const keyLabel = keyName(key.pc, key.quality);
  const direction: 'toChord' | 'toDegree' =
    cfg.intervalDirection === 'both'
      ? Math.random() < 0.5
        ? 'toChord'
        : 'toDegree'
      : cfg.intervalDirection;

  const wrong = pickDistractors(key, pool, chord, notation, confusion?.get(chord.roman));
  const toChoice = (c: ResolvedChord): IntervalChoice =>
    direction === 'toChord'
      ? { label: c.symbol, roman: c.roman }
      : { label: c.roman, roman: c.roman };

  const answer = toChoice(chord);
  const choices = shuffle([answer, ...wrong.map(toChoice)]);

  return {
    kind: 'interval',
    id: nextId(),
    key,
    keyLabel,
    direction,
    chord,
    question:
      direction === 'toChord'
        ? `${keyLabel} の ${chord.roman} はどのコード?`
        : `${keyLabel} の ${chord.symbol} は何度?`,
    choices,
    answer,
  };
}

/**
 * 誤答の選択肢を選ぶ。
 * ランダムに散らすと「明らかに違う」ものばかりになって練習にならないので、
 * (1) 過去に取り違えた相手 (2) 同じ響きのコード (3) ルートが近いコード を優先する。
 */
function pickDistractors(
  key: KeySel,
  pool: DegreeSpec[],
  answer: ResolvedChord,
  notation: ChordNotation,
  confusion: Map<string, number> | undefined,
): ResolvedChord[] {
  const scored = pool
    .filter((s) => s.roman !== answer.spec.roman)
    .map((s) => resolveChord(key.pc, key.quality, s, notation))
    .filter((c) => c.roman !== answer.roman && c.symbol !== answer.symbol)
    .map((c) => {
      let score = Math.random();
      // 過去にこの問題で選んでしまった相手ほど強く出す
      score += Math.min(confusion?.get(c.roman) ?? 0, 3) * 3;
      // 同じ響き = 耳でも記憶でも取り違えやすい
      if (c.spec.quality === answer.spec.quality) score += 2;
      // ルートが半音〜全音違い = 隣の度数。いちばん紛らわしい
      const gap = Math.min(mod12(c.rootPc - answer.rootPc), mod12(answer.rootPc - c.rootPc));
      if (gap <= 2) score += 2;
      // ダイアトニックの問題に借用コードを混ぜると浮くので、出どころも揃える
      if (c.spec.source === answer.spec.source) score += 0.5;
      return { chord: c, score };
    })
    .sort((a, b) => b.score - a.score);

  const out: ResolvedChord[] = [];
  const seen = new Set<string>([answer.roman, answer.symbol]);
  for (const { chord } of scored) {
    if (out.length >= 3) break;
    if (seen.has(chord.roman) || seen.has(chord.symbol)) continue;
    seen.add(chord.roman);
    seen.add(chord.symbol);
    out.push(chord);
  }
  return out;
}

/** 同じキーが続かないようにキーを選ぶ */
export function pickKey(keys: KeySel[], prev?: KeySel): KeySel {
  if (keys.length === 0) return { pc: 0, quality: 'major' };
  if (keys.length === 1) return keys[0];
  for (let i = 0; i < 8; i++) {
    const k = pickRandom(keys);
    if (!prev || k.pc !== prev.pc || k.quality !== prev.quality) return k;
  }
  return pickRandom(keys);
}

export function makeQuestion(
  cfg: SessionConfig,
  tuning: Tuning,
  key: KeySel,
  notation: ChordNotation = 'triad',
  confusion?: ConfusionMap,
): Question {
  switch (cfg.mode) {
    case 'positionFill':
      return makePositionFillQuestion(cfg, tuning, key, notation);
    case 'noteName':
      return makeNoteNameQuestion(cfg, tuning);
    case 'interval':
      return makeIntervalQuestion(cfg, key, notation, confusion);
    case 'diatonic':
      return makeDiatonicQuestion(cfg, key, notation, confusion);
    case 'progression':
      // そのキーで一意に決まる進行が作れなければ、別のキーで引き直す
      for (let i = 0; i < 12; i++) {
        const q = makeProgressionQuestion(cfg, i === 0 ? key : pickRandom(ALL_KEYS), notation, confusion);
        if (q) return q;
      }
      return makeDiatonicReverseQuestion(key, notation, confusion);
  }
}

export function enharmonicChoiceLabel(pc: number): string {
  const sharp = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][mod12(pc)];
  const flat = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][mod12(pc)];
  return sharp === flat ? sharp : `${sharp}/${flat}`;
}

// ============================================================
// ダイアトニック暗記モード
// ============================================================

export interface DiatonicFillQuestion {
  kind: 'diatonicFill';
  id: string;
  key: KeySel;
  keyLabel: string;
  /**
   * 度数スロット。わざとシャッフルしてある。
   * I から順に並べると「I, II, III... と数えて導く暗唱」になってしまい、
   * このアプリで抜きたい数えるクセを強化してしまうため。
   */
  slots: { roman: string; answer: string; semitone: number }[];
  /** 置けるコード (正解7 + まぎらわしいダミー2) */
  chips: string[];
}

export interface DiatonicReverseQuestion {
  kind: 'diatonicReverse';
  id: string;
  /** 提示するコード */
  chord: ResolvedChord;
  /** 正解の親メジャーキー */
  key: KeySel;
  keyLabel: string;
  choices: { label: string; key: KeySel }[];
  answer: { label: string; key: KeySel };
  degreeInMajor: string;
  degreeInMinor: string;
}

export interface ScaleToneQuestion {
  kind: 'scaleTones';
  id: string;
  key: KeySel;
  keyLabel: string;
  answerPcs: number[];
  /** キーの調号に従った綴り */
  spelled: string[];
}

export interface ProgressionQuestion {
  kind: 'progression';
  id: string;
  key: KeySel;
  keyLabel: string;
  progression: Progression;
  choices: { label: string; key: KeySel }[];
  answer: { label: string; key: KeySel };
}

/** 同じ答えに見えるキーを優先して誤答候補を作る */
function pickKeyDistractors(
  answer: KeySel,
  count: number,
  confusion: Map<string, number> | undefined,
  alwaysInclude: KeySel[] = [],
): KeySel[] {
  const out: KeySel[] = [];
  const seen = new Set<string>([keyName(answer.pc, answer.quality)]);
  const push = (k: KeySel) => {
    const label = keyName(k.pc, k.quality);
    if (seen.has(label)) return;
    seen.add(label);
    out.push(k);
  };
  for (const k of alwaysInclude) push(k);

  // 平行調・同主調・5度圏の隣が、実際にいちばん取り違えやすい
  const candidates: KeySel[] = [
    relativeKey(answer.pc, answer.quality),
    { pc: answer.pc, quality: answer.quality === 'major' ? 'minor' : 'major' },
    { pc: mod12(answer.pc + 7), quality: answer.quality },
    { pc: mod12(answer.pc + 5), quality: answer.quality },
    { pc: mod12(answer.pc + 2), quality: answer.quality },
    { pc: mod12(answer.pc + 10), quality: answer.quality },
    { pc: mod12(answer.pc + 7), quality: answer.quality === 'major' ? 'minor' : 'major' },
  ];
  const scored = candidates
    .map((k) => ({
      k,
      score: Math.random() + Math.min(confusion?.get(keyName(k.pc, k.quality)) ?? 0, 3) * 3,
    }))
    .sort((a, b) => b.score - a.score);
  for (const { k } of scored) {
    if (out.length >= count) break;
    push(k);
  }
  while (out.length < count) {
    push(pickRandom(ALL_KEYS));
    if (out.length > 20) break;
  }
  return out.slice(0, count);
}

const toKeyChoice = (k: KeySel) => ({ label: keyName(k.pc, k.quality), key: k });

export function makeDiatonicFillQuestion(
  key: KeySel,
  notation: ChordNotation = 'triad',
): DiatonicFillQuestion {
  // マイナーの V は実戦で多い V7 を高めの確率で採用する
  const specs = diatonicSet(key.quality, Math.random() < 0.75);
  const correct = specs.map((s) => resolveChord(key.pc, key.quality, s, notation));
  const correctSymbols = new Set(correct.map((c) => c.symbol));

  // 同主調からの借用コードは「キーの中にありそうで無い」ので、ダミーとして一番効く
  const dummies = shuffle(degreePool(key.quality, ['interchange']))
    .map((s) => resolveChord(key.pc, key.quality, s, notation))
    .filter((c) => !correctSymbols.has(c.symbol))
    .map((c) => c.symbol)
    .filter((sym, i, arr) => arr.indexOf(sym) === i)
    .slice(0, 2);

  return {
    kind: 'diatonicFill',
    id: nextId(),
    key,
    keyLabel: keyName(key.pc, key.quality),
    slots: shuffle(
      correct.map((c) => ({ roman: c.roman, answer: c.symbol, semitone: c.spec.semitone })),
    ),
    chips: shuffle([...correct.map((c) => c.symbol), ...dummies]),
  };
}

export function makeDiatonicReverseQuestion(
  key: KeySel,
  notation: ChordNotation = 'triad',
  confusion?: ConfusionMap,
): DiatonicReverseQuestion {
  // 出題は必ずメジャーキーのダイアトニックから作る。
  // こうすると答えは「親メジャー + その平行短調」のペアに必ず一意に決まる
  const parentPc = key.quality === 'major' ? key.pc : mod12(key.pc + 3);
  const parent: KeySel = { pc: parentPc, quality: 'major' };
  const spec = pickRandom(degreePool('major', ['diatonic']));
  const chord = resolveChord(parentPc, 'major', spec, notation);

  const minorPc = mod12(parentPc + 9);
  const minorSpec = degreePool('minor', ['diatonic']).find(
    (s) => mod12(minorPc + s.semitone) === chord.rootPc && s.quality === spec.quality,
  );

  const label = (k: KeySel) => relativePairLabel(k.pc, k.quality);
  const answer = { label: label(parent), key: parent };
  // ダミーは「そのコードを含まないキー」でなければ問題が成立しない
  const wrong = pickKeyDistractors(parent, 8, confusion?.get(answer.label))
    .map((k) => ({ pc: k.quality === 'major' ? k.pc : mod12(k.pc + 3), quality: 'major' as const }))
    .filter((k) => !keyContainsChord(k, { rootPc: chord.rootPc, quality: spec.quality }))
    .filter((k, i, arr) => arr.findIndex((x) => x.pc === k.pc) === i)
    .slice(0, 3)
    .map((k) => ({ label: label(k), key: k }));

  return {
    kind: 'diatonicReverse',
    id: nextId(),
    chord,
    key: parent,
    keyLabel: keyName(parentPc, 'major'),
    choices: shuffle([answer, ...wrong]),
    answer,
    degreeInMajor: chord.roman,
    degreeInMinor: minorSpec ? romanLabel(minorSpec, notation) : '—',
  };
}

export function makeScaleToneQuestion(key: KeySel): ScaleToneQuestion {
  const root = keyRootSpelling(key.pc, key.quality);
  const tones = scaleTones(key.pc, root.letterIdx, key.quality === 'major' ? 'ionian' : 'aeolian');
  return {
    kind: 'scaleTones',
    id: nextId(),
    key,
    keyLabel: keyName(key.pc, key.quality),
    answerPcs: tones.map((t) => t.pc),
    spelled: tones.map((t) => t.name),
  };
}

export function makeProgressionQuestion(
  cfg: SessionConfig,
  key: KeySel,
  notation: ChordNotation = 'triad',
  confusion?: ConfusionMap,
): ProgressionQuestion | null {
  let prog = makeUniqueProgression(key, cfg.chordSources, notation);
  // そのキーで組める進行が無ければ、出どころを広げて取り直す
  prog ??= makeUniqueProgression(key, ['diatonic', 'secondary', 'interchange'], notation);
  if (!prog) return null;

  const label = keyName(key.pc, key.quality);
  const answer = { label, key };
  // 平行調は必ず選択肢に入れる。そこを見分けさせるのがこのゲームの本体
  const wrong = pickKeyDistractors(key, 3, confusion?.get(label), [
    relativeKey(key.pc, key.quality),
  ]).map(toKeyChoice);

  return {
    kind: 'progression',
    id: nextId(),
    key,
    keyLabel: label,
    progression: prog,
    choices: shuffle([answer, ...wrong]),
    answer,
  };
}

/** 逆引きを重めに出す (実戦で使う頻度が高いため) */
const DIATONIC_FORMAT_WEIGHT: Record<DiatonicFormat, number> = {
  reverseLookup: 2,
  fillTable: 1,
  scaleTones: 1,
};

export function makeDiatonicQuestion(
  cfg: SessionConfig,
  key: KeySel,
  notation: ChordNotation = 'triad',
  confusion?: ConfusionMap,
): Question {
  const formats = cfg.diatonicFormats.length ? cfg.diatonicFormats : (['reverseLookup'] as DiatonicFormat[]);
  const total = formats.reduce((a, f) => a + DIATONIC_FORMAT_WEIGHT[f], 0);
  let r = Math.random() * total;
  let chosen = formats[formats.length - 1];
  for (const f of formats) {
    r -= DIATONIC_FORMAT_WEIGHT[f];
    if (r <= 0) {
      chosen = f;
      break;
    }
  }
  if (chosen === 'fillTable') return makeDiatonicFillQuestion(key, notation);
  if (chosen === 'scaleTones') return makeScaleToneQuestion(key);
  return makeDiatonicReverseQuestion(key, notation, confusion);
}
