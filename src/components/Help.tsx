import { useState } from 'react';
import { cx } from './ui';

export type HelpTopic = 'positionFill' | 'noteName' | 'interval' | 'reference';

interface HelpEntry {
  emoji: string;
  title: string;
  /** ひと目で分かる1行説明 */
  oneLiner: string;
  /** 何のための練習なのか */
  purpose: string;
  steps: string[];
  tips: string[];
}

export const HELP: Record<HelpTopic, HelpEntry> = {
  positionFill: {
    emoji: '🎯',
    title: 'ポジション・フィル',
    oneLiner: 'コードごとの「お題」の音を、枠の中からさがしてタップ',
    purpose:
      'コード名を見た瞬間に指が動く状態をつくるのが目標です。「B の4度下だから…」と数えるクセを抜いていきます。',
    steps: [
      'キー・コード・お題が出ます。たとえば「キー B♭m / E♭m / ガイドトーン」。',
      '青い枠の中から、お題にあたる音を全部タップします。枠の外は押せません。',
      '全部うまると自動で答え合わせ。途中で確定したいときは「回答」を押してください。',
      '緑がアタリ、点線が拾いそこねた音、赤がよけいな音。正解のスケール名も一緒に出ます。',
    ],
    tips: [
      'お題は「ルート」「ガイドトーン(3rd・7th)」「コードトーン(R・3・5・7)」など、コードが変われば答えも変わるものだけです。キーだけ見ても解けません。',
      'どのお題を出すかは設定画面の「お題」で選べます。ルートだけにすると1問2〜4タップで一気に回せます。',
      '指をすべらせると続けて入力できます。もう一度タップすると取り消せます。',
      'Lv1〜2 ならルートの位置がオレンジの点線で出ています(お題が「ルート」のときを除く)。Lv3 からは自分で探します。',
      '思い出せないときは「わからない」で大丈夫です。正解の形とスケール名が出るので、そこで覚え直せます。',
      '記録しているのは主に「出題から最初の1タップまでの時間」です。迷っている時間そのものを測っています。',
      '弦と弦のあいだにある薄いひし形は、指板のポジションマーク(3・5・7・9・12F…)です。音符ではありません。',
    ],
  },
  noteName: {
    emoji: '🔍',
    title: '音名当て',
    oneLiner: '光っているフレットの音名を、下の12個から選ぶ',
    purpose:
      '指板のどこに何の音があるかを、数えずに言えるようにする基礎練習です。ポジション・フィルが重いと感じたらここから。',
    steps: [
      '指板のどこか1カ所が黄色く光ります。',
      'そこの音名を下のボタンから選んでください。',
      '正解なら緑、はずれたら押したボタンが赤くなって、正解のほうが緑で光ります。',
    ],
    tips: [
      '詳細設定で「5〜6弦だけ」のように弦をしぼれます。苦手な弦だけ集中的に潰せます。',
      '制限時間を 5秒 / 3秒 にすると、考える前に手が出る練習になります。',
    ],
  },
  interval: {
    emoji: '🔢',
    title: 'キー×度数',
    oneLiner: 'キーの中での度数とコードネームを、行ったり来たりする',
    purpose:
      '「Bm の V って何だっけ」を考えずに出せるようにします。指板を使わないので、ギターが手元になくても回せます。',
    steps: [
      '「Key = Bm の V は?」と出たら、あてはまるコードネームを選びます。',
      '「Key = Bm で F♯m は何度?」と出たら、度数のほうを選びます。',
      '答え合わせのあとに、そのコードで弾けるスケール名も出ます。',
    ],
    tips: [
      '誤答の選択肢は、響きが同じコードやルートが半音〜全音違いのコードから選ばれます。適当に選ぶと引っかかります。',
      '一度取り違えた組み合わせは、次から選択肢に混ざりやすくなります。苦手がそのまま出題に反映されます。',
      '出題の向きは詳細設定で片方だけにもできます。',
      '出題範囲にセカンダリードミナントやモーダルインターチェンジを足すと一気に歯ごたえが出ます。',
    ],
  },
  reference: {
    emoji: '📖',
    title: 'スケール・リファレンス',
    oneLiner: 'ルートとスケールを選ぶと、指板のどこを押さえるか出てくる辞書',
    purpose:
      'クイズ中に分からなくなったときの確認用、そして新しいスケールを覚えるときの下調べ用です。',
    steps: [
      '上の段でルート音、その下でスケールを選びます。',
      '指板に構成音が出ます。オレンジがルートです。',
      '「度数 / 音名 / 非表示」でラベルを切り替えられます。',
    ],
    tips: [
      '黄色い輪がついている音は、そのスケールらしさを決める音(特性音)です。',
      '「ボックス」に切り替えるとポジションを1つずつ見られます。24F にするとオクターブ上のポジションも並びます。',
      '下に出ている「親キー」は、そのモードがどのキーから来ているかです。',
    ],
  },
};

export function HelpSheet({ topic, onClose }: { topic: HelpTopic; onClose: () => void }) {
  const h = HELP[topic];
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 dark:bg-ink-850 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5">
          <span className="text-2xl leading-none">{h.emoji}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{h.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-ink-400">
              {h.purpose}
            </p>
          </div>
          {/* 中身が長いときでも閉じられるように、上にも閉じるボタンを置く */}
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="-mt-1 -mr-1 shrink-0 rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-ink-400">
            やること
          </div>
          <ol className="space-y-1.5">
            {h.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-ink-400">
            知っておくと楽なこと
          </div>
          <ul className="space-y-1.5">
            {h.tips.map((t, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm leading-relaxed text-slate-600 dark:text-ink-400"
              >
                <span className="text-accent">・</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-accent py-3 font-medium text-white"
        >
          わかった
        </button>
      </div>
    </div>
  );
}

/** プレイ画面に置く、1行のひかえめな説明。押すと詳しい説明が開く */
export function HelpBar({ topic, className }: { topic: HelpTopic; className?: string }) {
  const [open, setOpen] = useState(false);
  const h = HELP[topic];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          // 折り返しても間延びしないように、アイコンごと1つのテキストとして流す
          'mx-auto block max-w-[30rem] rounded-full px-3 py-1 text-center text-xs leading-relaxed text-slate-500 transition-colors hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800',
          className,
        )}
      >
        <span className="mr-1">{h.emoji}</span>
        {h.oneLiner}
        <span className="ml-1.5 inline-block rounded-full border border-current px-[5px] align-[1px] text-[10px] leading-[1.5] opacity-70">
          ?
        </span>
      </button>
      {open && <HelpSheet topic={topic} onClose={() => setOpen(false)} />}
    </>
  );
}

/** モード選択画面に置く、少し詳しい紹介カード */
export function ModeIntro({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(false);
  const h = HELP[topic];
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-ink-800/60">
      <div className="flex gap-2.5">
        <span className="text-lg leading-none">{h.emoji}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm leading-snug font-medium">{h.oneLiner}</p>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-ink-400">{h.purpose}</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-semibold text-accent"
          >
            遊び方をくわしく →
          </button>
        </div>
      </div>
      {open && <HelpSheet topic={topic} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** 画面の隅に置く小さな「?」ボタン */
export function HelpButton({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="遊び方"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-xs font-bold text-slate-400 transition-colors hover:bg-slate-100 dark:border-ink-600 dark:text-ink-400 dark:hover:bg-ink-800"
      >
        ?
      </button>
      {open && <HelpSheet topic={topic} onClose={() => setOpen(false)} />}
    </>
  );
}
