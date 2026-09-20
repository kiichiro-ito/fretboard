import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  DOUBLE_MARKER_FRETS,
  POSITION_MARKER_FRETS,
  midiAt,
  posKey,
  type FretWindow,
  type Position,
  type Tuning,
} from '../music/fretboard';
import { SHARP_NAMES, pretty } from '../music/notes';
import { cx } from './ui';

export type MarkerKind =
  | 'scale'
  | 'root'
  | 'user'
  | 'correct'
  | 'missing'
  | 'extra'
  | 'target'
  | 'hint'
  /** ここを起点にする、という印 */
  | 'anchor';

export interface Marker {
  kind: MarkerKind;
  label?: string;
  /** 特性音を細い輪で強調 */
  ring?: boolean;
}

export type PaintMode = 'add' | 'remove';

export interface FretboardProps {
  tuning: Tuning;
  minFret: number;
  maxFret: number;
  orientation: 'horizontal' | 'vertical';
  lefty?: boolean;
  markers: Map<string, Marker>;
  /** 有効範囲。外側はグレーアウトして押せない */
  window?: FretWindow;
  interactive?: boolean;
  selected?: Set<string>;
  onPaint?: (pos: Position, mode: PaintMode) => void;
  /** SVG 1単位あたりの px。指定するとフレット方向にスクロールする固定サイズになる */
  zoom?: number;
  /** 高さ上限 (CSS 値)。zoom なしなら縮小率、zoom ありならスクロール領域の高さ */
  maxHeight?: string;
  /** zoom 指定時、このフレットが見えるようにスクロール位置を合わせる */
  focusFret?: number;
  className?: string;
}

const CELL_W = 52;
const CELL_H = 38;
const OPEN_RATIO = 0.62;

const FILL: Record<MarkerKind, string> = {
  scale: 'var(--color-accent)',
  root: 'var(--color-root)',
  user: 'var(--color-accent)',
  correct: 'var(--color-good)',
  missing: 'transparent',
  extra: 'var(--color-bad)',
  target: 'var(--color-warn)',
  hint: 'transparent',
  anchor: 'transparent',
};

const STROKE: Record<MarkerKind, string> = {
  scale: 'transparent',
  root: 'transparent',
  user: 'transparent',
  correct: 'transparent',
  missing: 'var(--color-good)',
  extra: 'var(--color-bad)',
  target: 'transparent',
  hint: 'var(--color-root)',
  anchor: 'var(--color-root)',
};

const TEXT: Record<MarkerKind, string> = {
  scale: '#08101a',
  root: '#2a1000',
  user: '#08101a',
  correct: '#06210f',
  missing: 'var(--color-good)',
  extra: '#ffffff',
  target: '#2a2100',
  hint: 'var(--color-root)',
  anchor: 'var(--color-root)',
};

