'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { seedDatabase } from '@/lib/db/seed';
import { db, resetDB } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import { useUIStore } from '@/lib/store/uiStore';
import HomePage from '@/components/pages/HomePage';
import ExercisesPage from '@/components/pages/ExercisesPage';
import PlansPage from '@/components/pages/PlansPage';
import ProgressPage from '@/components/pages/ProgressPage';
import ProfilePage from '@/components/pages/ProfilePage';
import ActiveWorkoutPage from '@/components/pages/ActiveWorkoutPage';
import WorkoutCompletePage from '@/components/pages/WorkoutCompletePage';
import BottomNav from '@/components/ui/BottomNav';
import SeedingScreen from '@/components/ui/SeedingScreen';
import { useWorkoutStore } from '@/lib/store/workoutStore';

export default function App() {
  const { activeTab, setActiveTab, showSeedingScreen, setShowSeedingScreen, setSeedingProgress } = useUIStore();
  const { setIsSeeded, setIsLoading, loadFromProfile } = useUserStore();
  const { isActive: workoutActive, endWorkout } = useWorkoutStore();
  const [showComplete, setShowComplete] = useState(false);
  const [showExitHint, setShowExitHint] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const lastBackPressRef = useRef(0);
  const exitHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navStateRef = useRef({ activeTab, workoutActive, showComplete });

  const doInit = useCallback(async (forceReset = false) => {
    const attempt = ++attemptRef.current;
    setInitError(null);
    setShowSeedingScreen(true);
    setSeedingProgress(5, 'Initializing...');

    try {
      // If this is a retry with forceReset, delete the DB and start fresh
      let activeDb = db;
      if (forceReset || attempt > 1) {
        setSeedingProgress(8, 'Resetting database...');
        activeDb = await resetDB();
      } else {
        // First attempt: just try to open
        try {
          await activeDb.open();
        } catch (openErr) {
          console.warn('Initial open failed, resetting:', openErr);
          activeDb = await resetDB();
        }
      }

      // Check if already seeded
      let profiles: any[] = [];
      try {
        profiles = await activeDb.userProfile.toArray();
      } catch {
        // Table might not be readable yet
        profiles = [];
      }

      if (profiles.length > 0 && profiles[0].isSeeded) {
        // Already seeded — load profile
        const p = profiles[0];
        loadFromProfile({
          name: p.name,
          unitSystem: p.unitSystem,
          barWeight: p.barWeight,
          dumbbellWeight: p.dumbbellWeight ?? 10,
          equipment: p.equipment,
          defaultRestTime: p.defaultRestTime,
          restTimerEnabled: p.restTimerEnabled,
          soundEnabled: p.soundEnabled,
          hapticEnabled: p.hapticEnabled,
          notificationsEnabled: p.notificationsEnabled,
          theme: p.theme,
          isSeeded: true,
        });

        // Apply saved theme
        if (p.theme && p.theme !== 'dark' && typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', p.theme);
        }
        // Apply saved font
        if (p.font && typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-font', p.font);
        }
        if (p.fontSize && typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-fontsize', p.fontSize);
        }
        if (typeof document !== 'undefined') {
          if (p.compactMode) document.documentElement.setAttribute('data-compact', 'true');
          else document.documentElement.removeAttribute('data-compact');

          if (p.buttonStyle && p.buttonStyle !== 'default') document.documentElement.setAttribute('data-buttons', p.buttonStyle);
          else document.documentElement.removeAttribute('data-buttons');

          if (p.cardStyle && p.cardStyle !== 'glass') document.documentElement.setAttribute('data-cards', p.cardStyle);
          else document.documentElement.removeAttribute('data-cards');

          if (p.borderRadius && p.borderRadius !== 'default') document.documentElement.setAttribute('data-radius', p.borderRadius);
          else document.documentElement.removeAttribute('data-radius');

          if (p.animationLevel && p.animationLevel !== 'normal') document.documentElement.setAttribute('data-anim', p.animationLevel);
          else document.documentElement.removeAttribute('data-anim');

          if (p.navStyle && p.navStyle !== 'default') document.documentElement.setAttribute('data-nav', p.navStyle);
          else document.documentElement.removeAttribute('data-nav');

          if (p.accentIntensity && p.accentIntensity !== 'normal') document.documentElement.setAttribute('data-accent-intensity', p.accentIntensity);
          else document.documentElement.removeAttribute('data-accent-intensity');

          if (p.colorMode && p.colorMode !== 'normal') document.documentElement.setAttribute('data-color-mode', p.colorMode);
          else document.documentElement.removeAttribute('data-color-mode');

          if (p.textShadow) document.documentElement.setAttribute('data-text-shadow', 'true');
          else document.documentElement.removeAttribute('data-text-shadow');

          if (p.glowIntensity && p.glowIntensity !== 'normal') document.documentElement.setAttribute('data-glow', p.glowIntensity);
          else document.documentElement.removeAttribute('data-glow');

          if (p.borderThickness && p.borderThickness !== 'normal') document.documentElement.setAttribute('data-border-width', p.borderThickness);
          else document.documentElement.removeAttribute('data-border-width');

          if (p.glassOpacity && p.glassOpacity !== 'medium') document.documentElement.setAttribute('data-glass-opacity', p.glassOpacity);
          else document.documentElement.removeAttribute('data-glass-opacity');

          if (p.contrastMode && p.contrastMode !== 'normal') document.documentElement.setAttribute('data-contrast', p.contrastMode);
          else document.documentElement.removeAttribute('data-contrast');
        }

        setSeedingProgress(100, 'Ready!');
        setIsLoading(false);
        setIsInitialized(true);
        setShowSeedingScreen(false);
        return;
      }

      // Need to seed
      setSeedingProgress(10, 'Setting up your workout experience...');
      await seedDatabase((msg, pct) => {
        setSeedingProgress(pct, msg);
      });

      setIsSeeded(true);
      setSeedingProgress(100, 'Setup complete!');
      
      // Small delay so user sees completion
      await new Promise(r => setTimeout(r, 400));
      
      setShowSeedingScreen(false);
      setIsLoading(false);
      setIsInitialized(true);
    } catch (err) {
      console.error(`Init failed (attempt ${attempt}):`, err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setShowSeedingScreen(false);
      setIsLoading(false);
      setIsInitialized(true);
      setInitError(`Database setup failed: ${message.slice(0, 80)}`);
    }
  }, [loadFromProfile, setIsLoading, setIsSeeded, setShowSeedingScreen, setSeedingProgress]);

  useEffect(() => {
    doInit(false);
  }, [doInit]);

  useEffect(() => {
    navStateRef.current = { activeTab, workoutActive, showComplete };
  }, [activeTab, workoutActive, showComplete]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pushSentinel = () => {
      window.history.pushState({ ironforge: true, ts: Date.now() }, '');
    };

    pushSentinel();

    const onPopState = () => {
      const current = navStateRef.current;

      if (current.showComplete) {
        setShowComplete(false);
        pushSentinel();
      } else if (current.workoutActive) {
        endWorkout();
        pushSentinel();
      } else if (current.activeTab !== 'home') {
        setActiveTab('home');
        pushSentinel();
      } else {
        const now = Date.now();
        const withinWindow = now - lastBackPressRef.current < 1800;

        if (withinWindow) {
          if (exitHintTimerRef.current) {
            clearTimeout(exitHintTimerRef.current);
            exitHintTimerRef.current = null;
          }
          setShowExitHint(false);
          void (async () => {
            try {
              const { App: CapacitorApp } = await import('@capacitor/app');
              await CapacitorApp.exitApp();
            } catch {
              window.close();
            }
          })();
          return;
        }

        lastBackPressRef.current = now;
        setShowExitHint(true);
        if (exitHintTimerRef.current) clearTimeout(exitHintTimerRef.current);
        exitHintTimerRef.current = setTimeout(() => setShowExitHint(false), 1700);
        pushSentinel();
        return;
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (exitHintTimerRef.current) {
        clearTimeout(exitHintTimerRef.current);
        exitHintTimerRef.current = null;
      }
    };
  }, [endWorkout, setActiveTab]);

  const handleWorkoutComplete = useCallback(() => {
    setShowComplete(true);
  }, []);

  const handleFinishComplete = useCallback(() => {
    setShowComplete(false);
    setActiveTab('home');
  }, [setActiveTab]);

  // Show seeding screen while initializing
  if ((showSeedingScreen || !isInitialized) && !initError) {
    return <SeedingScreen onRetry={() => doInit(true)} />;
  }

  // Show error state with proper retry
  if (initError && !isInitialized) {
    return <SeedingScreen onRetry={() => doInit(true)} error={initError} />;
  }

  if (showComplete) {
    return <WorkoutCompletePage onFinish={handleFinishComplete} />;
  }

  if (workoutActive) {
    return <ActiveWorkoutPage onComplete={handleWorkoutComplete} />;
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'home': return <HomePage />;
      case 'plans': return <PlansPage />;
      case 'exercises': return <ExercisesPage />;
      case 'progress': return <ProgressPage />;
      case 'profile': return <ProfilePage />;
      default: return <HomePage />;
    }
  };

  return (
    <>
      {initError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          background: 'rgba(255,61,90,0.12)', backdropFilter: 'blur(8px)',
          padding: '12px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: '1px solid rgba(255,61,90,0.2)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, flex: 1, marginRight: 10 }}>{initError}</span>
          <button onClick={() => doInit(true)} style={{
            background: 'var(--gradient-fire)', border: 'none', color: 'white',
            padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>Reset & Retry</button>
        </div>
      )}
      {showExitHint && (
        <div style={{
          position: 'fixed',
          left: '50%',
          bottom: 'calc(84px + env(safe-area-inset-bottom))',
          transform: 'translateX(-50%)',
          zIndex: 300,
          background: 'rgba(6,7,16,0.94)',
          border: '1px solid rgba(255,255,255,0.14)',
          color: 'var(--text-primary)',
          padding: '10px 14px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 700,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          whiteSpace: 'nowrap',
        }}>
          Press back again to exit
        </div>
      )}
      {renderPage()}
      <BottomNav />
    </>
  );
}
