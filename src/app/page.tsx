'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MotionConfig } from 'framer-motion';
import { seedDatabase, ensureWorkoutPrograms, migrateExerciseCatalog, EXERCISE_CATALOG_VERSION } from '@/lib/db/seed';
import { db, resetDB } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import { useUIStore } from '@/lib/store/uiStore';
import { applyAppearanceToDOM } from '@/lib/utils/appearance';
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
import { Play, Pause, Maximize2 } from 'lucide-react';

export default function App() {
  const { activeTab, setActiveTab, showSeedingScreen, setShowSeedingScreen, setSeedingProgress } = useUIStore();
  const { setIsSeeded, setIsLoading, loadFromProfile, animationLevel } = useUserStore();
  const {
    isActive: workoutActive,
    isMinimized: workoutMinimized,
    planName: activePlanName,
    dayName: activeDayName,
    exercises: activeExercises,
    currentExerciseIndex,
    elapsedTime,
    isPaused,
    restTimerActive,
    togglePause,
    tickTimer,
    tickRestTimer,
    minimizeWorkout,
    resumeWorkout,
    endWorkout,
    restoreWorkoutIfAny,
  } = useWorkoutStore();
  const [showComplete, setShowComplete] = useState(false);
  const [showExitHint, setShowExitHint] = useState(false);
  const [showCatalogUpdateToast, setShowCatalogUpdateToast] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const lastBackPressRef = useRef(0);
  const exitHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navStateRef = useRef({ activeTab, workoutActive, workoutMinimized, showComplete });

  const doInit = useCallback(async (forceReset = false) => {
    const attempt = ++attemptRef.current;
    setInitError(null);
    setShowSeedingScreen(true);
    setSeedingProgress(5, 'Initializing...');

    try {
      let activeDb = db;
      if (forceReset || attempt > 1) {
        setSeedingProgress(8, 'Resetting database...');
        activeDb = await resetDB();
      } else {
        try {
          await activeDb.open();
        } catch (openErr) {
          console.warn('Initial open failed, resetting:', openErr);
          activeDb = await resetDB();
        }
      }

      let profiles: any[] = [];
      try {
        profiles = await activeDb.userProfile.toArray();
      } catch {
        profiles = [];
      }

      if (profiles.length > 0 && profiles[0].isSeeded) {
        let didRunCatalogMigration = false;
        const profileId = profiles[0].id;
        const currentCatalogVersion = Number(profiles[0].exerciseCatalogVersion || 1);

        if (profileId && currentCatalogVersion < EXERCISE_CATALOG_VERSION) {
          setSeedingProgress(12, 'Updating exercise catalog & balanced plans...');
          await migrateExerciseCatalog((msg, pct) => {
            setSeedingProgress(pct, msg);
          });

          profiles = await activeDb.userProfile.toArray();
          didRunCatalogMigration = true;
        }

        const p = profiles[0];
        loadFromProfile({
          name: p.name ?? 'Athlete',
          unitSystem: p.unitSystem ?? 'metric',
          barWeight: p.barWeight ?? 20,
          dumbbellWeight: p.dumbbellWeight ?? 10,
          equipment: p.equipment ?? ['barbell', 'dumbbell', 'cable', 'body weight', 'machine', 'leverage machine'],
          defaultRestTime: p.defaultRestTime ?? 90,
          restTimerEnabled: p.restTimerEnabled ?? true,
          soundEnabled: p.soundEnabled ?? true,
          hapticEnabled: p.hapticEnabled ?? true,
          notificationsEnabled: p.notificationsEnabled ?? false,
          theme: p.theme ?? 'dark',
          customAccent: p.customAccent ?? 'default',
          font: p.font ?? 'inter',
          fontSize: p.fontSize ?? 'normal',
          numberFont: p.numberFont ?? 'mono',
          headerStyle: p.headerStyle ?? 'gradient',
          density: p.density ?? (p.compactMode ? 'compact' : 'normal'),
          compactMode: Boolean(p.compactMode || p.density === 'compact'),
          gridColumns: p.gridColumns ?? '2',
          buttonStyle: p.buttonStyle ?? 'default',
          cardStyle: p.cardStyle ?? 'glass',
          borderRadius: p.borderRadius ?? 'default',
          animationLevel: p.animationLevel ?? 'normal',
          navStyle: p.navStyle ?? 'default',
          bgStyle: p.bgStyle ?? 'mesh',
          accentIntensity: p.accentIntensity ?? 'normal',
          glowIntensity: p.glowIntensity ?? 'normal',
          borderThickness: p.borderThickness ?? 'normal',
          glassOpacity: p.glassOpacity ?? 'medium',
          contrastMode: p.contrastMode ?? 'normal',
          colorMode: p.colorMode ?? 'normal',
          textShadow: Boolean(p.textShadow),
          weightIncrement: p.weightIncrement ?? 2.5,
          autoAdvance: p.autoAdvance ?? true,
          autoStartRest: p.autoStartRest ?? true,
          keepScreenOn: p.keepScreenOn ?? true,
          showTimer: p.showTimer ?? true,
          countdownSound: p.countdownSound ?? true,
          exerciseVariety: p.exerciseVariety ?? 'medium',
          showDailyQuote: p.showDailyQuote ?? true,
          showActivityHeatmap: p.showActivityHeatmap ?? true,
          showFeatureCards: p.showFeatureCards ?? true,
          showLastWorkout: p.showLastWorkout ?? true,
          isSeeded: true,
        });

        applyAppearanceToDOM(p);
        restoreWorkoutIfAny();

        setSeedingProgress(100, 'Ready!');
        await ensureWorkoutPrograms();
        setIsLoading(false);
        setIsInitialized(true);
        setShowSeedingScreen(false);
        if (didRunCatalogMigration) {
          setShowCatalogUpdateToast(true);
        }
        return;
      }

      // Need to seed
      setSeedingProgress(10, 'Setting up your workout experience...');
      await seedDatabase((msg, pct) => {
        setSeedingProgress(pct, msg);
      });

      setIsSeeded(true);
      setSeedingProgress(100, 'Setup complete!');
      restoreWorkoutIfAny();

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
  }, [loadFromProfile, restoreWorkoutIfAny, setIsLoading, setIsSeeded, setShowSeedingScreen, setSeedingProgress]);

  useEffect(() => {
    doInit(false);
  }, [doInit]);

  useEffect(() => {
    navStateRef.current = { activeTab, workoutActive, workoutMinimized, showComplete };
  }, [activeTab, workoutActive, workoutMinimized, showComplete]);

  // Keep workout & rest timers ticking while workout is minimized in the background
  useEffect(() => {
    if (!workoutActive || !workoutMinimized) return;
    const id = setInterval(() => {
      tickTimer();
      if (restTimerActive) tickRestTimer();
    }, 1000);
    return () => clearInterval(id);
  }, [workoutActive, workoutMinimized, restTimerActive, tickTimer, tickRestTimer]);

  useEffect(() => {
    if (!showCatalogUpdateToast) {
      return;
    }

    if (catalogToastTimerRef.current) {
      clearTimeout(catalogToastTimerRef.current);
    }

    catalogToastTimerRef.current = setTimeout(() => {
      setShowCatalogUpdateToast(false);
      catalogToastTimerRef.current = null;
    }, 3500);

    return () => {
      if (catalogToastTimerRef.current) {
        clearTimeout(catalogToastTimerRef.current);
        catalogToastTimerRef.current = null;
      }
    };
  }, [showCatalogUpdateToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pushSentinel = () => {
      window.history.pushState({ ironforge: true, ts: Date.now() }, '');
    };

    pushSentinel();

    const onPopState = () => {
      const current = navStateRef.current;

      if (current.showComplete) {
        // Workout is already saved when entering WorkoutCompletePage.
        // Going back from WorkoutCompletePage must clear workout state and return to dashboard,
        // NEVER re-opening ActiveWorkoutPage where the workout could save a second time.
        endWorkout();
        setShowComplete(false);
        setActiveTab('home');
        pushSentinel();
      } else if (current.workoutActive && !current.workoutMinimized) {
        minimizeWorkout();
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
      if (catalogToastTimerRef.current) {
        clearTimeout(catalogToastTimerRef.current);
        catalogToastTimerRef.current = null;
      }
    };
  }, [endWorkout, minimizeWorkout, setActiveTab]);

  const handleWorkoutComplete = useCallback(() => {
    setShowComplete(true);
  }, []);

  const handleFinishComplete = useCallback(() => {
    endWorkout();
    setShowComplete(false);
    setActiveTab('home');
  }, [endWorkout, minimizeWorkout, setActiveTab]);

  if ((showSeedingScreen || !isInitialized) && !initError) {
    return <SeedingScreen onRetry={() => doInit(true)} />;
  }

  if (initError && !isInitialized) {
    return <SeedingScreen onRetry={() => doInit(true)} error={initError} />;
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
    <MotionConfig reducedMotion={animationLevel === 'none' ? 'always' : 'never'}>
      {showComplete ? (
        <WorkoutCompletePage onFinish={handleFinishComplete} />
      ) : workoutActive && !workoutMinimized ? (
        <ActiveWorkoutPage onComplete={handleWorkoutComplete} />
      ) : (
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
            <div className="app-inline-toast app-inline-toast--neutral">
              Press back again to exit
            </div>
          )}
          {showCatalogUpdateToast && (
            <div className="app-inline-toast app-inline-toast--success">
              Catalog updated: GIFs prioritized, plans balanced & body map upgraded!
            </div>
          )}
          {renderPage()}
          {workoutActive && workoutMinimized && (
            <div
              style={{
                position: 'fixed',
                left: 12,
                right: 12,
                bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
                zIndex: 95,
                maxWidth: 456,
                margin: '0 auto',
                background: 'rgba(14, 16, 28, 0.96)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 61, 90, 0.4)',
                borderRadius: 16,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
              }}
            >
              <div onClick={resumeWorkout} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: isPaused ? 'var(--accent-yellow)' : 'var(--accent-green)' }} />
                  <span style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeDayName || activePlanName || 'Active Workout'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'capitalize' }}>
                  {activeExercises[currentExerciseIndex]?.exerciseName || 'In progress'} • {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={togglePause}
                  style={{
                    width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)',
                    background: 'var(--bg-glass)', color: isPaused ? 'var(--accent-green)' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                  aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
                >
                  {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} />}
                </button>
                <button
                  onClick={resumeWorkout}
                  className="btn-primary"
                  style={{ width: 'auto', minHeight: 34, padding: '6px 12px', fontSize: 11, borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <Maximize2 size={12} /> Resume
                </button>
              </div>
            </div>
          )}
          <BottomNav />
        </>
      )}
    </MotionConfig>
  );
}
