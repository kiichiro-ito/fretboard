import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, cx, fmtMs } from '../components/ui';
import { HelpBar } from '../components/Help';
import { chordVoicing } from '../music/chords';
import { keyNameWithAlt, pretty } from '../music/notes';
import { playFeedback, playProgression } from '../audio';
import type { ProgressionQuestion } from '../session/generator';
import type { QuestionResult } from '../types';

const REVEAL_OK_MS = 1800;
const REVEAL_MISS_MS = 3200;

export function ProgressionQuiz({
  question,
  onAnswer,
}: {
  question: ProgressionQuestion;
  onAnswer: (r: QuestionResult) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const shownAtRef = useRef(performance.now());
  const answeredRef = useRef(false);

  useEffect(() => {
    setPicked(null);
    setResult(null);
    shownAtRef.current = performance.now();
    answeredRef.current = false;
  }, [question.id]);

  const choose = useCallback(
    (label: string) => {
      if (answeredRef.current) return;
      answeredRef.current = true;
      setPicked(label);
      const ok = label === question.answer.label;
      const r: QuestionResult = {
        firstTapLatencyMs: performance.now() - shownAtRef.current,
        completionTimeMs: 0,
        accuracy: ok ? 1 : 0,
        isCorrect: ok,
        skipped: false,
        timedOut: false,
        pickedDegree: label,
      };
      setResult(r);
      playFeedback(ok);
    },
    [question.answer.label],
  );

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => onAnswer(result), result.isCorrect ? REVEAL_OK_MS : REVEAL_MISS_MS);
    return () => clearTimeout(t);
  }, [result, onAnswer]);

  const { chords, specs, template } = question.progression;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col justify-center gap-5 p-4">
      <HelpBar topic="progression" />

      {/* 進行 */}
      <div className="pop-in" key={question.id}>
        <div className="mb-2 text-center text-sm text-slate-400 dark:text-ink-400">
          この進行のキーは?
        </div>
        <div className="flex flex-wrap items-stretch justify-center gap-2">
          {chords.map((c, i) => (
            <div
              key={i}
              className={cx(
                'min-w-[5.5rem] flex-1 rounded-xl px-3 py-4 text-center transition-colors',
                result ? 'bg-accent/10' : 'bg-slate-100 dark:bg-ink-800',
              )}
            >
              <div className="text-2xl font-bold tracking-tight">{pretty(c.symbol)}</div>
              {/* 答え合わせで度数を出す。進行を「度数のかたまり」で覚えるのがこのゲームの本体 */}
              {result && (
                <div className="pop-in mt-1 text-sm font-semibold text-accent">
                  {pretty(c.roman)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 選択肢 */}
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

      {result && (
        <div className="pop-in space-y-1.5 text-center">
          <div className={cx('text-xl font-bold', result.isCorrect ? 'text-good' : 'text-bad')}>
            {result.isCorrect ? '正解' : '不正解'}
          </div>
          <div className="text-sm">
            <b>{pretty(keyNameWithAlt(question.key.pc, question.key.quality))}</b>
            <span className="ml-2 text-slate-500 dark:text-ink-400">
              {pretty(template.label)}
            </span>
          </div>
          <div className="tabular text-xs text-slate-500 dark:text-ink-400">
            回答 {fmtMs(result.firstTapLatencyMs)}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              playProgression(specs.map((s, i) => chordVoicing(chords[i].rootPc, s.quality)))
            }
            title="鳴らしてみる"
          >
            🔊 鳴らす
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAnswer(result)}>
            次へ →
          </Button>
        </div>
      )}
    </div>
  );
}
