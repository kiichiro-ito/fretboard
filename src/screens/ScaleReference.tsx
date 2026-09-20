import { useEffect, useMemo, useState } from 'react';
import { Fretboard, type Marker } from '../components/Fretboard';
import { Button, Card, Field, Segmented, cx } from '../components/ui';
import { HelpBar, HelpButton } from '../components/Help';
import {
  getTuning,
  pcAt,
  posKey,
  scaleBoxes,
  allStrings,
  type FretWindow,
} from '../music/fretboard';
import { FLAT_NAMES, SHARP_NAMES, keyName, mod12, pretty, spellNote } from '../music/notes';
import {
  SCALES,
  SCALE_GROUP_LABEL,
  SCALE_LIST,
  degreeMap,
  scaleTones,
  type ScaleGroup,
  type ScaleType,
} from '../music/scales';
import { loadReferenceState, saveReferenceState } from '../storage';
import type { AppSettings, LabelMode } from '../types';

const LETTERS = 'CDEFGAB';

function letterIdxOf(name: string): number {
  return LETTERS.indexOf(name[0]);
}

export function ScaleReference({
  settings,
  orientation,
  onBack,
  compact = false,
  initialRootPc,
  initialScale,
}: {
  settings: AppSettings;
  orientation: 'horizontal' | 'vertical';
  onBack?: () => void;
  /** クイズ中のオーバーレイ表示用 */
  compact?: boolean;
  initialRootPc?: number;
  initialScale?: ScaleType;
}) {
  const saved = useMemo(() => loadReferenceState(), []);
  const [rootPc, setRootPc] = useState(initialRootPc ?? saved.rootPc);
  const [preferFlat, setPreferFlat] = useState(saved.preferFlat);
  const [scale, setScale] = useState<ScaleType>(
    initialScale ?? ((saved.scale as ScaleType) in SCALES ? (saved.scale as ScaleType) : 'aeolian'),
  );
  const [labelMode, setLabelMode] = useState<LabelMode>(
    (['degree', 'note', 'none'] as const).includes(saved.labelMode as LabelMode)
      ? (saved.labelMode as LabelMode)
      : 'degree',
  );
  const [showBoxes, setShowBoxes] = useState(saved.showBoxes);
  const [boxIndex, setBoxIndex] = useState(saved.boxIndex);
  const [maxFret, setMaxFret] = useState(15);

  useEffect(() => {
    saveReferenceState({ rootPc, scale, labelMode, boxIndex, showBoxes, preferFlat });
  }, [rootPc, scale, labelMode, boxIndex, showBoxes, preferFlat]);

  const tuning = getTuning(settings.tuningId);
  const rootName = (preferFlat ? FLAT_NAMES : SHARP_NAMES)[rootPc];
  const rootLetterIdx = letterIdxOf(rootName);
  const def = SCALES[scale];
  const tones = useMemo(
    () => scaleTones(rootPc, rootLetterIdx, scale),
    [rootPc, rootLetterIdx, scale],
  );
  const toneByPc = useMemo(() => degreeMap(tones), [tones]);

  const boxes = useMemo(
    () => scaleBoxes(tuning, rootPc, scale, maxFret),
    [tuning, rootPc, scale, maxFret],
  );
  const activeWindow: FretWindow | undefined = showBoxes
    ? boxes[Math.min(boxIndex, boxes.length - 1)]
    : undefined;

  const markers = useMemo(() => {
    const m = new Map<string, Marker>();
    for (const s of allStrings(tuning)) {
      for (let f = 0; f <= maxFret; f++) {
        const tone = toneByPc.get(pcAt(tuning, s, f));
        if (!tone) continue;
        m.set(posKey({ string: s, fret: f }), {
          kind: tone.isRoot ? 'root' : 'scale',
          label:
            labelMode === 'degree' ? tone.degree : labelMode === 'note' ? tone.name : undefined,
          ring: tone.isCharacteristic,
        });
      }
    }
    return m;
  }, [tuning, maxFret, toneByPc, labelMode]);

  const parent = useMemo(() => {
    if (def.parentOffset === undefined) return null;
    const majorRoot = mod12(rootPc - def.parentOffset);
    return {
      major: keyName(majorRoot, 'major'),
      minor: keyName(mod12(majorRoot + 9), 'minor'),
    };
  }, [def.parentOffset, rootPc]);

  const grouped = useMemo(() => {
    const g = new Map<ScaleGroup, typeof SCALE_LIST>();
    for (const s of SCALE_LIST) {
      const arr = g.get(s.group) ?? [];
      arr.push(s);
      g.set(s.group, arr);
    }
    return [...g.entries()];
  }, []);

  // フレット数が多いと縮小しすぎて読めなくなるので、等倍で描いて
  // フレット方向 (横向きなら横、縦向きなら縦) にスクロールさせる
  const isH = orientation === 'horizontal';
  const scrolls = maxFret + 1 > 13;
  const zoom = scrolls ? 1 : undefined;

  return (
    <div className={cx('mx-auto w-full max-w-5xl space-y-3', compact ? 'p-2' : 'p-3 pb-24')}>
      {!compact && (
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              ← 戻る
            </Button>
          )}
          <h1 className="text-lg font-semibold">スケール・リファレンス</h1>
          <HelpButton topic="reference" />
        </div>
      )}
      {compact && <HelpBar topic="reference" className="w-full" />}

      {/* ルート選択 */}
      <div className="flex flex-wrap items-center gap-1">
        {Array.from({ length: 12 }, (_, pc) => {
          const label = (preferFlat ? FLAT_NAMES : SHARP_NAMES)[pc];
          return (
            <button
              key={pc}
              type="button"
              onClick={() => setRootPc(pc)}
              className={cx(
                'min-w-11 rounded-lg px-2 py-2 text-sm font-semibold transition-colors',
                pc === rootPc
                  ? 'bg-root text-black'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700',
              )}
            >
              {pretty(label)}
            </button>
          );
        })}
        <Segmented
          size="sm"
          className="ml-1"
          value={preferFlat ? 'b' : '#'}
          onChange={(v) => setPreferFlat(v === 'b')}
          options={[
            { value: '#', label: '♯' },
            { value: 'b', label: '♭' },
          ]}
        />
      </div>

      {/* スケール選択 */}
      <div className="space-y-2">
        {grouped.map(([group, list]) => (
          <div key={group} className="flex flex-wrap items-center gap-1">
            <span className="w-24 shrink-0 text-[11px] font-semibold text-slate-400 dark:text-ink-400">
              {SCALE_GROUP_LABEL[group]}
            </span>
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setScale(s.id);
                  setBoxIndex(0);
                }}
                className={cx(
                  'rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                  s.id === scale
                    ? 'bg-accent text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-400 dark:hover:bg-ink-700',
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 指板 */}
      <Card className="!p-2">
        <Fretboard
          tuning={tuning}
          minFret={0}
          maxFret={maxFret}
          orientation={orientation}
          lefty={settings.lefty}
          markers={markers}
          window={activeWindow}
          zoom={zoom}
          focusFret={activeWindow?.startFret}
          maxHeight={isH ? 'min(52vh, 460px)' : 'min(64vh, 620px)'}
        />
      </Card>

      {/* 表示オプション */}
      <div className="flex flex-wrap items-end gap-4">
        <Field label="ラベル">
          <Segmented
            size="sm"
            value={labelMode}
            onChange={setLabelMode}
            options={[
              { value: 'degree', label: '度数' },
              { value: 'note', label: '音名' },
              { value: 'none', label: '非表示' },
            ]}
          />
        </Field>
        <Field label="ポジション">
          <div className="flex items-center gap-2">
            <Segmented
              size="sm"
              value={showBoxes ? 'box' : 'all'}
              onChange={(v) => setShowBoxes(v === 'box')}
              options={[
                { value: 'all', label: '全域' },
                { value: 'box', label: 'ボックス' },
              ]}
            />
            {showBoxes && (
              <div className="flex items-center gap-1">
                {boxes.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBoxIndex(i)}
                    className={cx(
                      'h-8 w-8 rounded-lg text-sm font-semibold',
                      i === boxIndex
                        ? 'bg-slate-800 text-white dark:bg-ink-200 dark:text-ink-900'
                        : 'bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-ink-400',
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>
        <Field label="フレット数">
          <Segmented
            size="sm"
            value={maxFret}
            onChange={setMaxFret}
            options={[
              { value: 12, label: '12F' },
              { value: 15, label: '15F' },
              { value: 24, label: '24F' },
            ]}
          />
        </Field>
      </div>

      {/* 付加情報 */}
      <Card className="space-y-2 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-semibold">
            {pretty(spellNote(rootLetterIdx, rootPc, preferFlat))} {def.name}
          </span>
          <span className="text-slate-400 dark:text-ink-400">{def.nameJa}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tones.map((t) => (
            <span
              key={t.degree}
              className={cx(
                'rounded-md px-2 py-1 text-[13px] tabular',
                t.isRoot
                  ? 'bg-root/20 text-root'
                  : t.isCharacteristic
                    ? 'bg-warn/15 text-warn'
                    : 'bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-ink-200',
              )}
            >
              {pretty(t.degree)} <span className="opacity-60">{pretty(t.name)}</span>
            </span>
          ))}
        </div>
        <div className="space-y-0.5 text-xs text-slate-500 dark:text-ink-400">
          {parent && (
            <div>
              親キー: <b>{pretty(parent.major)}</b> / <b>{pretty(parent.minor)}</b>
            </div>
          )}
          {def.characteristic.length > 0 && (
            <div>
              特性音: <b className="text-warn">{def.characteristic.map(pretty).join(', ')}</b>
              <span className="ml-1 opacity-70">(指板上は黄色い輪)</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
