import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, cx, fmtMs } from '../components/ui';
import { HelpBar } from '../components/Help';
import { keyNameWithAlt, mod12, pretty } from '../music/notes';
import { playFeedback } from '../audio';
import {
  enharmonicChoiceLabel,
  type DiatonicFillQuestion,
  type DiatonicReverseQuestion,
  type ScaleToneQuestion,
} from '../session/generator';
import type { QuestionResult } from '../types';

const REVEAL_OK_MS = 1100;
const REVEAL_MISS_MS = 2400;

export type DiatonicQuestion =
  | DiatonicFillQuestion
  | DiatonicReverseQuestion
  | ScaleToneQuestion;

interface Timing {
  shownAt: number;
  firstInputAt: number | null;
}

/** 3つの出題形式で共通の、計測と答え合わせの進行 */
function useQuizFlow(questionId: string, onAnswer: (r: QuestionResult) => void) {
  const [result, setResult] = useState<QuestionResult | null>(null);
  const timing = useRef<Timing>({ shownAt: performance.now(), firstInputAt: null });
  const answered = useRef(false);

  useEffect(() => {
    setResult(null);
    timing.current = { shownAt: performance.now(), firstInputAt: null };
    answered.current = false;
  }, [questionId]);

  const markInput = useCallback(() => {
    if (timing.current.firstInputAt === null) timing.current.firstInputAt = performance.now();
  }, []);

  const finish = useCallback(
    (accuracy: number, isCorrect: boolean, extra?: Partial<QuestionResult>) => {
      if (answered.current) return;
      answered.current = true;
      const now = performance.now();
      const { shownAt, firstInputAt } = timing.current;
      const r: QuestionResult = {
        firstTapLatencyMs: (firstInputAt ?? now) - shownAt,
        completionTimeMs: firstInputAt === null ? 0 : now - firstInputAt,
        accuracy,
        isCorrect,
        skipped: false,
        timedOut: false,
        ...extra,
      };
      setResult(r);
      playFeedback(isCorrect);
    },
    [],
  );

  const giveUp = useCallback(() => {
    if (answered.current) return;
    answered.current = true;
    const r: QuestionResult = {
      firstTapLatencyMs: performance.now() - timing.current.shownAt,
      completionTimeMs: 0,
      accuracy: 0,
      isCorrect: false,
      skipped: true,
      timedOut: false,
    };
    setResult(r);
    playFeedback(false);
  }, []);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => onAnswer(result), result.isCorrect ? REVEAL_OK_MS : REVEAL_MISS_MS);
    return () => clearTimeout(t);
  }, [result, onAnswer]);

  return { result, markInput, finish, giveUp };
}

function Shell({
  children,
  result,
  detail,
  onNext,
  onGiveUp,
}: {
  children: React.ReactNode;
  result: QuestionResult | null;
  detail: React.ReactNode;
  onNext: () => void;
  onGiveUp?: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-2xl flex-col justify-center gap-4 p-4">
      <HelpBar topic="diatonic" />
      {children}
      {result ? (
        <div className="pop-in space-y-1.5 text-center">
          <div
            className={cx(
              'text-xl font-bold',
              result.isCorrect ? 'text-good' : result.skipped ? 'text-warn' : 'text-bad',
            )}
          >
            {result.isCorrect ? '正解' : result.skipped ? 'スキップ' : '不正解'}
            {!result.isCorrect && !result.skipped && result.accuracy > 0 && (
              <span className="ml-2 text-base font-normal">
                ({Math.round(result.accuracy * 100)}%)
              </span>
            )}
          </div>
          <div className="text-sm">{detail}</div>
          <div className="tabular text-xs text-slate-500 dark:text-ink-400">
            初手 {fmtMs(result.firstTapLatencyMs)}
            {result.completionTimeMs > 0 && <> / 完了 {fmtMs(result.completionTimeMs)}</>}
          </div>
          <Button size="sm" variant="ghost" onClick={onNext}>
            次へ →
          </Button>
        </div>
      ) : (
        onGiveUp && (
          <div className="text-center">
            <Button size="sm" variant="danger" onClick={onGiveUp}>
              わからない
            </Button>
          </div>
        )
      )}
    </div>
  );
}

/* ---------------- 一覧を埋める ---------------- */

