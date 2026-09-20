import type { ChordQuality, ResolvedChord } from './chords';
import {
  midiAt,
  pcAt,
  posKey,
  type FretWindow,
  type Position,
  type Tuning,
} from './fretboard';
import { degreeToSemitone, mod12 } from './notes';
import { SCALES, scalePitchClasses } from './scales';

/**
 * ポジション・フィルのお題。
 *
 * 「そのコードのスケール構成音を全部塗る」だと、ダイアトニックのコードは
 * どれも親キーと同じ7音になってしまい、コード名を見なくてもキーだけで解けてしまう。
 * そこで、答えが必ず「対象コードのルート」に依存するお題だけを扱う。
 */
export type FillTask = 'root' | 'guide' | 'chordTone' | 'character' | 'octaveShape';

export interface FillTaskDef {
  id: FillTask;
  /** 設定画面などで使う短い名前 */
  label: string;
  /** 出題画面に出す指示 */
  instruction: string;
  /** ヘルプ用の説明 */
  detail: string;
}

export const FILL_TASKS: Record<FillTask, FillTaskDef> = {
  root: {
    id: 'root',
    label: 'ルート',
    instruction: 'を全部タップ',
    detail: '対象コードのルート音だけをタップします。いちばん速く回せて、反射の土台になるお題です。',
  },
  guide: {
    id: 'guide',
    label: 'ガイドトーン',
    instruction: '3rd と 7th を全部',
    detail:
      'コードの明暗を決める 3rd と 7th だけをタップします。同じキーでもコードごとに場所が変わるので、コード名を見ないと解けません。',
  },
  chordTone: {
    id: 'chordTone',
    label: 'コードトーン',
    instruction: 'R・3・5・7 を全部',
    detail: 'アルペジオの形です。アドリブで実際に狙う音そのものを覚えます。',
  },
  character: {
    id: 'character',
    label: '特性音',
    instruction: 'ルート + そのモードらしい音',
    detail:
      'そのモードらしさを決める音(フリジアンの ♭2、リディアンの ♯4 など)とルートをタップします。',
  },
  octaveShape: {
    id: 'octaveShape',
    label: 'オクターブ形',
    instruction: '◆ から1オクターブ上まで',
    detail:
      '◆ で示したルートから1オクターブ分だけスケールを埋めます。ルートを起点にした運指の形そのものを覚えるお題です。',
  },
};

export const FILL_TASK_LIST = Object.values(FILL_TASKS);

/** コードトーンの度数ラベル (ルートからの積み方) */
export const CHORD_TONE_DEGREES: Record<ChordQuality, string[]> = {
  maj7: ['1', '3', '5', '7'],
  m7: ['1', 'b3', '5', 'b7'],
  dom7: ['1', '3', '5', 'b7'],
  m7b5: ['1', 'b3', 'b5', 'b7'],
  mMaj7: ['1', 'b3', '5', '7'],
  dim7: ['1', 'b3', 'b5', 'bb7'],
};

export interface FillTarget {
  task: FillTask;
  positions: Position[];
  /** 押すべき音の度数ラベル (コードのルート基準)。ピッチクラス → ラベル */
  degreeByPc: Map<number, string>;
  /** octaveShape の起点。ここから1オクターブ分を埋める */
  anchor?: Position;
}

function positionsWithPcs(
  tuning: Tuning,
  w: FretWindow,
  pcs: Set<number>,
): Position[] {
  const out: Position[] = [];
  for (const s of w.strings) {
    for (let f = w.startFret; f <= w.endFret; f++) {
      if (pcs.has(pcAt(tuning, s, f))) out.push({ string: s, fret: f });
    }
  }
  return out;
}

function degreeSet(rootPc: number, degrees: string[]): {
  pcs: Set<number>;
  byPc: Map<number, string>;
} {
  const pcs = new Set<number>();
  const byPc = new Map<number, string>();
  for (const d of degrees) {
    const pc = mod12(rootPc + degreeToSemitone(d));
    pcs.add(pc);
    if (!byPc.has(pc)) byPc.set(pc, d);
  }
  return { pcs, byPc };
}

/** そのお題が、この窓とコードの組み合わせで成立するか (音が窓内にあるか) */
export function buildFillTarget(
  tuning: Tuning,
  w: FretWindow,
  chord: ResolvedChord,
  task: FillTask,
): FillTarget | null {
  const toneDegrees = CHORD_TONE_DEGREES[chord.spec.quality];

  if (task === 'root') {
    const { pcs, byPc } = degreeSet(chord.rootPc, ['1']);
    const positions = positionsWithPcs(tuning, w, pcs);
    return positions.length ? { task, positions, degreeByPc: byPc } : null;
  }

  if (task === 'guide' || task === 'chordTone') {
    const degrees = task === 'guide' ? [toneDegrees[1], toneDegrees[3]] : toneDegrees;
    const { pcs, byPc } = degreeSet(chord.rootPc, degrees);
    const positions = positionsWithPcs(tuning, w, pcs);
    // 1音しか出てこない窓は練習にならないので不成立扱い
    return positions.length >= 2 ? { task, positions, degreeByPc: byPc } : null;
  }

  if (task === 'character') {
    const characteristic = SCALES[chord.scale].characteristic;
    if (characteristic.length === 0) return null;
    const { pcs, byPc } = degreeSet(chord.rootPc, ['1', ...characteristic]);
    const positions = positionsWithPcs(tuning, w, pcs);
    return positions.length >= 2 ? { task, positions, degreeByPc: byPc } : null;
  }

  // octaveShape: 窓内でいちばん低いルートを起点に、そこから1オクターブ分
  const rootPositions = positionsWithPcs(tuning, w, new Set([chord.rootPc]));
  if (rootPositions.length === 0) return null;
  const anchor = rootPositions.reduce((lo, p) =>
    midiAt(tuning, p.string, p.fret) < midiAt(tuning, lo.string, lo.fret) ? p : lo,
  );
  const anchorMidi = midiAt(tuning, anchor.string, anchor.fret);
  const scalePcs = scalePitchClasses(chord.rootPc, chord.scale);
  const positions = positionsWithPcs(tuning, w, scalePcs).filter((p) => {
    const m = midiAt(tuning, p.string, p.fret);
    return m >= anchorMidi && m <= anchorMidi + 12;
  });
  if (positions.length < 4) return null;

  const byPc = new Map<number, string>();
  for (const d of SCALES[chord.scale].degrees) {
    const pc = mod12(chord.rootPc + degreeToSemitone(d));
    if (!byPc.has(pc)) byPc.set(pc, d);
  }
  return { task, positions, degreeByPc: byPc, anchor };
}

/** 判定に使う位置集合 */
export function targetKeys(t: FillTarget): Set<string> {
  return new Set(t.positions.map(posKey));
}
