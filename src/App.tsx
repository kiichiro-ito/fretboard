import { useCallback, useEffect, useState } from 'react';
import { unlockAudio } from './audio';
import { getTuning } from './music/fretboard';
import { ScaleReference } from './screens/ScaleReference';
import { SessionRunner } from './screens/SessionRunner';
import { SessionSetup } from './screens/SessionSetup';
import { Settings } from './screens/Settings';
import { Summary } from './screens/Summary';
import {
  appendSession,
  hasPreviousConfig,
  loadAppSettings,
  loadSessionConfig,
  loadSessions,
  saveAppSettings,
  saveSessionConfig,
} from './storage';
import type { AppSettings, KeySel, SessionConfig, SessionRecord } from './types';

type Screen = 'home' | 'reference' | 'session' | 'summary' | 'history' | 'settings';

/** 縦長の画面では縦向き指板のほうが片手で扱いやすい */
function useResolvedOrientation(pref: AppSettings['orientation']): 'horizontal' | 'vertical' {
  const [portrait, setPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.15,
  );
  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth * 1.15);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  if (pref === 'auto') return portrait ? 'vertical' : 'horizontal';
  return pref;
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  const [config, setConfig] = useState<SessionConfig>(() => loadSessionConfig());
  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadSessions());
  const [screen, setScreen] = useState<Screen>('home');
  const [lastSession, setLastSession] = useState<SessionRecord | null>(null);
  const [runId, setRunId] = useState(0);
  const [hadPrevious] = useState(() => hasPreviousConfig());

  const orientation = useResolvedOrientation(settings.orientation);
  const tuning = getTuning(settings.tuningId);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.dark);
    saveAppSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveSessionConfig(config);
  }, [config]);

  const start = useCallback(
    (override?: Partial<SessionConfig>) => {
      unlockAudio();
      if (override) setConfig((c) => ({ ...c, ...override }));
      setRunId((n) => n + 1);
      setScreen('session');
    },
    [],
  );

  const finish = useCallback((rec: SessionRecord) => {
    if (rec.answers.length > 0) {
      appendSession(rec);
      setSessions(loadSessions());
      setLastSession(rec);
      setScreen('summary');
    } else {
      setScreen('home');
    }
  }, []);

  const retryKey = useCallback(
    (k: KeySel) => {
      setConfig((c) => ({ ...c, keyPreset: 'manual', keys: [k] }));
      setRunId((n) => n + 1);
      setScreen('session');
    },
    [],
  );

  return (
    <div className="min-h-full">
      {screen === 'home' && (
        <SessionSetup
          config={config}
          onChange={setConfig}
          onStart={() => start()}
          sessions={sessions}
          hasPrevious={hadPrevious}
          onOpenReference={() => setScreen('reference')}
          onOpenSettings={() => setScreen('settings')}
          onOpenHistory={() => setScreen('history')}
          tuningId={settings.tuningId}
        />
      )}

      {screen === 'reference' && (
        <ScaleReference
          settings={settings}
          orientation={orientation}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'session' && (
        <SessionRunner
          key={runId}
          config={config}
          tuning={tuning}
          settings={settings}
          orientation={orientation}
          sessions={sessions}
          onFinish={finish}
          onAbort={() => setScreen('home')}
        />
      )}

      {screen === 'summary' && (
        <Summary
          session={lastSession}
          sessions={sessions}
          onRetryKey={retryKey}
          onAgain={() => start()}
          onHome={() => setScreen('home')}
        />
      )}

      {screen === 'history' && (
        <Summary session={null} sessions={sessions} onHome={() => setScreen('home')} />
      )}

      {screen === 'settings' && (
        <Settings
          settings={settings}
          onChange={setSettings}
          onBack={() => setScreen('home')}
          onDataCleared={() => setSessions([])}
        />
      )}
    </div>
  );
}
