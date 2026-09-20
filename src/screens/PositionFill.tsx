import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fretboard, type Marker, type PaintMode } from '../components/Fretboard';
import { Button, cx, fmtMs } from '../components/ui';
import { HelpBar } from '../components/Help';
import { chordVoicing } from '../music/chords';
import { pcAt, posKey, type Position, type Tuning } from '../music/fretboard';
import { pretty } from '../music/notes';
import { SCALES } from '../music/scales';
import { FILL_TASKS } from '../music/tasks';
import { playChord, playFeedback } from '../audio';
import type { AppSettings, QuestionResult } from '../types';
import type { PositionFillQuestion } from '../session/generator';

const REVEAL_OK_MS = 1100;
/** 間違い・スキップは「何が正解だったか」を読む時間を長めに取る */
const REVEAL_MISS_MS = 2300;
const AUTO_JUDGE_DELAY_MS = 260;
/** 出題範囲の前後にこれだけ余分に描いて、枠の内外が見て分かるようにする */
const CONTEXT_FRETS = 3;
const MAX_FRET = 24;
/** これを超えるフレット数はスクロール表示に切り替える */
const SCROLL_FRET_SPAN = 13;

function shortScaleName(nameJa: string): string {
  return nameJa.replace(/\s*\(.*\)$/, '');
}

