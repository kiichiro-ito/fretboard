import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fretboard, type Marker } from '../components/Fretboard';
import { cx } from '../components/ui';
import { HelpBar } from '../components/Help';
import { NextButton, useAdvance } from '../components/advance';
import { midiAt, posKey, type Tuning } from '../music/fretboard';
import { mod12, pretty } from '../music/notes';
import { playFeedback, playNote } from '../audio';
import { enharmonicChoiceLabel, type NoteNameQuestion } from '../session/generator';
import type { AppSettings, QuestionResult, SessionConfig } from '../types';

const REVEAL_MS = 900;
/** これを超えるフレット数はスクロール表示に切り替える */
const SCROLL_FRET_SPAN = 13;

export function NoteNameQuiz({
  question,
  tuning,
  settings,
  config,
  orientation,
  onAnswer,
}: {
  question: NoteNameQuestion;
  tuning: Tuning;
  settings: AppSettings;
  config: SessionConfig;
  orientation: 'horizontal' | 'vertical';
  onAnswer: (r: QuestionResult) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [remainMs, setRemainMs] = useState(config.noteQuizTimeLimitSec * 1000);
  const shownAtRef = useRef(performance.now());
  const answeredRef = useRef(false);

  useEffect(() => {
    setPicked(null);
    setResult(null);
    setRemainMs(config.noteQuizTimeLimitSec * 1000);
    shownAtRef.current = performance.now();
    answeredRef.current = false;
  }, [question.id, config.noteQuizTimeLimitSec]);

  const finish = useCallback((r: QuestionResult) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setResult(r);
    playFeedback(r.isCorrect);
  }, []);

  const answer = useCallback(
    (pc: number) => {
      if (answeredRef.current) return;
      setPicked(pc);
      const elapsed = performance.now() - shownAtRef.current;
      const ok = mod12(pc) === question.answerPc;
      playNote(midiAt(tuning, question.position.string, question.position.fret) + 12, 0, 0.7, 0.1);
      finish({
        firstTapLatencyMs: elapsed,
        completionTimeMs: 0,
        accuracy: ok ? 1 : 0,
        isCorrect: ok,
        skipped: false,
        timedOut: false,
      });
    },
    [question, tuning, finish],
  );

  // 制限時間
  useEffect(() => {
    if (config.noteQuizTimeLimitSec <= 0 || result) return;
    const limit = config.noteQuizTimeLimitSec * 1000;
    const iv = setInterval(() => {
      const left = limit - (performance.now() - shownAtRef.current);
      setRemainMs(left);
      if (left <= 0) {
        finish({
          firstTapLatencyMs: limit,
          completionTimeMs: 0,
          accuracy: 0,
          isCorrect: false,
          skipped: false,
          timedOut: true,
        });
      }
    }, 50);
    return () => clearInterval(iv);
  }, [config.noteQuizTimeLimitSec, result, finish, question.id]);

  useAdvance(result, settings.autoAdvance, onAnswer, REVEAL_MS, REVEAL_MS);

  const markers = useMemo(() => {
    const m = new Map<string, Marker>();
    m.set(posKey(question.position), {
      kind: result ? (result.isCorrect ? 'correct' : 'extra') : 'target',
      label: result ? enharmonicChoiceLabel(question.answerPc).split('/')[0] : '?',
    });
    return m;
  }, [question, result]);

  const maxFret = Math.max(config.noteQuizFretMax, question.position.fret);
  const limitMs = config.noteQuizTimeLimitSec * 1000;
  const scrolls = maxFret + 1 > SCROLL_FRET_SPAN;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-4xl flex-col justify-center gap-3 p-3">
      {limitMs > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-ink-800">
          <div
            className="h-full rounded-full bg-warn transition-[width] duration-75"
            style={{ width: `${Math.max(0, Math.min(100, (remainMs / limitMs) * 100))}%` }}
          />
        </div>
      )}

      <HelpBar topic="noteName" />

      <Fretboard
        tuning={tuning}
        minFret={0}
        maxFret={maxFret}
        orientation={orientation}
        lefty={settings.lefty}
        markers={markers}
        zoom={scrolls ? 1 : undefined}
        focusFret={scrolls ? question.position.fret : undefined}
        maxHeight="min(62vh, 540px)"
      />

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {Array.from({ length: 12 }, (_, pc) => {
          const isAnswer = pc === question.answerPc;
          const isPicked = pc === picked;
          return (
            <button
              key={pc}
              type="button"
              onClick={() => answer(pc)}
              disabled={!!result}
              className={cx(
                'rounded-xl py-3.5 text-[15px] font-semibold transition-colors',
                result && isAnswer
                  ? 'bg-good text-black'
                  : result && isPicked
                    ? 'bg-bad text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700',
              )}
            >
              {pretty(enharmonicChoiceLabel(pc))}
            </button>
          );
        })}
      </div>

      {result && (
        <div className="pop-in tabular text-center text-sm text-slate-500 dark:text-ink-400">
          {result.timedOut ? (
            <span className="font-bold text-warn">時間切れ</span>
          ) : (
            <span className={cx('font-bold', result.isCorrect ? 'text-good' : 'text-bad')}>
              {result.isCorrect ? '正解' : '不正解'}
            </span>
          )}
          <span className="ml-2">{(result.firstTapLatencyMs / 1000).toFixed(2)}s</span>
          <div className="mt-2">
            <NextButton autoAdvance={settings.autoAdvance} onClick={() => onAnswer(result)} />
          </div>
        </div>
      )}
    </div>
  );
}
