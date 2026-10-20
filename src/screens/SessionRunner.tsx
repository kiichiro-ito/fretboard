import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, cx } from '../components/ui';
import type { Tuning } from '../music/fretboard';
import { keyName } from '../music/notes';
import { ALL_KEYS, makeQuestion, pickKey, type Question } from '../session/generator';
import { buildConfusion, weakKeys } from '../storage';
import type {
  AnswerRecord,
  AppSettings,
  KeySel,
  QuestionResult,
  SessionConfig,
  SessionRecord,
} from '../types';
import { IntervalQuiz } from './IntervalQuiz';
import { NoteNameQuiz } from './NoteNameQuiz';
import { PositionFill } from './PositionFill';
import { DiatonicQuiz } from './DiatonicQuiz';
import { ProgressionQuiz } from './ProgressionQuiz';
import { ScaleReference } from './ScaleReference';

function resolveKeys(config: SessionConfig, sessions: SessionRecord[]): KeySel[] {
  if (config.keyPreset === 'all') return ALL_KEYS;
  if (config.keyPreset === 'weak') {
    const w = weakKeys(sessions, 6, config.mode).map((k) => ({ pc: k.pc, quality: k.quality }));
    return w.length ? w : ALL_KEYS;
  }
  return config.keys.length ? config.keys : ALL_KEYS;
}