export function PositionFill({
  question,
  tuning,
  settings,
  orientation,
  onAnswer,
  onOpenReference,
}: {
  question: PositionFillQuestion;
  tuning: Tuning;
  settings: AppSettings;
  orientation: 'horizontal' | 'vertical';
  onAnswer: (r: QuestionResult) => void;
  onOpenReference: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [firstTapAt, setFirstTapAt] = useState<number | null>(null);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const shownAtRef = useRef(performance.now());
  const answeredRef = useRef(false);

  const correctKeys = useMemo(() => new Set(question.correct.map(posKey)), [question.correct]);
  const task = FILL_TASKS[question.task];
  const scaleDef = SCALES[question.chord.scale];

  // 出題が変わったら状態を全部リセット
  useEffect(() => {
    setSelected(new Set());
    setFirstTapAt(null);
    setResult(null);
    shownAtRef.current = performance.now();
    answeredRef.current = false;
    if (question.level === 4) {
      playChord(chordVoicing(question.chord.rootPc, question.chord.spec.quality));
    }
  }, [question.id, question.level, question.chord]);

  const finish = useCallback((r: QuestionResult) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setResult(r);
    playFeedback(r.isCorrect);
  }, []);

  const judge = useCallback(() => {
    const now = performance.now();
    const chosen = [...selected];
    const hit = chosen.filter((k) => correctKeys.has(k)).length;
    const extra = chosen.length - hit;
    const accuracy = correctKeys.size === 0 ? 0 : Math.max(0, (hit - extra) / correctKeys.size);
    finish({
      firstTapLatencyMs: (firstTapAt ?? now) - shownAtRef.current,
      completionTimeMs: firstTapAt === null ? 0 : now - firstTapAt,
      accuracy: Math.min(1, accuracy),
      isCorrect: hit === correctKeys.size && extra === 0,
      skipped: false,
      timedOut: false,
    });
  }, [selected, correctKeys, firstTapAt, finish]);

  const giveUp = useCallback(() => {
    const now = performance.now();
    finish({
      firstTapLatencyMs: now - shownAtRef.current,
      completionTimeMs: 0,
      accuracy: 0,
      isCorrect: false,
      skipped: true,
      timedOut: false,
    });
  }, [finish]);

  // 全部埋まったら自動判定 (ドラッグ中の誤爆を避けるため少し待つ)
  useEffect(() => {
    if (result || selected.size !== correctKeys.size || correctKeys.size === 0) return;
    const t = setTimeout(judge, AUTO_JUDGE_DELAY_MS);
    return () => clearTimeout(t);
  }, [selected, correctKeys.size, result, judge]);

  // 正解の形を見せてから次へ
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => onAnswer(result), result.isCorrect ? REVEAL_OK_MS : REVEAL_MISS_MS);
    return () => clearTimeout(t);
  }, [result, onAnswer]);

  const handlePaint = useCallback((p: Position, mode: PaintMode) => {
    if (answeredRef.current) return;
    setFirstTapAt((prev) => prev ?? performance.now());
    const key = posKey(p);
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === 'add') next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  // お題が「ルートを探す」ものなら、ルートのヒントは答えそのものなので出せない
  const showRootHint = question.level <= 2 && question.task !== 'root';
  const showTapLabels = question.level === 1;

  const markers = useMemo(() => {
    const m = new Map<string, Marker>();
    const labelOf = (k: string) => {
      const [s, f] = k.split(':').map(Number);
      return question.degreeByPc.get(pcAt(tuning, s, f));
    };

    if (result) {
      for (const k of correctKeys) {
        m.set(
          k,
          selected.has(k)
            ? { kind: 'correct', label: labelOf(k) }
            : { kind: 'missing', label: labelOf(k) },
        );
      }
      for (const k of selected) {
        if (!correctKeys.has(k)) m.set(k, { kind: 'extra' });
      }
      return m;
    }

    if (showRootHint) {
      for (const p of question.rootPositions) m.set(posKey(p), { kind: 'hint', label: '1' });
    }
    // オクターブ形は起点を示さないとお題が成立しない
    if (question.anchor) m.set(posKey(question.anchor), { kind: 'anchor', label: '1' });
    for (const k of selected) {
      m.set(k, { kind: 'user', label: showTapLabels ? labelOf(k) : undefined });
    }
    return m;
  }, [
    result,
    correctKeys,
    selected,
    showRootHint,
    showTapLabels,
    question.rootPositions,
    question.anchor,
    question.degreeByPc,
    tuning,
  ]);

  const boardMin = Math.max(0, question.window.startFret - CONTEXT_FRETS);
  const boardMax = Math.min(MAX_FRET, question.window.endFret + CONTEXT_FRETS);
  const scrolls = boardMax - boardMin + 1 > SCROLL_FRET_SPAN;
  const remaining = correctKeys.size - selected.size;
  const scaleLine = `${pretty(question.chord.rootName)} ${shortScaleName(scaleDef.nameJa)}`;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-4xl flex-col justify-center gap-3 p-3">
      <HelpBar topic="positionFill" />

      {/* 出題 */}
      <div className="pop-in text-center" key={question.id}>
        <div className="text-sm font-medium tracking-wide text-slate-400 dark:text-ink-400">
          キー <span className="text-slate-700 dark:text-ink-200">{pretty(question.keyLabel)}</span>
        </div>
        {question.level === 4 ? (
          <button
            type="button"
            onClick={() =>
              playChord(chordVoicing(question.chord.rootPc, question.chord.spec.quality))
            }
            className="mt-1 text-4xl"
            title="もう一度鳴らす"
          >
            🔊
          </button>
        ) : (
          <div className="mt-0.5 text-5xl leading-tight font-bold tracking-tight">
            {pretty(question.chord.symbol)}
          </div>
        )}
        {/* 何をタップするのか。ここがコードごとに変わるので、キーだけでは解けない */}
        <div className="mt-1.5 inline-block rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
          {task.label}
          <span className="ml-1.5 font-normal opacity-80">{task.instruction}</span>
        </div>
        {question.level === 1 && (
          <div className="mt-1 text-xs text-slate-400 dark:text-ink-400">{scaleLine}</div>
        )}
      </div>

      {/* 指板 */}
      <Fretboard
        tuning={tuning}
        minFret={boardMin}
        maxFret={boardMax}
        orientation={orientation}
        lefty={settings.lefty}
        markers={markers}
        window={question.window}
        interactive={!result}
        selected={selected}
        onPaint={handlePaint}
        zoom={scrolls ? 1 : undefined}
        focusFret={scrolls ? question.window.startFret : undefined}
        maxHeight="min(52vh, 470px)"
      />

      {/* 結果 or 操作 */}
      {result ? (
        <div className="pop-in space-y-1.5 text-center">
          <div
            className={cx(
              'text-xl font-bold',
              result.isCorrect ? 'text-good' : result.skipped ? 'text-warn' : 'text-bad',
            )}
          >
            {result.isCorrect
              ? '正解'
              : result.skipped
                ? 'スキップ'
                : `不正解 (${Math.round(result.accuracy * 100)}%)`}
          </div>
          <div className="text-base font-semibold">
            {pretty(question.chord.roman)} · {pretty(question.chord.symbol)} —{' '}
            <span className="text-accent">{scaleLine}</span>
          </div>
          <div className="tabular text-sm text-slate-500 dark:text-ink-400">
            初手{' '}
            <b className="text-slate-800 dark:text-ink-200">{fmtMs(result.firstTapLatencyMs)}</b>
            {' / '}
            完了 <b className="text-slate-800 dark:text-ink-200">{fmtMs(result.completionTimeMs)}</b>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onAnswer(result)}>
            次へ →
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="tabular mr-1 text-sm text-slate-400 dark:text-ink-400">
            残り {Math.max(0, remaining)}
          </span>
          <Button size="sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
            リセット
          </Button>
          <Button size="sm" variant="primary" onClick={judge} disabled={selected.size === 0}>
            回答
          </Button>
          <Button size="sm" variant="danger" onClick={giveUp}>
            わからない
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenReference}>
            📖
          </Button>
        </div>
      )}
    </div>
  );
}
