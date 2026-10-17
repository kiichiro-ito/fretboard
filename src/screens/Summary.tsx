import { useMemo } from 'react';
import { Button, Card, cx, fmtMs, fmtPct } from '../components/ui';
import { pretty } from '../music/notes';
import { computeKeyStats } from '../storage';
import type { KeySel, KeyStats, SessionRecord } from '../types';

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

/** セッションごとの平均初手レイテンシ推移 */
function LatencyTrend({ sessions }: { sessions: SessionRecord[] }) {
  const points = useMemo(
    () =>
      sessions
        .map((s) => {
          const vals = s.answers.filter((a) => !a.skipped && !a.timedOut).map((a) => a.firstTapLatencyMs);
          return { at: s.endedAt, ms: avg(vals), n: vals.length };
        })
        .filter((p) => p.n > 0)
        .slice(-20),
    [sessions],
  );

  if (points.length < 2) {
    return (
      <div className="py-6 text-center text-sm text-slate-400 dark:text-ink-400">
        セッションを2回以上こなすと推移が出ます
      </div>
    );
  }

  const W = 320;
  const H = 96;
  const pad = 8;
  const max = Math.max(...points.map((p) => p.ms)) * 1.15;
  const min = Math.min(...points.map((p) => p.ms)) * 0.85;
  const span = Math.max(1, max - min);
  const xy = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = H - pad - ((p.ms - min) / span) * (H - pad * 2);
    return [x, y] as const;
  });
  const d = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const first = points[0].ms;
  const last = points[points.length - 1].ms;
  const delta = last - first;

  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" height={96}>
        <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.6} fill="var(--color-accent)" />
        ))}
      </svg>
      <div className="tabular flex justify-between text-xs text-slate-400 dark:text-ink-400">
        <span>{fmtMs(first)}</span>
        <span className={cx(delta < 0 ? 'text-good' : delta > 0 ? 'text-bad' : '')}>
          {delta < 0 ? '▼' : delta > 0 ? '▲' : ''} {fmtMs(Math.abs(delta))}
        </span>
        <span>{fmtMs(last)}</span>
      </div>
    </div>
  );
}

