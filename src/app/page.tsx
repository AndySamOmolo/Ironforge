'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MotionConfig, AnimatePresence, motion } from 'framer-motion';
import { Play, Pause, Maximize2 } from 'lucide-react';
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

/**
 * Isolated leaf component for the floating minimized workout bar so 1Hz timer ticks
 * never re-render the main page tree.
 */
function MinimizedWorkoutBar() {
  const isActive = useWorkoutStore(s => s.isActive);
  const isMinimized = useWorkoutStore(s => s.isMinimized);
  const isPaused = useWorkoutStore(s => s.isPaused);
  const elapsedTime = useWorkoutStore(s => s.elapsedTime);
  const restTimerActive = useWorkoutStore(s => s.restTimerActive);
  const restTimeRemaining = useWorkoutStore(s => s.restTimeRemaining);
  const dayName = useWorkoutStore(s => s.dayName);
  const planName = useWorkoutStore(s => s.planName);
  const exercises = useWorkoutStore(s => s.exercises);
  const currentExerciseIndex = useWorkoutStore(s => s.currentExerciseIndex);
  const setMinimized = useWorkoutStore(s => s.setMinimized);
  const togglePause = useWorkoutStore(s => s.togglePause);

  if (!isActive || !isMinimized) return null;

  const currentEx = exercises[currentExerciseIndex];
  const completedSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(st => st.isComplete).length, 0);
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(78px + env(safe-area-inset-bottom))',
        maxWidth: 536,
        margin: '0 auto',
        zIndex: 110,
        background: 'var(--bg-overlay)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--border-active)',
        borderRadius: 16,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 20px var(--glow-red)',
      }}
    >
      <button
        onClick={() => setMinimized(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flex: 1,
          minWidth: 0,
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--gradient-fire)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--on-accent-text)',
          }}
        >
          <Maximize2 size={16} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {dayName || planName || 'Active Workout'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'capitalize' }}>
            {currentEx ? currentEx.exerciseName : 'In Progress'} • {completedSets}/{totalSets} sets
          </div>
        </div>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {restTimerActive && (
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: 8,
              background: 'rgba(16,232,154,0.14)',
              color: 'var(--accent-green)',
              border: '1px solid rgba(16,232,154,0.3)',
            }}
          >
            Rest {restTimeRemaining}s
          </span>
        )}
        <span className="font-mono" style={{ fontSize: 13, fontWeight: 800, color: isPaused ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
          {formatTime(elapsedTime)}
        </span>
        <button
          onClick={togglePause}
          aria-label={isPaused ? 'Resume workout timer' : 'Pause workout timer'}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
        </button>
        <button
          onClick={() => setMinimized(false)}
          className="btn-primary"
          style={{ width: 'auto', minHeight: 34, padding: '6px 12px', fontSize: 11, borderRadius: 9 }}
        >
          Resume
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Global background ticker that keeps workout elapsedTime and restTimeRemaining
 * accurate whether ActiveWorkoutPage is fullscreen or minimized.
 */
function GlobalWorkoutClock() {
  const isActive = useWorkoutStore(s => s.isActive);
  const restTimerActive = useWorkoutStore(s => s.restTimerActive);
  const tickTimer = useWorkoutStore(s => s.tickTimer);
  const tickRestTimer = useWorkoutStore(s => s.tickRestTimer);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => tickTimer(), 1000);
    return () => clearInterval(id);
  }, [isActive, tickTimer]);

  useEffect(() => {
    if (!isActive || !restTimerActive) return;
    const id = setInterval(() => tickRestTimer(), 1000);
    return () => clearInterval(id);
  }, [isActive, restTimerActive, tickRestTimer]);

  return null;
}

export default function App() {
  const activeTab = useUIStore(s => s.activeTab);
  const setActiveTab = useUIStore(s => s.setActiveTab);
  const showSeedingScreen = useUIStore(s => s.showSeedingScreen);
  const setShowSeedingScreen = useUIStore(s => s.setShowSeedingScreen);
  const setSeedingProgress = useUIStore(s => s.setSeedingProgress);

  const setIsSeeded = useUserStore(s => s.setIsSeeded);
  const setIsLoading = useUserStore(s => s.setIsLoading);
  const loadFromProfile = useUserStore(s => s.loadFromProfile);
  const animationLevel = useUserStore(s => s.animationLevel);

  const workoutActive = useWorkoutStore(s => s.isActive);
  const workoutMinimized = useWorkoutStore(s => s.isMinimized);
  const setMinimized = useWorkoutStore(s => s.setMinimized);
  const endWorkout = useWorkoutStore(s => s.endWorkout);
  const restoreWorkoutIfAny = useWorkoutStore(s => s.restoreWorkoutIfAny);

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

  useEffect(() => {
    if (!showCatalogUpdateToast) return;

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
        endWorkout();
        setShowComplete(false);
        setActiveTab('home');
        pushSentinel();
      } else if (current.workoutActive && !current.workoutMinimized) {
        // Minimize active workout on Android hardware Back so progress is never lost accidentally
        setMinimized(true);
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
  }, [endWorkout, setActiveTab, setMinimized]);

  const handleWorkoutComplete = useCallback(() => {
    setShowComplete(true);
  }, []);

  const handleFinishComplete = useCallback(() => {
    endWorkout();
    setShowComplete(false);
    setActiveTab('home');
  }, [endWorkout, setActiveTab]);

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
      <GlobalWorkoutClock />
      {showComplete ? (
        <WorkoutCompletePage onFinish={handleFinishComplete} />
      ) : workoutActive && !workoutMinimized ? (
        <ActiveWorkoutPage onComplete={handleWorkoutComplete} />
      ) : (
        <>
          {initError && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
              background: 'rgba(255,61,90,0.14)', backdropFilter: 'blur(12px)',
              padding: 'max(12px, env(safe-area-inset-top)) 16px 12px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', borderBottom: '1px solid rgba(255,61,90,0.25)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, flex: 1, marginRight: 10 }}>{initError}</span>
              <button onClick={() => doInit(true)} style={{
                background: 'var(--gradient-fire)', border: 'none', color: 'var(--on-accent-text)',
                padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>Reset &amp; Retry</button>
            </div>
          )}
          {showExitHint && (
            <div className="app-inline-toast app-inline-toast--neutral">
              Press back again to exit
            </div>
          )}
          {showCatalogUpdateToast && (
            <div className="app-inline-toast app-inline-toast--success">
              Catalog updated: GIFs prioritized, plans balanced &amp; body map upgraded!
            </div>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence>
            {workoutActive && workoutMinimized && <MinimizedWorkoutBar />}
          </AnimatePresence>
          <BottomNav />
        </>
      )}
    </MotionConfig>
  );
}