export function Fretboard({
  tuning,
  minFret,
  maxFret,
  orientation,
  lefty = false,
  markers,
  window: win,
  interactive = false,
  selected,
  onPaint,
  zoom,
  maxHeight,
  focusFret,
  className,
}: FretboardProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const paintRef = useRef<{ mode: PaintMode; seen: Set<string> } | null>(null);

  const scrolling = !!zoom;

  const geom = useMemo(() => {
    const cols: { fret: number; x: number; w: number }[] = [];
    let x = 0;
    for (let f = minFret; f <= maxFret; f++) {
      const w = f === 0 ? CELL_W * OPEN_RATIO : CELL_W;
      cols.push({ fret: f, x, w });
      x += w;
    }
    const boardW = x;
    const stringSpan = tuning.stringCount * CELL_H;
    const isH = orientation === 'horizontal';
    // 開放弦の音名を置く余白。スクロールする指板では、この余白ごと
    // 別 SVG に切り出して固定表示するので board 側からは外す
    const labelGutter = isH ? 36 : 32;
    const padL = isH ? (scrolling ? 10 : labelGutter) : 30;
    const padR = 14;
    const padT = isH ? 16 : scrolling ? 10 : labelGutter;
    const padB = isH ? 28 : 16;
    const vbW = (isH ? boardW : stringSpan) + padL + padR;
    const vbH = (isH ? stringSpan : boardW) + padT + padB;
    return { cols, boardW, stringSpan, isH, labelGutter, padL, padR, padT, padB, vbW, vbH };
  }, [minFret, maxFret, tuning.stringCount, orientation, scrolling]);

  const { cols, boardW, stringSpan, isH, labelGutter, padL, padT, vbW, vbH } = geom;

  /** 盤面座標 (x: フレット方向, y: 弦方向) → 画面座標 */
  const project = useCallback(
    (x: number, y: number): [number, number] => {
      if (isH) return [padL + (lefty ? boardW - x : x), padT + y];
      return [padL + (lefty ? y : stringSpan - y), padT + x];
    },
    [isH, lefty, padL, padT, boardW, stringSpan],
  );

  const boardRect = useCallback(
    (x0: number, y0: number, x1: number, y1: number) => {
      const [ax, ay] = project(x0, y0);
      const [bx, by] = project(x1, y1);
      return {
        x: Math.min(ax, bx),
        y: Math.min(ay, by),
        width: Math.abs(bx - ax),
        height: Math.abs(by - ay),
      };
    },
    [project],
  );

  const cellCenter = useCallback(
    (stringIdx: number, colIdx: number): [number, number] => {
      const c = cols[colIdx];
      return project(c.x + c.w / 2, stringIdx * CELL_H + CELL_H / 2);
    },
    [cols, project],
  );

  const hitTest = useCallback(
    (clientX: number, clientY: number): Position | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      let bx: number;
      let by: number;
      if (isH) {
        bx = lefty ? boardW - (pt.x - padL) : pt.x - padL;
        by = pt.y - padT;
      } else {
        bx = pt.y - padT;
        by = lefty ? pt.x - padL : stringSpan - (pt.x - padL);
      }
      if (by < 0 || by >= stringSpan) return null;
      const stringIdx = Math.floor(by / CELL_H);
      const col = cols.find((c) => bx >= c.x && bx < c.x + c.w);
      if (!col) return null;
      return { string: stringIdx + 1, fret: col.fret };
    },
    [isH, lefty, boardW, stringSpan, padL, padT, cols],
  );

  const enabled = useCallback(
    (p: Position) => {
      if (!win) return true;
      return p.fret >= win.startFret && p.fret <= win.endFret && win.strings.includes(p.string);
    },
    [win],
  );

  const handleDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !onPaint) return;
    const p = hitTest(e.clientX, e.clientY);
    if (!p || !enabled(p)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 合成イベントなどでキャプチャできなくても入力自体は続行する */
    }
    const key = posKey(p);
    const mode: PaintMode = selected?.has(key) ? 'remove' : 'add';
    paintRef.current = { mode, seen: new Set([key]) };
    onPaint(p, mode);
  };

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const paint = paintRef.current;
    if (!paint || !interactive || !onPaint) return;
    const p = hitTest(e.clientX, e.clientY);
    if (!p || !enabled(p)) return;
    const key = posKey(p);
    if (paint.seen.has(key)) return;
    paint.seen.add(key);
    onPaint(p, paint.mode);
  };

  const handleUp = () => {
    paintRef.current = null;
  };

  // スクロールする指板では、注目してほしいフレットを画面内に持ってくる
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !zoom || focusFret === undefined) return;
    const col = cols.find((c) => c.fret === focusFret);
    if (!col) return;
    const [px, py] = project(col.x + col.w / 2, stringSpan / 2);
    let raf = 0;
    const apply = () => {
      // レイアウト前だと可視幅が 0 で中央寄せが計算できないので次フレームに回す
      const view = isH ? el.clientWidth : el.clientHeight;
      if (view <= 0) {
        raf = requestAnimationFrame(apply);
        return;
      }
      const target = (isH ? px : py) * zoom - view / 2;
      if (isH) el.scrollLeft = target;
      else el.scrollTop = target;
    };
    apply();
    return () => cancelAnimationFrame(raf);
  }, [focusFret, zoom, cols, project, isH, stringSpan]);

  const strings = Array.from({ length: tuning.stringCount }, (_, i) => i + 1);
  const dotR = Math.min(CELL_W, CELL_H) * 0.36;

  /** スクロールしても流れていかないように切り出した、開放弦の音名 */
  const pinnedLabels = scrolling && (
    <svg
      className="block shrink-0"
      viewBox={isH ? `0 0 ${labelGutter} ${vbH}` : `0 0 ${vbW} ${labelGutter}`}
      width={(isH ? labelGutter : vbW) * zoom}
      height={(isH ? vbH : labelGutter) * zoom}
      style={{ marginInline: isH ? undefined : 'auto' }}
      aria-hidden
    >
      {strings.map((s, i) => {
        const y = i * CELL_H + CELL_H / 2;
        const [px] = project(0, y);
        return (
          <text
            key={`pin-${s}`}
            x={isH ? labelGutter - 10 : px}
            y={isH ? padT + y : labelGutter - 12}
            textAnchor={isH ? 'end' : 'middle'}
            dominantBaseline="central"
            fontSize={11}
            className="fill-slate-400 dark:fill-ink-400"
          >
            {pretty(SHARP_NAMES[midiAt(tuning, s, 0) % 12])}
          </text>
        );
      })}
    </svg>
  );

  const board = (
    <div
      ref={scrollRef}
      className={scrolling ? 'min-w-0 flex-1' : className}
      // 24F まで描くと1画面に収まらないので、フレット方向にだけスクロールさせる。
      // 弦方向は常に全部見えている必要があるのでスクロールさせない。
      style={
        zoom
          ? isH
            ? { overflowX: 'auto', overflowY: 'hidden' }
            : { overflowY: 'auto', overflowX: 'hidden', maxHeight }
          : undefined
      }
    >
      <svg
        ref={svgRef}
        className="fretboard-svg block"
        viewBox={`0 0 ${vbW} ${vbH}`}
        width={zoom ? vbW * zoom : '100%'}
        style={
          zoom
            ? {
                minWidth: vbW * zoom,
                height: vbH * zoom,
                marginInline: isH ? undefined : 'auto',
              }
            : {
                // 高さで頭打ちになるぶん幅も縮めて、描画のない余白が
                // タップ判定を持たないようにする
                maxWidth: maxHeight ? `calc(${maxHeight} * ${vbW / vbH})` : '100%',
                maxHeight,
                marginInline: 'auto',
              }
        }
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        {/* 指板の地 */}
        {(() => {
          const r = boardRect(0, 0, boardW, stringSpan);
          return <rect {...r} rx={6} className="fill-slate-100 dark:fill-ink-850" />;
        })()}

        {/* フレットのポジションマーク。音符の丸と取り違えないよう、ひし形で描く */}
        {cols.map((c, ci) => {
          if (!POSITION_MARKER_FRETS.has(c.fret) && !DOUBLE_MARKER_FRETS.has(c.fret)) return null;
          const double = DOUBLE_MARKER_FRETS.has(c.fret);
          const mid = tuning.stringCount / 2;
          const ys = double ? [mid - 1.1, mid + 1.1] : [mid];
          return ys.map((sy, i) => {
            const [cx, cy] = project(c.x + c.w / 2, sy * CELL_H);
            const d = 8.5;
            return (
              <polygon
                key={`pm-${ci}-${i}`}
                points={`${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`}
                className="fill-slate-400/45 dark:fill-ink-600"
              />
            );
          });
        })}

        {/* フレットワイヤー */}
        {cols.map((c, ci) => {
          const isNutEdge = c.fret === 0;
          const x = c.x + c.w;
          const [x1, y1] = project(x, 0);
          const [x2, y2] = project(x, stringSpan);
          return (
            <line
              key={`fw-${ci}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={isNutEdge ? 5 : 2}
              className={isNutEdge ? 'stroke-slate-500 dark:stroke-ink-200' : 'stroke-slate-300 dark:stroke-ink-700'}
              strokeLinecap="round"
            />
          );
        })}
        {minFret > 0 &&
          (() => {
            const [x1, y1] = project(0, 0);
            const [x2, y2] = project(0, stringSpan);
            return (
              <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={2} className="stroke-slate-300 dark:stroke-ink-700" />
            );
          })()}

        {/* 弦 */}
        {strings.map((s, i) => {
          const y = i * CELL_H + CELL_H / 2;
          const [x1, y1] = project(0, y);
          const [x2, y2] = project(boardW, y);
          return (
            <line
              key={`st-${s}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={0.9 + i * 0.32}
              className="stroke-slate-400 dark:stroke-ink-600"
            />
          );
        })}

        {/* 窓外のグレーアウト */}
        {win &&
          strings.flatMap((s, si) =>
            cols.map((c, ci) => {
              const on = c.fret >= win.startFret && c.fret <= win.endFret && win.strings.includes(s);
              if (on) return null;
              const r = boardRect(c.x, si * CELL_H, c.x + c.w, (si + 1) * CELL_H);
              return (
                <rect
                  key={`dim-${si}-${ci}`}
                  {...r}
                  className="fill-slate-300/75 dark:fill-ink-950/85"
                  pointerEvents="none"
                />
              );
            }),
          )}

        {/* 出題範囲の枠。「ここからここまで」を見ただけで分かるようにする */}
        {(() => {
          const w = win;
          if (!w) return null;
          const rows = strings
            .map((s, i) => (w.strings.includes(s) ? i : -1))
            .filter((i) => i >= 0);
          const first = cols.find((c) => c.fret === w.startFret);
          const last = cols.find((c) => c.fret === w.endFret);
          if (rows.length === 0 || !first || !last) return null;
          const rect = boardRect(
            first.x,
            Math.min(...rows) * CELL_H,
            last.x + last.w,
            (Math.max(...rows) + 1) * CELL_H,
          );
          return (
            <g pointerEvents="none">
              <rect {...rect} rx={5} className="fill-accent/6" />
              <rect
                {...rect}
                rx={5}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={2}
                opacity={0.8}
              />
            </g>
          );
        })()}

        {/* マーカー */}
        {strings.flatMap((s, si) =>
          cols.map((c, ci) => {
            const m = markers.get(posKey({ string: s, fret: c.fret }));
            if (!m) return null;
            const [cx, cy] = cellCenter(si, ci);
            const dashed = m.kind === 'missing' || m.kind === 'hint';
            return (
              <g key={`mk-${si}-${ci}`} pointerEvents="none">
                {m.kind === 'target' && (
                  <circle cx={cx} cy={cy} r={dotR + 5} fill="none" stroke="var(--color-warn)" strokeWidth={2} opacity={0.5} />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={dotR}
                  fill={FILL[m.kind]}
                  stroke={STROKE[m.kind]}
                  strokeWidth={dashed ? 2 : 0}
                  strokeDasharray={dashed ? '4 3' : undefined}
                />
                {m.ring && (
                  <circle cx={cx} cy={cy} r={dotR + 3.5} fill="none" stroke="var(--color-warn)" strokeWidth={1.6} />
                )}
                {m.label && (
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={m.label.length > 2 ? 10.5 : 12.5}
                    fontWeight={600}
                    fill={TEXT[m.kind]}
                  >
                    {pretty(m.label)}
                  </text>
                )}
              </g>
            );
          }),
        )}

        {/* 開放弦の音名 (スクロールする指板では固定側に描くのでここでは出さない) */}
        {!scrolling &&
          strings.map((s, i) => {
            const label = SHARP_NAMES[midiAt(tuning, s, 0) % 12];
            const y = i * CELL_H + CELL_H / 2;
            const [px, py] = project(0, y);
            return (
              <text
                key={`sl-${s}`}
                x={isH ? padL - 10 : px}
                y={isH ? py : padT - 12}
                textAnchor={isH ? 'end' : 'middle'}
                dominantBaseline="central"
                fontSize={11}
                className="fill-slate-400 dark:fill-ink-400"
              >
                {pretty(label)}
              </text>
            );
          })}

        {/* フレット番号 */}
        {cols.map((c, ci) => {
          const [px, py] = project(c.x + c.w / 2, stringSpan);
          return (
            <text
              key={`fn-${ci}`}
              x={isH ? px : padL - 8}
              y={isH ? padT + stringSpan + 16 : py}
              textAnchor={isH ? 'middle' : 'end'}
              dominantBaseline="central"
              fontSize={11}
              className={
                POSITION_MARKER_FRETS.has(c.fret) || DOUBLE_MARKER_FRETS.has(c.fret)
                  ? 'fill-slate-500 dark:fill-ink-200'
                  : 'fill-slate-400 dark:fill-ink-400'
              }
            >
              {c.fret}
            </text>
          );
        })}
      </svg>
    </div>
  );

  if (!scrolling) return board;
  return (
    <div className={cx('flex', isH ? 'flex-row items-start' : 'flex-col', className)}>
      {pinnedLabels}
      {board}
    </div>
  );
}
