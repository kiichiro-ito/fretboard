import { useMemo, useState } from 'react';
import { Button, Card, Chip, Field, Segmented, Toggle, cx } from '../components/ui';
import { ModeIntro } from '../components/Help';
import { CHORD_SOURCE_LABEL, type ChordSource } from '../music/chords';
import { getTuning, allStrings } from '../music/fretboard';
import { FILL_TASK_LIST, type FillTask } from '../music/tasks';
import { keyName, pretty } from '../music/notes';
import { weakKeys } from '../storage';
import type { KeySel, Level, SessionConfig, SessionRecord } from '../types';
import { ALL_KEYS } from '../session/generator';

const MODE_LABEL: Record<SessionConfig['mode'], string> = {
  positionFill: 'ポジション・フィル',
  noteName: '音名当て',
  interval: 'キー×度数',
};

function sameKey(a: KeySel, b: KeySel) {
  return a.pc === b.pc && a.quality === b.quality;
}

const FRET_MIN_OPTIONS = [0, 1, 5, 12];
const FRET_MAX_OPTIONS = [12, 15, 19, 24];
/** 窓を置くのに最低限必要なフレット数 */
const MIN_FRET_SPAN = 4;

export function SessionSetup({
  config,
  onChange,
  onStart,
  sessions,
  hasPrevious,
  onOpenReference,
  onOpenSettings,
  onOpenHistory,
  tuningId,
}: {
  config: SessionConfig;
  onChange: (c: SessionConfig) => void;
  onStart: () => void;
  sessions: SessionRecord[];
  hasPrevious: boolean;
  onOpenReference: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  tuningId: string;
}) {
  const [advanced, setAdvanced] = useState(false);
  const tuning = getTuning(tuningId);
  const weak = useMemo(() => weakKeys(sessions, 6, config.mode), [sessions, config.mode]);

  const set = <K extends keyof SessionConfig>(k: K, v: SessionConfig[K]) =>
    onChange({ ...config, [k]: v });

  /** 下限と上限が逆転したり、窓を置けないほど狭くなったりしないようにする */
  const setFretRange = (
    key: 'fretMin' | 'fretMax' | 'noteQuizFretMin' | 'noteQuizFretMax',
    value: number,
  ) => {
    const isNote = key.startsWith('noteQuiz');
    const minKey = isNote ? 'noteQuizFretMin' : 'fretMin';
    const maxKey = isNote ? 'noteQuizFretMax' : 'fretMax';
    const next = { ...config, [key]: value };
    if (next[maxKey] - next[minKey] < MIN_FRET_SPAN) {
      if (key === minKey) {
        next[maxKey] =
          FRET_MAX_OPTIONS.find((n) => n - value >= MIN_FRET_SPAN) ??
          FRET_MAX_OPTIONS[FRET_MAX_OPTIONS.length - 1];
      } else {
        next[minKey] =
          [...FRET_MIN_OPTIONS].reverse().find((n) => value - n >= MIN_FRET_SPAN) ??
          FRET_MIN_OPTIONS[0];
      }
    }
    onChange(next);
  };

  const activeKeys: KeySel[] =
    config.keyPreset === 'all'
      ? ALL_KEYS
      : config.keyPreset === 'weak'
        ? weak.map((w) => ({ pc: w.pc, quality: w.quality }))
        : config.keys;

  const toggleKey = (k: KeySel) => {
    const exists = config.keys.some((x) => sameKey(x, k));
    onChange({
      ...config,
      keyPreset: 'manual',
      keys: exists ? config.keys.filter((x) => !sameKey(x, k)) : [...config.keys, k],
    });
  };

  const startDisabled = activeKeys.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-3 pb-28">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Fretboard Trainer</h1>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onOpenReference} title="スケール・リファレンス">
            📖 リファレンス
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenHistory} title="履歴">
            📈
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenSettings} title="設定">
            ⚙
          </Button>
        </div>
      </div>

      {/* 2タップ起動 */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={onStart}
        disabled={startDisabled}
      >
        {hasPrevious ? '前回と同じ設定で開始' : 'セッション開始'}
        <span className="ml-2 text-sm font-normal opacity-80">
          {MODE_LABEL[config.mode]} · Lv{config.level} ·{' '}
          {config.lengthType === 'count' ? `${config.count}問` : `${config.minutes}分`}
        </span>
      </Button>

      <Card className="space-y-4">
        <Field label="モード">
          <div className="space-y-2">
            <Segmented
              value={config.mode}
              onChange={(v) => set('mode', v)}
              options={[
                { value: 'positionFill', label: 'ポジション・フィル' },
                { value: 'noteName', label: '音名当て' },
                { value: 'interval', label: 'キー×度数' },
              ]}
            />
            <ModeIntro topic={config.mode} />
          </div>
        </Field>

        {config.mode === 'positionFill' && (
          <Field
            label="難易度"
            hint={
              [
                'Lv1: コード名 + ルート位置 + 度数ラベル',
                'Lv2: コード名 + ルート位置',
                'Lv3: コード名のみ (ルートも自分で探す)',
                'Lv4: コードを鳴らすだけ (音で判断)',
              ][config.level - 1]
            }
          >
            <Segmented
              value={config.level}
              onChange={(v) => set('level', v as Level)}
              options={[1, 2, 3, 4].map((n) => ({ value: n, label: `Lv${n}` }))}
            />
          </Field>
        )}

        {config.mode === 'positionFill' && (
          <Field
            label="お題"
            hint="コードごとに答えが変わるものだけを扱う。複数選ぶとランダムに出る"
          >
            <div className="flex flex-wrap gap-1">
              {FILL_TASK_LIST.map((t) => {
                const on = config.fillTasks.includes(t.id);
                return (
                  <Chip
                    key={t.id}
                    active={on}
                    tone="accent"
                    onClick={() => {
                      const next = on
                        ? config.fillTasks.filter((x) => x !== t.id)
                        : [...config.fillTasks, t.id];
                      set('fillTasks', next.length ? next : ([t.id] as FillTask[]));
                    }}
                  >
                    {t.label}
                  </Chip>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="セッション長">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              value={config.lengthType}
              onChange={(v) => set('lengthType', v)}
              options={[
                { value: 'count', label: '問題数' },
                { value: 'time', label: '時間' },
              ]}
            />
            {config.lengthType === 'count' ? (
              <Segmented
                size="sm"
                value={config.count}
                onChange={(v) => set('count', v)}
                options={[10, 20, 30].map((n) => ({ value: n, label: `${n}問` }))}
              />
            ) : (
              <Segmented
                size="sm"
                value={config.minutes}
                onChange={(v) => set('minutes', v)}
                options={[3, 5, 10].map((n) => ({ value: n, label: `${n}分` }))}
              />
            )}
          </div>
        </Field>

        {config.mode !== 'noteName' && (
          <Field
            label="対象キー"
            hint={
              config.keyPreset === 'weak' && weak.length === 0
                ? 'まだデータがありません。何回か練習すると苦手キーが出ます'
                : `${activeKeys.length} キー`
            }
          >
            <div className="space-y-2">
              <Segmented
                size="sm"
                value={config.keyPreset}
                onChange={(v) => set('keyPreset', v)}
                options={[
                  { value: 'all', label: '全キー均等' },
                  { value: 'weak', label: '苦手キーのみ' },
                  { value: 'manual', label: '手動選択' },
                ]}
              />
              {config.keyPreset === 'weak' && weak.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {weak.map((w) => (
                    <span
                      key={w.key + w.quality}
                      className="tabular rounded-lg bg-bad/15 px-2 py-1 text-sm text-bad"
                    >
                      {pretty(w.key)}
                      <span className="ml-1 text-xs opacity-70">
                        {(w.avgFirstTapLatencyMs / 1000).toFixed(1)}s
                      </span>
                    </span>
                  ))}
                </div>
              )}
              {config.keyPreset === 'manual' && (
                <div className="space-y-1.5">
                  {(['minor', 'major'] as const).map((q) => (
                    <div key={q} className="flex flex-wrap items-center gap-1">
                      <span className="w-14 shrink-0 text-[11px] font-semibold text-slate-400 dark:text-ink-400">
                        {q === 'minor' ? 'マイナー' : 'メジャー'}
                      </span>
                      {Array.from({ length: 12 }, (_, pc) => {
                        const k: KeySel = { pc, quality: q };
                        return (
                          <Chip
                            key={pc}
                            active={config.keys.some((x) => sameKey(x, k))}
                            tone="accent"
                            onClick={() => toggleKey(k)}
                          >
                            {pretty(keyName(pc, q))}
                          </Chip>
                        );
                      })}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onChange({ ...config, keys: [] })}>
                      全解除
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Field>
        )}

        <Toggle checked={advanced} onChange={setAdvanced} label="詳細設定" />

        {advanced && (
          <div className="space-y-4 border-t border-slate-200 pt-3 dark:border-ink-700">
            {config.mode === 'positionFill' && (
              <>
                <Field label="窓幅" hint="1問あたりの負荷。狭いほど回転が速い">
                  <Segmented
                    size="sm"
                    value={config.windowWidth}
                    onChange={(v) => set('windowWidth', v)}
                    options={[
                      { value: 4, label: '4F' },
                      { value: 5, label: '5F' },
                      { value: 6, label: '6F' },
                      { value: 0, label: '全域' },
                    ]}
                  />
                </Field>
                <Field label="弦範囲">
                  <Segmented
                    size="sm"
                    value={config.stringRange}
                    onChange={(v) => set('stringRange', v)}
                    options={[
                      { value: 'two', label: '隣接2弦' },
                      { value: 'three', label: '隣接3弦' },
                      { value: 'all', label: `全${tuning.stringCount}弦` },
                    ]}
                  />
                </Field>
                <Field label="フレット範囲" hint="窓が置かれる範囲。24F まで使える">
                  <div className="flex flex-wrap items-center gap-2">
                    <Segmented
                      size="sm"
                      value={config.fretMin}
                      onChange={(v) => setFretRange('fretMin', v)}
                      options={FRET_MIN_OPTIONS.map((n) => ({ value: n, label: `${n}F〜` }))}
                    />
                    <Segmented
                      size="sm"
                      value={config.fretMax}
                      onChange={(v) => setFretRange('fretMax', v)}
                      options={FRET_MAX_OPTIONS.map((n) => ({ value: n, label: `〜${n}F` }))}
                    />
                  </div>
                </Field>
              </>
            )}

            {config.mode !== 'noteName' && (
              <Field label="出題範囲">
                <div className="flex flex-wrap gap-1">
                  {(['diatonic', 'secondary', 'interchange'] as ChordSource[]).map((s) => {
                    const on = config.chordSources.includes(s);
                    return (
                      <Chip
                        key={s}
                        active={on}
                        tone="accent"
                        onClick={() => {
                          const next = on
                            ? config.chordSources.filter((x) => x !== s)
                            : [...config.chordSources, s];
                          set('chordSources', next.length ? next : ['diatonic']);
                        }}
                      >
                        {CHORD_SOURCE_LABEL[s]}
                      </Chip>
                    );
                  })}
                </div>
              </Field>
            )}

            {config.mode === 'interval' && (
              <Field label="出題方向">
                <Segmented
                  size="sm"
                  value={config.intervalDirection}
                  onChange={(v) => set('intervalDirection', v)}
                  options={[
                    { value: 'toChord', label: '度数 → コード' },
                    { value: 'toDegree', label: 'コード → 度数' },
                    { value: 'both', label: '両方' },
                  ]}
                />
              </Field>
            )}

            {config.mode === 'noteName' && (
              <>
                <Field label="対象弦">
                  <div className="flex flex-wrap gap-1">
                    {allStrings(tuning).map((s) => {
                      const on = config.noteQuizStrings.includes(s);
                      return (
                        <Chip
                          key={s}
                          active={on}
                          tone="accent"
                          onClick={() => {
                            const next = on
                              ? config.noteQuizStrings.filter((x) => x !== s)
                              : [...config.noteQuizStrings, s];
                            set('noteQuizStrings', next.length ? next.sort((a, b) => a - b) : [s]);
                          }}
                        >
                          {s}弦
                        </Chip>
                      );
                    })}
                  </div>
                </Field>
                <Field label="フレット範囲">
                  <div className="flex items-center gap-2">
                    <Segmented
                      size="sm"
                      value={config.noteQuizFretMin}
                      onChange={(v) => setFretRange('noteQuizFretMin', v)}
                      options={FRET_MIN_OPTIONS.map((n) => ({ value: n, label: `${n}F〜` }))}
                    />
                    <Segmented
                      size="sm"
                      value={config.noteQuizFretMax}
                      onChange={(v) => setFretRange('noteQuizFretMax', v)}
                      options={FRET_MAX_OPTIONS.map((n) => ({ value: n, label: `〜${n}F` }))}
                    />
                  </div>
                </Field>
                <Field label="制限時間">
                  <Segmented
                    size="sm"
                    value={config.noteQuizTimeLimitSec}
                    onChange={(v) => set('noteQuizTimeLimitSec', v)}
                    options={[
                      { value: 0, label: 'なし' },
                      { value: 5, label: '5秒' },
                      { value: 3, label: '3秒' },
                    ]}
                  />
                </Field>
              </>
            )}
          </div>
        )}
      </Card>

      {startDisabled && (
        <div className={cx('text-center text-sm text-bad')}>キーを1つ以上選んでください</div>
      )}
    </div>
  );
}
