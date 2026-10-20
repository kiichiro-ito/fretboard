import { useEffect } from 'react';
import { Button } from './ui';
import type { QuestionResult } from '../types';

/**
 * 答え合わせを見せたあとの進み方。
 *
 * 自動だと反射のドリルとしてテンポよく回せるが、間違えたときに
 * 読み終わる前に次へ行ってしまう。手動を選べるようにしておく。
 */
export function useAdvance(
  result: QuestionResult | null,
  autoAdvance: boolean,
  onAnswer: (r: QuestionResult) => void,
  okMs: number,
  missMs: number,
): void {
  useEffect(() => {
    if (!result || !autoAdvance) return;
    const t = setTimeout(() => onAnswer(result), result.isCorrect ? okMs : missMs);
    return () => clearTimeout(t);
  }, [result, autoAdvance, onAnswer, okMs, missMs]);

  // 手動のときは Enter / Space でも進める (PC で片手が塞がっているとき用)
  useEffect(() => {
    if (!result || autoAdvance) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onAnswer(result);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, autoAdvance, onAnswer]);
}

/** 手動のときだけ、押さないと進まないので目立たせる */
export function NextButton({
  onClick,
  autoAdvance,
}: {
  onClick: () => void;
  autoAdvance: boolean;
}) {
  if (autoAdvance) {
    return (
      <Button size="sm" variant="ghost" onClick={onClick}>
        次へ →
      </Button>
    );
  }
  return (
    <Button variant="primary" className="mx-auto block w-full max-w-xs" onClick={onClick}>
      次へ →
    </Button>
  );
}