function KeyTable({
  stats,
  onRetryKey,
  latencyLabel,
  showCompletion,
}: {
  stats: KeyStats[];
  onRetryKey?: (k: KeySel) => void;
  latencyLabel: string;
  showCompletion: boolean;
}) {
  if (stats.length === 0) {
    return <div className="py-4 text-center text-sm text-slate-400 dark:text-ink-400">データなし</div>;
  }
  const worst = Math.max(...stats.map((s) => s.avgFirstTapLatencyMs), 1);
  const cols = showCompletion
    ? 'grid-cols-[1fr_auto_auto_auto]'
    : 'grid-cols-[1fr_auto_auto]';
  return (
    <div className="space-y-1">
      <div className={cx('tabular grid gap-2 px-1 text-[11px] font-semibold text-slate-400 dark:text-ink-400', cols)}>
        <span>キー</span>
        <span className="w-12 text-right">正答率</span>
        <span className="w-14 text-right">{latencyLabel}</span>
        {showCompletion && <span className="w-14 text-right">完了</span>}
      </div>
      {stats.map((s) => (
        <div
          key={`${s.pc}-${s.quality}`}
          className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-ink-800/60"
        >
          <div className={cx('tabular grid items-center gap-2 text-sm', cols)}>
            <span className="font-semibold">{pretty(s.key)}</span>
            <span
              className={cx(
                'w-12 text-right',
                s.correctRate >= 0.8 ? 'text-good' : s.correctRate < 0.5 ? 'text-bad' : '',
              )}
            >
              {fmtPct(s.correctRate)}
            </span>
            <span className="w-14 text-right font-semibold">{fmtMs(s.avgFirstTapLatencyMs)}</span>
            {showCompletion && (
              <span className="w-14 text-right text-slate-400 dark:text-ink-400">
                {fmtMs(s.avgCompletionTimeMs)}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-ink-700">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(100, (s.avgFirstTapLatencyMs / worst) * 100)}%` }}
              />
            </div>
            {onRetryKey && (
              <Button
                size="sm"
                variant="ghost"
                className="!px-2 !py-0.5 !text-xs"
                onClick={() => onRetryKey({ pc: s.pc, quality: s.quality })}
              >
                このキーだけ
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Summary({
  session,
  sessions,
  onRetryKey,
  onAgain,
  onHome,
}: {
  /** null なら全履歴ビュー */
  session: SessionRecord | null;
  sessions: SessionRecord[];
  onRetryKey?: (k: KeySel) => void;
  onAgain?: () => void;
  onHome: () => void;
}) {
  const scope = session ? [session] : sessions;
  const mode = session?.mode;
  const stats = useMemo(
    () =>
      computeKeyStats(scope, mode).sort(
        (a, b) => b.avgFirstTapLatencyMs - a.avgFirstTapLatencyMs,
      ),
    [scope, mode],
  );

  const answers = scope.flatMap((s) => s.answers);
  const done = answers.length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const timed = answers.filter((a) => !a.skipped && !a.timedOut);
  const elapsed = session ? session.endedAt - session.startedAt : 0;

  // 完了時間は「複数回タップして埋める」出題にしか意味がない。
  // モードで決め打ちせず、実際に記録があるかで列を出し分ける
  const showCompletion = answers.some((a) => a.completionTimeMs > 0);
  const latencyLabel = showCompletion ? '初手' : '回答';

  const trendSessions = useMemo(
    () => (mode ? sessions.filter((s) => s.mode === mode) : sessions),
    [sessions, mode],
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-3 pb-28">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onHome}>
          ← ホーム
        </Button>
        <h1 className="text-lg font-semibold">{session ? 'セッション結果' : '履歴'}</h1>
      </div>

      {done === 0 ? (
        <Card>
          <div className="py-6 text-center text-sm text-slate-400 dark:text-ink-400">
            まだ記録がありません
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[11px] text-slate-400 dark:text-ink-400">正答率</div>
                <div className="tabular text-2xl font-bold">{fmtPct(done ? correct / done : 0)}</div>
                <div className="text-[11px] text-slate-400 dark:text-ink-400">
                  {correct}/{done}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 dark:text-ink-400">平均 {latencyLabel}</div>
                <div className="tabular text-2xl font-bold text-accent">
                  {fmtMs(avg(timed.map((a) => a.firstTapLatencyMs)))}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-ink-400">最重要指標</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 dark:text-ink-400">
                  {showCompletion ? '平均 完了' : '所要時間'}
                </div>
                <div className="tabular text-2xl font-bold">
                  {showCompletion
                    ? fmtMs(avg(timed.map((a) => a.completionTimeMs)))
                    : `${Math.round(elapsed / 1000)}s`}
                </div>
                {session && showCompletion && (
                  <div className="tabular text-[11px] text-slate-400 dark:text-ink-400">
                    計 {Math.round(elapsed / 1000)}s
                  </div>
                )}
              </div>
            </div>
            {showCompletion && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400 dark:border-ink-700 dark:text-ink-400">
                「初手」は問題が出てから最初の1タップまでの時間、「完了」はそこから答え終わるまでの時間です。
                初手が短くなるほど、考えずに指が動くようになっています。
              </p>
            )}
          </Card>

          <Card className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-ink-400">
              キー別 ({latencyLabel}が長い順 = 次に潰すべきキー)
            </div>
            <KeyTable
              stats={stats}
              onRetryKey={onRetryKey}
              latencyLabel={latencyLabel}
              showCompletion={showCompletion}
            />
          </Card>

          <Card className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-ink-400">
              平均{latencyLabel}レイテンシの推移
            </div>
            <LatencyTrend sessions={trendSessions} />
          </Card>
        </>
      )}

      {onAgain && (
        <Button variant="primary" size="lg" className="w-full" onClick={onAgain}>
          同じ設定でもう一度
        </Button>
      )}
    </div>
  );
}