export function SessionRunner({
  config,
  tuning,
  settings,
  orientation,
  sessions,
  onFinish,
  onAbort,
}: {
  config: SessionConfig;
  tuning: Tuning;
  settings: AppSettings;
  orientation: 'horizontal' | 'vertical';
  sessions: SessionRecord[];
  onFinish: (rec: SessionRecord) => void;
  onAbort: () => void;
}) {
  const keys = useMemo(() => resolveKeys(config, sessions), [config, sessions]);
  // 過去に取り違えたコードを誤答選択肢に混ぜるための履歴
  const confusion = useMemo(() => buildConfusion(sessions, config.mode), [sessions, config.mode]);
  const startedAtRef = useRef(Date.now());
  const answersRef = useRef<AnswerRecord[]>([]);
  const prevKeyRef = useRef<KeySel | undefined>(undefined);
  const assistedRef = useRef(false);

  const nextQuestion = useCallback((): Question => {
    const key = pickKey(keys, prevKeyRef.current);
    prevKeyRef.current = key;
    assistedRef.current = false;
    return makeQuestion(config, tuning, key, settings.chordNotation, confusion);
  }, [keys, config, tuning, settings.chordNotation, confusion]);

  const [question, setQuestion] = useState<Question>(() => nextQuestion());
  const [done, setDone] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showReference, setShowReference] = useState(false);

  const totalMs = config.lengthType === 'time' ? config.minutes * 60_000 : 0;

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 250);
    return () => clearInterval(iv);
  }, []);

  const finishSession = useCallback(() => {
    onFinish({
      id: `s${startedAtRef.current.toString(36)}`,
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      mode: config.mode,
      level: config.level,
      answers: answersRef.current,
    });
  }, [config.mode, config.level, onFinish]);

  const handleAnswer = useCallback(
    (r: QuestionResult) => {
      const q = question;
      const key: KeySel =
        q.kind === 'noteName' ? { pc: q.answerPc, quality: 'major' } : q.key;
      // コードを1つだけ提示する出題だけが chord を持つ
      const chord =
        q.kind === 'positionFill' || q.kind === 'interval' || q.kind === 'diatonicReverse'
          ? q.chord
          : undefined;
      const rec: AnswerRecord = {
        questionId: q.id,
        mode: config.mode,
        keyLabel: q.kind === 'noteName' ? keyName(q.answerPc, 'major') : q.keyLabel,
        keyPc: key.pc,
        keyQuality: key.quality,
        chordSymbol: chord?.symbol,
        degreeRoman: chord?.spec.roman,
        scale: chord?.scale,
        task: q.kind === 'positionFill' ? q.task : undefined,
        format:
          q.kind === 'diatonicFill'
            ? 'fillTable'
            : q.kind === 'diatonicReverse'
              ? 'reverseLookup'
              : q.kind === 'scaleTones'
                ? 'scaleTones'
                : undefined,
        pickedDegree: r.pickedDegree,
        firstTapLatencyMs: r.firstTapLatencyMs,
        completionTimeMs: r.completionTimeMs,
        accuracy: r.accuracy,
        isCorrect: r.isCorrect,
        // リファレンスを見た問題は反射の記録として使えないので除外扱いにする
        skipped: r.skipped || assistedRef.current,
        timedOut: r.timedOut,
        answeredAt: Date.now(),
      };
      answersRef.current = [...answersRef.current, rec];
      const count = answersRef.current.length;
      setDone(count);

      const outOfCount = config.lengthType === 'count' && count >= config.count;
      const outOfTime =
        config.lengthType === 'time' && Date.now() - startedAtRef.current >= totalMs;
      if (outOfCount || outOfTime) {
        finishSession();
        return;
      }
      setQuestion(nextQuestion());
    },
    [question, config, totalMs, finishSession, nextQuestion],
  );

  const progressPct =
    config.lengthType === 'count'
      ? (done / config.count) * 100
      : Math.min(100, (elapsed / totalMs) * 100);

  const refChord =
    question.kind === 'positionFill' || question.kind === 'interval' ? question.chord : undefined;
  const referenceRoot = refChord?.rootPc;
  const referenceScale = refChord?.scale;

  return (
    <div className="flex min-h-full flex-col">
      {/* ヘッダ: 進捗と経過時間のみ */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-ink-800 dark:bg-ink-900/85">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-3 py-2">
          <span className="tabular text-sm font-semibold">
            {config.lengthType === 'count' ? (
              <>
                {done} <span className="text-slate-400 dark:text-ink-400">/ {config.count}</span>
              </>
            ) : (
              <>{done}問</>
            )}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-ink-800">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
          <span className="tabular text-sm text-slate-400 dark:text-ink-400">
            {Math.floor(elapsed / 60000)}:{String(Math.floor((elapsed / 1000) % 60)).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={answersRef.current.length ? finishSession : onAbort}
            className="text-xs text-slate-400 hover:text-bad dark:text-ink-400"
            title="中断"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1">
        {question.kind === 'positionFill' && (
          <PositionFill
            question={question}
            tuning={tuning}
            settings={settings}
            orientation={orientation}
            onAnswer={handleAnswer}
            onOpenReference={() => {
              assistedRef.current = true;
              setShowReference(true);
            }}
          />
        )}
        {question.kind === 'noteName' && (
          <NoteNameQuiz
            question={question}
            tuning={tuning}
            settings={settings}
            config={config}
            orientation={orientation}
            onAnswer={handleAnswer}
          />
        )}
        {question.kind === 'interval' && (
          <IntervalQuiz
            question={question}
            autoAdvance={settings.autoAdvance}
            onAnswer={handleAnswer}
          />
        )}
        {(question.kind === 'diatonicFill' ||
          question.kind === 'diatonicReverse' ||
          question.kind === 'scaleTones') && (
          <DiatonicQuiz
            question={question}
            autoAdvance={settings.autoAdvance}
            onAnswer={handleAnswer}
          />
        )}
        {question.kind === 'progression' && (
          <ProgressionQuiz
            question={question}
            autoAdvance={settings.autoAdvance}
            onAnswer={handleAnswer}
          />
        )}
      </div>

      {/* リファレンス オーバーレイ */}
      {showReference && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-white dark:bg-ink-900">
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-ink-800 dark:bg-ink-900/90">
            <span className={cx('text-sm text-warn')}>この問題はスキップ扱いになります</span>
            <Button size="sm" onClick={() => setShowReference(false)}>
              閉じる
            </Button>
          </div>
          <ScaleReference
            settings={settings}
            orientation={orientation}
            compact
            initialRootPc={referenceRoot}
            initialScale={referenceScale}
          />
        </div>
      )}
    </div>
  );
}
