'use client';

import { useState } from 'react';
import { Home, ClipboardList, Play, BarChart3, User, Zap, Shuffle, Dumbbell, X } from 'lucide-react';
import { useUIStore } from '@/lib/store/uiStore';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { db } from '@/lib/db/schema';
import { ALL_EQUIPMENT, resolveWorkoutDayExercises, generateSmartWorkout, matchesUserEquipment } from '@/lib/utils/exerciseResolver';
import { getWorkoutStartingWeight } from '@/lib/utils/workoutDefaults';
import { getPrimaryExerciseImage, getExerciseImageFrames, getExerciseGifUrl, hasGifExerciseMedia } from '@/lib/utils/exerciseMedia';
import { SetType } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'plans', label: 'Plans', icon: ClipboardList },
  { id: 'start', label: 'Start', icon: Play },
  { id: 'exercises', label: 'Exercises', icon: Dumbbell },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const activeTab = useUIStore(s => s.activeTab);
  const setActiveTab = useUIStore(s => s.setActiveTab);
  const userEquipment = useUserStore(s => s.equipment);
  const barWeight = useUserStore(s => s.barWeight);
  const dumbbellWeight = useUserStore(s => s.dumbbellWeight);
  const exerciseVariety = useUserStore(s => s.exerciseVariety);
  const defaultRestTime = useUserStore(s => s.defaultRestTime);

  const startWorkout = useWorkoutStore(s => s.startWorkout);
  const workoutActive = useWorkoutStore(s => s.isActive);
  const setMinimized = useWorkoutStore(s => s.setMinimized);
  const [showQuickLaunch, setShowQuickLaunch] = useState(false);

  const handleTabClick = (tabId: string) => {
    if (tabId === 'start') {
      if (workoutActive) {
        setMinimized(false);
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
      const completedCount = await db.workoutSessions.filter(s => s.isComplete).count();
      const nextDay = days[completedCount % days.length];
      const allExercises = await db.exercises.toArray();
      const equip = userEquipment && userEquipment.length > 0 ? userEquipment : [...ALL_EQUIPMENT];
      const resolved = resolveWorkoutDayExercises({
        dayExercises: nextDay.exercises,
        allExercises,
        userEquipment: equip,
        barWeight,
        dumbbellWeight,
        varietySeed: completedCount + nextDay.dayNumber,
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
      <nav className="bottom-nav" aria-label="Main navigation">
        {tabs.map((tab) => {
          if (tab.id === 'start') {
            return (
              <button
                key={tab.id}
                className="nav-start-btn"
                onClick={() => handleTabClick(tab.id)}
                aria-label={workoutActive ? 'Resume active workout' : 'Start workout'}
                title={workoutActive ? 'Resume active workout' : 'Launch workout'}
              >
                <div style={{
                  position: 'absolute', width: 62, height: 62, borderRadius: '50%',
                  border: '2px solid rgba(255,61,90,0.28)',
                  animation: 'pulse-dot 3s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
                <Play size={22} fill="currentColor" />
              </button>
            );
          }
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <tab.icon size={20} strokeWidth={isActive ? 2.5 : 1.7} />
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

      {/* Quick Launch Bottom Sheet with Drag-to-Dismiss */}
      <AnimatePresence>
        {showQuickLaunch && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowQuickLaunch(false)}>
            <motion.div
              className="modal-content"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 450) {
                  setShowQuickLaunch(false);
                }
              }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 className="font-display" style={{ fontSize: 19, fontWeight: 800 }}>Launch Workout</h3>
                <button onClick={() => setShowQuickLaunch(false)} aria-label="Close modal" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={handleStartActivePlanDay} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(255,61,90,0.3)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--gradient-fire)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Play size={18} fill="white" color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Next Day in Active Plan</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Automatically picks the next scheduled day for your equipment</div>
                  </div>
                </button>

                <button onClick={handleStartSmartMix} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--gradient-ocean)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Shuffle size={18} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Smart Full-Body Mix</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Generates 6 fresh GIF-backed exercises matching your equipment</div>
                  </div>
                </button>

                <button onClick={handleStartFreestyle} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(16,232,154,0.3)' }}>
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
