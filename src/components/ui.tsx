import type { ReactNode } from 'react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Button({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const base =
    'rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none';
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-[15px]',
    lg: 'px-5 py-4 text-lg',
  }[size];
  const variants = {
    default:
      'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-ink-700 dark:text-ink-200 dark:hover:bg-ink-600',
    primary: 'bg-accent text-white hover:brightness-110 shadow-sm',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-200 dark:text-ink-400 dark:hover:bg-ink-800',
    danger: 'bg-bad/15 text-bad hover:bg-bad/25',
  }[variant];
  return (
    <button type="button" title={title} className={cx(base, sizes, variants, className)} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export interface SegOption<T> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={cx(
        'inline-flex flex-wrap gap-1 rounded-xl bg-slate-200 p-1 dark:bg-ink-800',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-[13px]' : 'px-3 py-1.5 text-sm',
            value === o.value
              ? 'bg-white text-slate-900 shadow-sm dark:bg-ink-600 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-ink-400 dark:hover:text-ink-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-slate-600 dark:text-ink-400"
    >
      <span
        className={cx(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-slate-300 dark:bg-ink-700',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
            checked ? 'left-4.5' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-ink-400">
        {label}
      </div>
      {children}
      {hint && <div className="text-xs text-slate-400 dark:text-ink-400/70">{hint}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-slate-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-850',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  tone = 'default',
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  tone?: 'default' | 'accent';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-lg px-2.5 py-1.5 text-sm font-medium tabular transition-colors',
        active
          ? tone === 'accent'
            ? 'bg-accent text-white'
            : 'bg-slate-800 text-white dark:bg-ink-200 dark:text-ink-900'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-ink-400 dark:hover:bg-ink-700',
      )}
    >
      {children}
    </button>
  );
}

export function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return `${(ms / 1000).toFixed(2)}s`;
}

export function fmtPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
