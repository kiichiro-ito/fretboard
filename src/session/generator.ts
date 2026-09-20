import {
  degreePool,
  resolveChord,
  type ChordNotation,
  type DegreeSpec,
  type ResolvedChord,
} from '../music/chords';
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
import { keyName, mod12 } from '../music/notes';
import { buildFillTarget, type FillTask, type FillTarget } from '../music/tasks';
import type { KeySel, Level, SessionConfig } from '../types';

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

export type Question = PositionFillQuestion | NoteNameQuestion | IntervalQuestion;

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
  }
}

export function enharmonicChoiceLabel(pc: number): string {
  const sharp = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][mod12(pc)];
  const flat = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][mod12(pc)];
  return sharp === flat ? sharp : `${sharp}/${flat}`;
}
