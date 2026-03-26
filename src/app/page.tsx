'use client';

import { useEffect, useState, useCallback } from 'react';
import { seedDatabase } from '@/lib/db/seed';
import { db } from '@/lib/db/schema';
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
  const { setIsSeeded, setIsLoading, loadFromProfile, isSeeded } = useUserStore();
  const { isActive: workoutActive } = useWorkoutStore();
  const [showComplete, setShowComplete] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const profiles = await db.userProfile.toArray();
        if (profiles.length > 0 && profiles[0].isSeeded) {
          loadFromProfile({
            name: profiles[0].name,
            unitSystem: profiles[0].unitSystem,
            barWeight: profiles[0].barWeight,
            equipment: profiles[0].equipment,
            defaultRestTime: profiles[0].defaultRestTime,
            restTimerEnabled: profiles[0].restTimerEnabled,
            soundEnabled: profiles[0].soundEnabled,
            hapticEnabled: profiles[0].hapticEnabled,
            theme: profiles[0].theme,
            isSeeded: true,
          });
          setIsLoading(false);
          setIsInitialized(true);
        } else {
          setShowSeedingScreen(true);
          await seedDatabase((msg, pct) => {
            setSeedingProgress(pct, msg);
          });
          setIsSeeded(true);
          setShowSeedingScreen(false);
          setIsLoading(false);
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('Init error:', err);
        setIsLoading(false);
        setIsInitialized(true);
      }
    };
    init();
  }, []);

  const handleWorkoutComplete = useCallback(() => {
    setShowComplete(true);
  }, []);

  const handleFinishComplete = useCallback(() => {
    setShowComplete(false);
    setActiveTab('home');
  }, [setActiveTab]);

  if (showSeedingScreen || !isInitialized) {
    return <SeedingScreen />;
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
      {renderPage()}
      <BottomNav />
    </>
  );
}
