import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '../components/ui';
import { HelpBar } from '../components/Help';
import { pretty } from '../music/notes';
import { SCALES } from '../music/scales';
import { playFeedback } from '../audio';
import type { IntervalChoice, IntervalQuestion } from '../session/generator';
import type { QuestionResult } from '../types';

const REVEAL_MS = 1000;
const REVEAL_MISS_MS = 1900;

export function IntervalQuiz({
  question,
  onAnswer,
}: {
  question: IntervalQuestion;
  onAnswer: (r: QuestionResult) => void;
}) {
  const [picked, setPicked] = useState<IntervalChoice | null>(null);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const shownAtRef = useRef(performance.now());
  const answeredRef = useRef(false);

  useEffect(() => {
    setPicked(null);
    setResult(null);
    shownAtRef.current = performance.now();
    answeredRef.current = false;
  }, [question.id]);

  const answer = useCallback(
    (choice: IntervalChoice) => {
      if (answeredRef.current) return;
      answeredRef.current = true;
      setPicked(choice);
      const elapsed = performance.now() - shownAtRef.current;
      const ok = choice.roman === question.answer.roman;
      const r: QuestionResult = {
        firstTapLatencyMs: elapsed,
        completionTimeMs: 0,
        accuracy: ok ? 1 : 0,
        isCorrect: ok,
        skipped: false,
        timedOut: false,
        pickedDegree: choice.roman,
      };
      setResult(r);
      playFeedback(ok);
    },
    [question.answer.roman],
  );

  useEffect(() => {
    if (!result) return;
    // 間違えたときは「何が正解だったか」を読む時間を長めにとる
    const t = setTimeout(() => onAnswer(result), result.isCorrect ? REVEAL_MS : REVEAL_MISS_MS);
    return () => clearTimeout(t);
  }, [result, onAnswer]);

  const asksChord = question.direction === 'toChord';

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-2xl flex-col justify-center gap-6 p-4">
      <HelpBar topic="interval" />

      <div className="pop-in text-center" key={question.id}>
        <div className="text-sm font-medium tracking-wide text-slate-400 dark:text-ink-400">
          キー <span className="text-slate-700 dark:text-ink-200">{pretty(question.keyLabel)}</span>
        </div>
        <div className="mt-1 text-4xl font-bold tracking-tight">
          {pretty(asksChord ? question.chord.roman : question.chord.symbol)}
        </div>
        <div className="mt-1.5 text-base text-slate-500 dark:text-ink-400">
          {asksChord ? 'は、どのコード?' : 'は、何度?'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {question.choices.map((c) => {
          const isAnswer = c.roman === question.answer.roman;
          const isPicked = picked !== null && c.roman === picked.roman;
          return (
            <button
              key={c.roman + c.label}
              type="button"
              onClick={() => answer(c)}
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

      {result && (
        <div className="pop-in space-y-1 text-center text-sm">
          <div className={cx('font-bold', result.isCorrect ? 'text-good' : 'text-bad')}>
            {result.isCorrect ? '正解' : '不正解'}
            <span className="tabular ml-2 font-normal text-slate-500 dark:text-ink-400">
              {(result.firstTapLatencyMs / 1000).toFixed(2)}s
            </span>
          </div>
          <div className="text-slate-500 dark:text-ink-400">
            {pretty(question.keyLabel)} の {pretty(question.chord.roman)} は{' '}
            <b className="text-slate-700 dark:text-ink-200">{pretty(question.chord.symbol)}</b>
            {' — '}
            {pretty(question.chord.rootName)} {SCALES[question.chord.scale].name}
          </div>
        </div>
      )}
    </div>
  );
}
