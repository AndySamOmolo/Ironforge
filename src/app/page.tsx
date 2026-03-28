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
  const { isActive: workoutActive } = useWorkoutStore();
  const [showComplete, setShowComplete] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const attemptRef = useRef(0);

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
          equipment: p.equipment,
          defaultRestTime: p.defaultRestTime,
          restTimerEnabled: p.restTimerEnabled,
          soundEnabled: p.soundEnabled,
          hapticEnabled: p.hapticEnabled,
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
      {renderPage()}
      <BottomNav />
    </>
  );
}
