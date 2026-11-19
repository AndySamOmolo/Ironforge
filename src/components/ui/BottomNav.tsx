'use client';

import { useState, useEffect } from 'react';
import { Home, ClipboardList, Play, BarChart3, User, Zap, Shuffle, Dumbbell, X } from 'lucide-react';
import { useUIStore } from '@/lib/store/uiStore';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { db } from '@/lib/db/schema';
import { ALL_EQUIPMENT, resolveWorkoutDayExercises, generateSmartWorkout, matchesUserEquipment } from '@/lib/utils/exerciseResolver';
import { getWorkoutStartingWeight, resolveNextPlanDayIndex } from '@/lib/utils/workoutDefaults';
import { getPrimaryExerciseImage, getExerciseImageFrames, getExerciseGifUrl, hasGifExerciseMedia } from '@/lib/utils/exerciseMedia';
import { SetType } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'plans', label: 'Plans', icon: ClipboardList },
  { id: 'start', label: 'Start', icon: Play },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const { activeTab, setActiveTab } = useUIStore();
  const { equipment: userEquipment, barWeight, dumbbellWeight, exerciseVariety, defaultRestTime } = useUserStore();
  const { startWorkout, isActive: workoutActive, isMinimized: workoutMinimized, resumeWorkout } = useWorkoutStore();
  const [showQuickLaunch, setShowQuickLaunch] = useState(false);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [nextPlanDayLabel, setNextPlanDayLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!showQuickLaunch) return;
    let cancelled = false;
    (async () => {
      try {
        const plan = await db.workoutPlans.filter(p => !!p.isActive).first();
        if (cancelled) return;
        setActivePlanName(plan?.name || null);
        if (!plan?.id) {
          setNextPlanDayLabel(null);
          return;
        }
        const [days, allSessions] = await Promise.all([
          db.workoutDays.where('planId').equals(plan.id).sortBy('dayNumber'),
          db.workoutSessions.toArray(),
        ]);
        if (cancelled) return;
        if (days.length > 0) {
          const nextIdx = resolveNextPlanDayIndex(days, allSessions, plan.name, plan.id);
          const nextDay = days[nextIdx] || days[0];
          setNextPlanDayLabel(`D${nextDay.dayNumber} · ${nextDay.name}`);
        } else {
          setNextPlanDayLabel(null);
        }
      } catch {
        if (!cancelled) {
          setActivePlanName(null);
          setNextPlanDayLabel(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [showQuickLaunch]);

  useEffect(() => {
    if (!showQuickLaunch) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowQuickLaunch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQuickLaunch]);

  const handleTabClick = (tabId: string) => {
    if (tabId === 'start') {
      if (workoutActive && workoutMinimized) {
        resumeWorkout();
        return;
      }
      setShowQuickLaunch(true);
      return;
    }
    setActiveTab(tabId);
  };

  const handleStartActivePlanDay = async () => {
    try {
      const activePlan = await db.workoutPlans.filter(p => !!p.isActive).first();
      if (!activePlan?.id) {
        setShowQuickLaunch(false);
        setActiveTab('plans');
        return;
      }
      const days = await db.workoutDays.where('planId').equals(activePlan.id).sortBy('dayNumber');
      if (days.length === 0) {
        setShowQuickLaunch(false);
        setActiveTab('plans');
        return;
      }
      const allSessions = await db.workoutSessions.toArray();
      const planCompletedCount = allSessions.filter(
        s => Boolean(s.isComplete) && (s.planName === activePlan.name || (activePlan.id != null && s.planId === activePlan.id))
      ).length;
      const nextIdx = resolveNextPlanDayIndex(days, allSessions, activePlan.name, activePlan.id);
      const nextDay = days[nextIdx] || days[0];
      const savedSwaps: Record<string, { newExerciseId: number; newExerciseName: string; newGifUrl?: string }> = {};
      try {
        const swaps = await db.exerciseSwaps
          .where('planName')
          .equals(activePlan.name)
          .filter(s => s.dayName === nextDay.name)
          .toArray();
        for (const swap of swaps) {
          savedSwaps[swap.originalExerciseName.toLowerCase()] = {
            newExerciseId: swap.newExerciseId,
            newExerciseName: swap.newExerciseName,
            newGifUrl: swap.newGifUrl,
          };
        }
      } catch {}
      const allExercises = await db.exercises.toArray();
      const equip = userEquipment && userEquipment.length > 0 ? userEquipment : [...ALL_EQUIPMENT];
      const hasSwaps = Object.keys(savedSwaps).length > 0;
      const resolved = resolveWorkoutDayExercises({
        dayExercises: nextDay.exercises,
        allExercises,
        userEquipment: equip,
        barWeight,
        dumbbellWeight,
        savedSwaps,
        varietySeed: hasSwaps ? 0 : planCompletedCount + nextDay.dayNumber,
        varietyLevel: exerciseVariety || 'medium',
      });
      setShowQuickLaunch(false);
      startWorkout(activePlan.name, nextDay.name, resolved);
    } catch {
      setShowQuickLaunch(false);
      setActiveTab('plans');
    }
  };

  const handleStartSmartMix = async () => {
    try {
      const allExercises = await db.exercises.toArray();
      const equip = userEquipment && userEquipment.length > 0 ? userEquipment : [...ALL_EQUIPMENT];
      const generated = generateSmartWorkout({
        targetMuscles: ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'biceps', 'triceps'],
        exerciseCount: 6,
        setsPerExercise: 3,
        repsPerSet: 10,
        allExercises,
        userEquipment: equip,
        seed: Date.now(),
      });
      const dayExercises = generated.map((item, i) => ({
        exerciseId: 0,
        exerciseName: item.name,
        sets: item.sets,
        reps: item.reps,
        restTime: defaultRestTime || 90,
        setType: SetType.Normal,
        order: i,
      }));
      const resolved = resolveWorkoutDayExercises({
        dayExercises,
        allExercises,
        userEquipment: equip,
        barWeight,
        dumbbellWeight,
        varietySeed: 0,
        varietyLevel: 'low',
      });
      setShowQuickLaunch(false);
      startWorkout('Smart Mix', 'Full Body Express', resolved);
    } catch {}
  };

  const handleStartFreestyle = async () => {
    try {
      const allExercises = await db.exercises.toArray();
      const equip = userEquipment && userEquipment.length > 0 ? userEquipment : [...ALL_EQUIPMENT];
      const firstMatch =
        allExercises.find(e => matchesUserEquipment(e, equip) && hasGifExerciseMedia(e)) ||
        allExercises.find(e => matchesUserEquipment(e, equip)) ||
        allExercises[0];
      if (!firstMatch) return;
      const startW = getWorkoutStartingWeight({
        equipment: firstMatch.equipment,
        barWeight,
        dumbbellWeight,
      });
      setShowQuickLaunch(false);
      startWorkout('Freestyle', 'Open Session', [
        {
          exerciseId: firstMatch.id || 0,
          exerciseName: firstMatch.name,
          imageUrl: getPrimaryExerciseImage(firstMatch),
          gifUrl: getExerciseGifUrl(firstMatch),
          mediaFrames: getExerciseImageFrames(firstMatch),
          sets: Array.from({ length: 3 }, (_, i) => ({
            setNumber: i + 1,
            setType: SetType.Normal,
            weight: startW,
            reps: 10,
            targetWeight: startW,
            targetReps: 10,
            isComplete: false,
          })),
          targetSets: 3,
          targetReps: 10,
          restTime: defaultRestTime || 90,
          isComplete: false,
        },
      ]);
    } catch {}
  };

  return (
    <>
      <nav className="bottom-nav">
        {tabs.map((tab) => {
          if (tab.id === 'start') {
            return (
              <button
                key={tab.id}
                className="nav-start-btn"
                onClick={() => handleTabClick(tab.id)}
                aria-label="Start workout"
              >
                <div className="nav-start-ring" style={{
                  position: 'absolute', width: 62, height: 62, borderRadius: '50%',
                  border: '1.5px solid var(--border-active)',
                  animation: 'pulse-dot 3s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
                <Play size={24} fill="currentColor" />
              </button>
            );
          }
          const isActive = activeTab === tab.id || (tab.id === 'plans' && activeTab === 'exercises');
          return (
            <button
              key={tab.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              aria-label={tab.label}
            >
              <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="nav-label" style={{ fontWeight: isActive ? 700 : 500 }}>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--accent-red)',
                    boxShadow: '0 0 8px var(--glow-red)',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Launch Bottom Sheet */}
      <AnimatePresence>
        {showQuickLaunch && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowQuickLaunch(false)}>
            <motion.div
              className="modal-content"
              role="dialog"
              aria-modal="true"
              aria-label="Launch Workout"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 className="font-display" style={{ fontSize: 19, fontWeight: 800 }}>Launch Workout</h3>
                <button
                  onClick={() => setShowQuickLaunch(false)}
                  aria-label="Close modal"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={handleStartActivePlanDay} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--accent-red) 30%, transparent)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--gradient-fire)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Play size={18} fill="currentColor" color="var(--text-on-accent)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{activePlanName ? `Next Day in ${activePlanName}` : 'Choose an Active Plan'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activePlanName ? (nextPlanDayLabel ? `Up next: ${nextPlanDayLabel}` : 'Automatically picks the next scheduled day for your equipment') : 'Browse balanced workout programs to activate your split'}</div>
                  </div>
                </button>

                <button onClick={handleStartSmartMix} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--accent-purple) 30%, transparent)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--gradient-ocean)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Shuffle size={18} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Smart Full-Body Mix</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Generates 6 fresh GIF-backed exercises matching your equipment</div>
                  </div>
                </button>

                <button onClick={handleStartFreestyle} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--gradient-mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={18} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Freestyle Open Session</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Start immediately and add any exercises on the fly</div>
                  </div>
                </button>

                <button onClick={() => { setShowQuickLaunch(false); setActiveTab('exercises'); }} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Dumbbell size={18} color="var(--text-secondary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Browse Exercise Library</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Explore 2,240+ exercises with animated GIF demos</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
