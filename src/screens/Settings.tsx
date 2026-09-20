import { Button, Card, Field, Segmented, Toggle } from '../components/ui';
import { TUNINGS } from '../music/fretboard';
import { clearSessions } from '../storage';
import type { AppSettings } from '../types';

export function Settings({
  settings,
  onChange,
  onBack,
  onDataCleared,
}: {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onBack: () => void;
  onDataCleared: () => void;
}) {
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    onChange({ ...settings, [k]: v });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-3 pb-28">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← 戻る
        </Button>
        <h1 className="text-lg font-semibold">設定</h1>
      </div>

      <Card className="space-y-4">
        <Field label="チューニング">
          <select
            value={settings.tuningId}
            onChange={(e) => set('tuningId', e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-800"
          >
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="指板の向き" hint="自動: 画面が縦長なら縦向き指板">
          <Segmented
            value={settings.orientation}
            onChange={(v) => set('orientation', v)}
            options={[
              { value: 'auto', label: '自動' },
              { value: 'horizontal', label: '横向き' },
              { value: 'vertical', label: '縦向き' },
            ]}
          />
        </Field>

        <Field label="コード表記">
          <Segmented
            value={settings.chordNotation}
            onChange={(v) => set('chordNotation', v)}
            options={[
              { value: 'triad', label: 'F#m' },
              { value: 'seventh', label: 'F#m7' },
            ]}
          />
        </Field>

        <div className="flex flex-wrap gap-5">
          <Toggle checked={settings.lefty} onChange={(v) => set('lefty', v)} label="左利き (反転)" />
          <Toggle checked={settings.dark} onChange={(v) => set('dark', v)} label="ダークモード" />
        </div>
      </Card>

      <Card className="space-y-2">
        <Field label="データ" hint="セッション履歴とキー別統計をすべて削除します">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm('セッション履歴をすべて削除しますか?')) {
                clearSessions();
                onDataCleared();
              }
            }}
          >
            履歴を削除
          </Button>
        </Field>
      </Card>

      <div className="px-1 text-xs leading-relaxed text-slate-400 dark:text-ink-400">
        記録はこの端末の localStorage にのみ保存されます。オフラインで動作します。
      </div>
    </div>
  );
}
