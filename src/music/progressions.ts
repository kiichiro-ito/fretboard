import { checkUniqueness, type ChordRef, type KeyId } from './analysis';
import {
  degreePool,
  resolveChord,
  type ChordNotation,
  type ChordSource,
  type DegreeSpec,
  type ResolvedChord,
} from './chords';
import type { KeyQuality } from './notes';

/**
 * 進行は「コード名の羅列」ではなく「キー + 度数の並び」で持つ。
 * こうしておくと、後から音声再生を足すときにそのまま鳴らせるし、
 * どのキーに移調しても同じ進行として扱える。
 */
export interface ProgressionTemplate {
  id: string;
  /** 答え合わせでだけ見せる通称 */
  label: string;
  quality: KeyQuality;
  /** DegreeSpec.roman の並び */
  romans: string[];
  /** この進行を組むのに必要な出どころ */
  sources: ChordSource[];
}

export const PROGRESSION_TEMPLATES: ProgressionTemplate[] = [
  // --- メジャー: ダイアトニックのみ ---
  { id: 'maj-251', label: 'II - V - I', quality: 'major', sources: ['diatonic'],
    romans: ['IIm7', 'V7', 'Imaj7'] },
  { id: 'maj-1625', label: 'I - VI - II - V', quality: 'major', sources: ['diatonic'],
    romans: ['Imaj7', 'VIm7', 'IIm7', 'V7'] },
  { id: 'maj-1451', label: 'I - IV - V - I', quality: 'major', sources: ['diatonic'],
    romans: ['Imaj7', 'IVmaj7', 'V7', 'Imaj7'] },
  { id: 'maj-1564', label: 'I - V - VI - IV', quality: 'major', sources: ['diatonic'],
    romans: ['Imaj7', 'V7', 'VIm7', 'IVmaj7'] },
  // VI-IV-I-V は終止が V なので平行短調と差がつかず、判定器に落とされた。
  // 終止を I にして「どちらのキーか」が進行から読めるようにしている
  { id: 'maj-6451', label: 'VI - IV - V - I', quality: 'major', sources: ['diatonic'],
    romans: ['VIm7', 'IVmaj7', 'V7', 'Imaj7'] },
  { id: 'maj-1345', label: 'I - III - IV - V', quality: 'major', sources: ['diatonic'],
    romans: ['Imaj7', 'IIIm7', 'IVmaj7', 'V7'] },
  { id: 'maj-451', label: 'IV - V - I', quality: 'major', sources: ['diatonic'],
    romans: ['IVmaj7', 'V7', 'Imaj7'] },
  { id: 'maj-1645', label: 'I - VI - IV - V', quality: 'major', sources: ['diatonic'],
    romans: ['Imaj7', 'VIm7', 'IVmaj7', 'V7'] },
  { id: 'maj-36251', label: 'III - VI - II - V - I', quality: 'major', sources: ['diatonic'],
    romans: ['IIIm7', 'VIm7', 'IIm7', 'V7', 'Imaj7'] },

  // --- マイナー: ダイアトニックのみ (V7 を含む) ---
  { id: 'min-251', label: 'IIm7♭5 - V7 - Im', quality: 'minor', sources: ['diatonic'],
    romans: ['IIm7b5', 'V7', 'Im7'] },
  { id: 'min-1451', label: 'Im - IVm - V7 - Im', quality: 'minor', sources: ['diatonic'],
    romans: ['Im7', 'IVm7', 'V7', 'Im7'] },
  { id: 'min-1671', label: 'Im - ♭VI - ♭VII - Im', quality: 'minor', sources: ['diatonic'],
    romans: ['Im7', 'bVImaj7', 'bVII7', 'Im7'] },
  { id: 'min-1765', label: 'Im - ♭VII - ♭VI - V7', quality: 'minor', sources: ['diatonic'],
    romans: ['Im7', 'bVII7', 'bVImaj7', 'V7'] },
  { id: 'min-451', label: 'IVm - V7 - Im', quality: 'minor', sources: ['diatonic'],
    romans: ['IVm7', 'V7', 'Im7'] },
  { id: 'min-1625', label: 'Im - ♭VI - IIm7♭5 - V7', quality: 'minor', sources: ['diatonic'],
    romans: ['Im7', 'bVImaj7', 'IIm7b5', 'V7'] },
  { id: 'min-13451', label: 'Im - ♭III - IVm - V7 - Im', quality: 'minor', sources: ['diatonic'],
    romans: ['Im7', 'bIIImaj7', 'IVm7', 'V7', 'Im7'] },
  // Im-Vm-♭VI-♭VII は ♭VII7 が平行長調の V7 に聞こえてしまうため、Im に戻して終わる
  { id: 'min-nat', label: 'Im - Vm - ♭VI - Im', quality: 'minor', sources: ['diatonic'],
    romans: ['Im7', 'Vm7', 'bVImaj7', 'Im7'] },

  // --- メジャー: セカンダリードミナント ---
  { id: 'maj-sec-v2', label: 'I - V7/II - II - V', quality: 'major', sources: ['diatonic', 'secondary'],
    romans: ['Imaj7', 'V7/II', 'IIm7', 'V7'] },
  { id: 'maj-sec-v4', label: 'I - V7/IV - IV - I', quality: 'major', sources: ['diatonic', 'secondary'],
    romans: ['Imaj7', 'V7/IV', 'IVmaj7', 'Imaj7'] },
  { id: 'maj-sec-v5', label: 'I - V7/V - V - I', quality: 'major', sources: ['diatonic', 'secondary'],
    romans: ['Imaj7', 'V7/V', 'V7', 'Imaj7'] },
  { id: 'maj-sec-36251', label: 'III - V7/II - II - V - I', quality: 'major', sources: ['diatonic', 'secondary'],
    romans: ['IIIm7', 'V7/II', 'IIm7', 'V7', 'Imaj7'] },

  // --- マイナー: セカンダリードミナント ---
  { id: 'min-sec-v4', label: 'Im - V7/IV - IVm - V7 - Im', quality: 'minor', sources: ['diatonic', 'secondary'],
    romans: ['Im7', 'V7/IV', 'IVm7', 'V7', 'Im7'] },
  { id: 'min-sec-v5', label: 'Im - IVm - V7/V - V7 - Im', quality: 'minor', sources: ['diatonic', 'secondary'],
    romans: ['Im7', 'IVm7', 'V7/V', 'V7', 'Im7'] },

  // --- メジャー: 同主調からの借用 ---
  { id: 'maj-mi-4m', label: 'I - IV - IVm - I', quality: 'major', sources: ['diatonic', 'interchange'],
    romans: ['Imaj7', 'IVmaj7', 'IVm7', 'Imaj7'] },
  { id: 'maj-mi-b7', label: 'I - ♭VII - IV - I', quality: 'major', sources: ['diatonic', 'interchange'],
    romans: ['Imaj7', 'bVII7', 'IVmaj7', 'Imaj7'] },
  { id: 'maj-mi-b6b7', label: 'I - ♭VI - ♭VII - I', quality: 'major', sources: ['diatonic', 'interchange'],
    romans: ['Imaj7', 'bVImaj7', 'bVII7', 'Imaj7'] },

  // --- マイナー: 借用 ---
  { id: 'min-mi-4', label: 'Im - IV - ♭VI - V7', quality: 'minor', sources: ['diatonic', 'interchange'],
    romans: ['Im7', 'IVmaj7', 'bVImaj7', 'V7'] },
  { id: 'min-mi-b2', label: 'Im - ♭II - V7 - Im', quality: 'minor', sources: ['diatonic', 'interchange'],
    romans: ['Im7', 'bIImaj7', 'V7', 'Im7'] },
];