function FillTable({
  question,
  onAnswer,
}: {
  question: DiatonicFillQuestion;
  onAnswer: (r: QuestionResult) => void;
}) {
  const { result, markInput, finish, giveUp } = useQuizFlow(question.id, onAnswer);
  const [placed, setPlaced] = useState<(string | null)[]>([]);
  const [held, setHeld] = useState<string | null>(null);

  useEffect(() => {
    setPlaced(question.slots.map(() => null));
    setHeld(null);
  }, [question.id, question.slots]);

  const used = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of placed) if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    return counts;
  }, [placed]);

  const judge = useCallback(
    (next: (string | null)[]) => {
      const hit = next.filter((p, i) => p === question.slots[i].answer).length;
      finish(hit / question.slots.length, hit === question.slots.length);
    },
    [question.slots, finish],
  );

  const tapSlot = (i: number) => {
    if (result) return;
    markInput();
    setPlaced((prev) => {
      const next = [...prev];
      if (next[i]) {
        next[i] = null; // もう一度押すと外せる
      } else if (held) {
        next[i] = held;
        setHeld(null);
      }
      if (next.every((p) => p !== null)) setTimeout(() => judge(next), 200);
      return next;
    });
  };

  const tapChip = (sym: string) => {
    if (result) return;
    markInput();
    setHeld((h) => (h === sym ? null : sym));
  };

  const remaining = placed.filter((p) => p === null).length;

  return (
    <Shell
      result={result}
      onNext={() => result && onAnswer(result)}
      onGiveUp={giveUp}
      detail={
        <span className="text-slate-500 dark:text-ink-400">
          {/* 答え合わせは度数順に並べ直す (出題はシャッフルしている) */}
          {question.slots
            .slice()
            .sort((a, b) => a.semitone - b.semitone)
            .map((s) => `${pretty(s.roman)}=${pretty(s.answer)}`)
            .join('   ')}
        </span>
      }
    >
      <div className="text-center">
        <div className="text-sm text-slate-400 dark:text-ink-400">キー</div>
        <div className="text-4xl font-bold tracking-tight">
          {pretty(keyNameWithAlt(question.key.pc, question.key.quality))}
        </div>
        <div className="mt-1 text-sm text-slate-500 dark:text-ink-400">
          それぞれの度数に合うコードを置く
          {!result && remaining > 0 && <span className="tabular ml-2">残り {remaining}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {question.slots.map((slot, i) => {
          const value = placed[i];
          const ok = result && value === slot.answer;
          return (
            <button
              key={slot.roman + i}
              type="button"
              onClick={() => tapSlot(i)}
              disabled={!!result}
              className={cx(
                'rounded-xl border-2 border-dashed px-2 py-2 text-center transition-colors',
                result
                  ? ok
                    ? 'border-good/60 bg-good/15'
                    : 'border-bad/60 bg-bad/15'
                  : value
                    ? 'border-transparent bg-accent/15'
                    : held
                      ? 'border-accent/70 bg-accent/5'
                      : 'border-slate-300 dark:border-ink-600',
              )}
            >
              <div className="text-[11px] font-semibold text-slate-400 dark:text-ink-400">
                {pretty(slot.roman)}
              </div>
              <div className="text-base font-bold">
                {value ? pretty(value) : <span className="opacity-30">—</span>}
              </div>
              {result && !ok && (
                <div className="text-[11px] font-semibold text-good">{pretty(slot.answer)}</div>
              )}
            </button>
          );
        })}
      </div>

      {!result && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {question.chips.map((sym) => {
            const left = question.chips.filter((c) => c === sym).length - (used.get(sym) ?? 0);
            return (
              <button
                key={sym}
                type="button"
                disabled={left <= 0}
                onClick={() => tapChip(sym)}
                className={cx(
                  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  held === sym
                    ? 'bg-accent text-white'
                    : left <= 0
                      ? 'bg-slate-100 text-slate-300 dark:bg-ink-800 dark:text-ink-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700',
                )}
              >
                {pretty(sym)}
              </button>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

/* ---------------- 逆引き ---------------- */

function ReverseLookup({
  question,
  onAnswer,
}: {
  question: DiatonicReverseQuestion;
  onAnswer: (r: QuestionResult) => void;
}) {
  const { result, markInput, finish } = useQuizFlow(question.id, onAnswer);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => setPicked(null), [question.id]);

  const choose = (label: string) => {
    if (result) return;
    markInput();
    setPicked(label);
    const ok = label === question.answer.label;
    finish(ok ? 1 : 0, ok, { pickedDegree: label });
  };

  return (
    <Shell
      result={result}
      onNext={() => result && onAnswer(result)}
      detail={
        <span className="text-slate-500 dark:text-ink-400">
          {pretty(question.chord.symbol)} は{' '}
          <b className="text-slate-700 dark:text-ink-200">{pretty(question.answer.label)}</b> の{' '}
          {pretty(question.degreeInMajor)} / {pretty(question.degreeInMinor)}
        </span>
      }
    >
      <div className="pop-in text-center" key={question.id}>
        <div className="text-5xl font-bold tracking-tight">{pretty(question.chord.symbol)}</div>
        <div className="mt-2 text-base text-slate-500 dark:text-ink-400">
          を含むキーは?
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {question.choices.map((c) => {
          const isAnswer = c.label === question.answer.label;
          const isPicked = c.label === picked;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => choose(c.label)}
              disabled={!!result}
              className={cx(
                'rounded-xl py-5 text-lg font-semibold transition-colors',
                result && isAnswer
                  ? 'bg-good text-black'
                  : result && isPicked
                    ? 'bg-bad text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700',
              )}
            >
              {pretty(c.label)}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

/* ---------------- 構成音 ---------------- */

function ScaleTones({
  question,
  onAnswer,
}: {
  question: ScaleToneQuestion;
  onAnswer: (r: QuestionResult) => void;
}) {
  const { result, markInput, finish, giveUp } = useQuizFlow(question.id, onAnswer);
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => setPicked([]), [question.id]);

  const answerSet = useMemo(() => new Set(question.answerPcs), [question.answerPcs]);

  const toggle = (pc: number) => {
    if (result) return;
    markInput();
    setPicked((prev) => {
      const next = prev.includes(pc) ? prev.filter((x) => x !== pc) : [...prev, pc];
      if (next.length === 7) {
        const hit = next.filter((p) => answerSet.has(p)).length;
        setTimeout(() => finish(hit / 7, hit === 7), 200);
      }
      return next;
    });
  };

  return (
    <Shell
      result={result}
      onNext={() => result && onAnswer(result)}
      onGiveUp={giveUp}
      detail={
        <span className="text-base font-semibold text-accent">
          {question.spelled.map(pretty).join('  ')}
        </span>
      }
    >
      <div className="text-center">
        <div className="text-sm text-slate-400 dark:text-ink-400">キー</div>
        <div className="text-4xl font-bold tracking-tight">
          {pretty(keyNameWithAlt(question.key.pc, question.key.quality))}
        </div>
        <div className="mt-1 text-sm text-slate-500 dark:text-ink-400">
          構成音を7つ選ぶ
          {!result && <span className="tabular ml-2">{picked.length} / 7</span>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {Array.from({ length: 12 }, (_, pc) => {
          const isAnswer = answerSet.has(pc);
          const isPicked = picked.includes(mod12(pc));
          return (
            <button
              key={pc}
              type="button"
              onClick={() => toggle(pc)}
              disabled={!!result}
              className={cx(
                'rounded-xl py-3.5 text-[15px] font-semibold transition-colors',
                result
                  ? isAnswer
                    ? 'bg-good text-black'
                    : isPicked
                      ? 'bg-bad text-white'
                      : 'bg-slate-100 text-slate-400 dark:bg-ink-800 dark:text-ink-600'
                  : isPicked
                    ? 'bg-accent text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700',
              )}
            >
              {pretty(enharmonicChoiceLabel(pc))}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

export function DiatonicQuiz({
  question,
  onAnswer,
}: {
  question: DiatonicQuestion;
  onAnswer: (r: QuestionResult) => void;
}) {
  if (question.kind === 'diatonicFill') return <FillTable question={question} onAnswer={onAnswer} />;
  if (question.kind === 'scaleTones') return <ScaleTones question={question} onAnswer={onAnswer} />;
  return <ReverseLookup question={question} onAnswer={onAnswer} />;
}
