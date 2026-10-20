import type { ChordNotation, ChordSource } from './music/chords';
import type { KeyQuality } from './music/notes';
import type { ScaleType } from './music/scales';
import type { FillTask } from './music/tasks';

export type ModeId =
  | 'reference'
  | 'positionFill'
  | 'noteName'
  | 'interval'
  | 'diatonic'
  | 'progression';

/** ダイアトニック暗記モードの出題形式 */
export type DiatonicFormat = 'fillTable' | 'reverseLookup' | 'scaleTones';
export type Level = 1 | 2 | 3 | 4;

export interface KeySel {
  pc: number;
  quality: KeyQuality;
}

export type Orientation = 'auto' | 'horizontal' | 'vertical';
export type LabelMode = 'degree' | 'note' | 'none';

export interface AppSettings {
  tuningId: string;
  /** 答え合わせのあと自動で次の問題へ進むか。false なら自分で「次へ」を押す */
  autoAdvance: boolean;
  lefty: boolean;
  orientation: Orientation;
  dark: boolean;
  chordNotation: ChordNotation;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  tuningId: 'standard',
  autoAdvance: true,
  lefty: false,
  orientation: 'auto',
  dark: true,
  chordNotation: 'triad',
};

export type KeyPreset = 'all' | 'weak' | 'manual';
export type StringRange = 'two' | 'three' | 'all';

export interface SessionConfig {
  mode: Exclude<ModeId, 'reference'>;
  level: Level;
  keyPreset: KeyPreset;
  keys: KeySel[];
  lengthType: 'count' | 'time';
  count: number;
  minutes: number;
  /** ポジション・フィル: 窓幅 (0 = 全域) */
  windowWidth: number;
  /** ポジション・フィルのお題。ここからランダムに出る */
  fillTasks: FillTask[];
  /** ダイアトニック暗記モードの出題形式。ここからランダムに出る */
  diatonicFormats: DiatonicFormat[];
  stringRange: StringRange;
  fretMin: number;
  fretMax: number;
  chordSources: ChordSource[];
  noteQuizStrings: number[];
  noteQuizFretMin: number;
  noteQuizFretMax: number;
  /** 0 = 制限なし */
  noteQuizTimeLimitSec: number;
  intervalDirection: 'toChord' | 'toDegree' | 'both';
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  mode: 'positionFill',
  level: 2,
  keyPreset: 'all',
  keys: [],
  lengthType: 'count',
  count: 20,
  minutes: 5,
  windowWidth: 5,
  fillTasks: ['root', 'guide', 'chordTone'],
  diatonicFormats: ['reverseLookup', 'fillTable', 'scaleTones'],
  stringRange: 'all',
  fretMin: 0,
  fretMax: 12,
  chordSources: ['diatonic'],
  noteQuizStrings: [1, 2, 3, 4, 5, 6],
  noteQuizFretMin: 0,
  noteQuizFretMax: 12,
  noteQuizTimeLimitSec: 0,
  intervalDirection: 'both',
};

export interface AnswerRecord {
  questionId: string;
  mode: Exclude<ModeId, 'reference'>;
  keyLabel: string;
  keyPc: number;
  keyQuality: KeyQuality;
  chordSymbol?: string;
  degreeRoman?: string;
  scale?: ScaleType;
  /** ポジション・フィルのお題 */
  task?: FillTask;
  /** ダイアトニック暗記モードの出題形式 */
  format?: DiatonicFormat;
  /**
   * 実際に選んだ答え。キー×度数ならディグリー、キーを答えるモードならキー名。
   * 「何と取り違えたか」を覚えておき、次の誤答選択肢に混ぜるために使う。
   */
  pickedDegree?: string;
  /** 出題表示 〜 最初のタップ (最重要指標) */
  firstTapLatencyMs: number;
  /** 最初のタップ 〜 回答確定 */
  completionTimeMs: number;
  accuracy: number;
  isCorrect: boolean;
  skipped: boolean;
  timedOut: boolean;
  answeredAt: number;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  mode: Exclude<ModeId, 'reference'>;
  level: Level;
  answers: AnswerRecord[];
}

export interface KeyStats {
  key: string;
  pc: number;
  quality: KeyQuality;
  attempts: number;
  correctRate: number;
  avgFirstTapLatencyMs: number;
  avgCompletionTimeMs: number;
  lastAttemptedAt: number;
}

/** 1問ぶんの回答結果 (各モード画面 → セッションランナー) */
export interface QuestionResult {
  firstTapLatencyMs: number;
  completionTimeMs: number;
  accuracy: number;
  isCorrect: boolean;
  skipped: boolean;
  timedOut: boolean;
  /** 実際に選んだ答え (ディグリー または キー名) */
  pickedDegree?: string;
}