export interface Progression {
  key: KeyId;
  template: ProgressionTemplate;
  specs: DegreeSpec[];
  chords: ResolvedChord[];
}

export function buildProgression(
  key: KeyId,
  template: ProgressionTemplate,
  notation: ChordNotation = 'triad',
): Progression | null {
  const pool = degreePool(key.quality, ['diatonic', 'secondary', 'interchange']);
  const specs: DegreeSpec[] = [];
  for (const roman of template.romans) {
    const spec = pool.find((s) => s.roman === roman);
    if (!spec) return null;
    specs.push(spec);
  }
  return {
    key,
    template,
    specs,
    chords: specs.map((s) => resolveChord(key.pc, key.quality, s, notation)),
  };
}

export function progressionChordRefs(p: Progression): ChordRef[] {
  return p.chords.map((c) => ({ rootPc: c.rootPc, quality: c.spec.quality }));
}

/** 選択中の出どころで組めるテンプレート */
export function availableTemplates(sources: ChordSource[]): ProgressionTemplate[] {
  return PROGRESSION_TEMPLATES.filter((t) => t.sources.every((s) => sources.includes(s)));
}

/**
 * キーが一意に決まる進行だけを返す。
 * テンプレート側で音楽的に自然な進行を作り、そのうえで必ず判定器を通す。
 */
export function makeUniqueProgression(
  key: KeyId,
  sources: ChordSource[],
  notation: ChordNotation = 'triad',
  attempts = 24,
): Progression | null {
  const pool = availableTemplates(sources).filter((t) => t.quality === key.quality);
  if (pool.length === 0) return null;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (const template of shuffled.slice(0, attempts)) {
    const prog = buildProgression(key, template, notation);
    if (!prog) continue;
    if (checkUniqueness(progressionChordRefs(prog), key, sources).ok) return prog;
  }
  return null;
}
