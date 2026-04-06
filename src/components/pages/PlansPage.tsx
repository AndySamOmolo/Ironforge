'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronRight, ChevronDown, ChevronUp, Zap, Target, Dumbbell, Plus, X, Check, Settings, Search, Play, XCircle } from 'lucide-react';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import type { WorkoutPlan, WorkoutDay, Exercise } from '@/lib/types';
import { getWorkoutStartingWeight } from '@/lib/utils/workoutDefaults';
import { getPrimaryExerciseImage, getExerciseImageFrames } from '@/lib/utils/exerciseMedia';
import ExerciseMedia from '@/components/ui/ExerciseMedia';

const CATEGORY_COLORS: Record<string, string> = {
  Hypertrophy: 'var(--accent-purple)',
  Strength: 'var(--accent-blue)',
  Powerlifting: 'var(--accent-red)',
  Cardio: 'var(--accent-orange)',
  Bodyweight: 'var(--accent-green)',
  Mobility: 'var(--accent-cyan)',
};

const DIFFICULTY_LABELS: Record<string, { color: string; bg: string }> = {
  beginner: { color: 'var(--accent-green)', bg: 'rgba(16,232,154,0.08)' },
  intermediate: { color: 'var(--accent-yellow)', bg: 'rgba(251,191,36,0.08)' },
  expert: { color: 'var(--accent-red)', bg: 'rgba(255,61,90,0.08)' },
};

const ALL_EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'body weight', 'machine', 'leverage machine',
  'band', 'kettlebell', 'medicine ball', 'smith machine', 'ez barbell',
  'olympic barbell', 'trap bar', 'bosu ball', 'stability ball',
];

export default function PlansPage() {
  const { equipment: userEquipment, barWeight, dumbbellWeight } = useUserStore();
  const { startWorkout } = useWorkoutStore();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [planDays, setPlanDays] = useState<Record<number, WorkoutDay[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showEquipment, setShowEquipment] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(userEquipment || ALL_EQUIPMENT);
  const [showBuilder, setShowBuilder] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const allPlans = await db.workoutPlans.toArray();
      setPlans(allPlans);
    } catch {}
    setIsLoading(false);
  };

  const togglePlan = async (planId: number) => {
    if (expandedPlan === planId) { setExpandedPlan(null); return; }
    setExpandedPlan(planId);
    if (!planDays[planId]) {
      const days = await db.workoutDays.where('planId').equals(planId).sortBy('dayNumber');
      setPlanDays(prev => ({ ...prev, [planId]: days }));
    }
  };

  const activatePlan = async (planId: number) => {
    await db.workoutPlans.where('isActive').equals(1).modify({ isActive: false });
    await db.workoutPlans.update(planId, { isActive: true });
    loadPlans();
  };

  const deactivatePlan = async (planId: number) => {
    await db.workoutPlans.update(planId, { isActive: false });
    loadPlans();
  };

  const startDay = async (plan: WorkoutPlan, day: WorkoutDay) => {
    // Load saved swaps for this plan+day
    let savedSwaps: Record<string, { newExerciseId: number; newExerciseName: string; newGifUrl?: string }> = {};
    try {
      const swaps = await db.exerciseSwaps.where('planName').equals(plan.name).filter(s => s.dayName === day.name).toArray();
      for (const swap of swaps) {
        savedSwaps[swap.originalExerciseName.toLowerCase()] = {
          newExerciseId: swap.newExerciseId,
          newExerciseName: swap.newExerciseName,
          newGifUrl: swap.newGifUrl,
        };
      }
    } catch {}

    const exercises = await Promise.all(day.exercises.map(async (ex) => {
      // Check if there's a saved swap for this exercise
      const swap = savedSwaps[ex.exerciseName.toLowerCase()];
      if (swap) {
        const swappedEx = await db.exercises.get(swap.newExerciseId);
        if (swappedEx) {
          const startingWeight = getWorkoutStartingWeight({
            equipment: swappedEx.equipment,
            plannedWeight: ex.weight,
            barWeight,
            dumbbellWeight,
          });
          return {
            exerciseId: swappedEx.id || 0, exerciseName: swappedEx.name,
            imageUrl: getPrimaryExerciseImage(swappedEx), gifUrl: swappedEx.gifUrl,
            mediaFrames: getExerciseImageFrames(swappedEx),
            sets: Array.from({ length: ex.sets }, (_, i) => ({ setNumber: i + 1, setType: ex.setType as any, weight: startingWeight, reps: typeof ex.reps === 'number' ? ex.reps : 0, targetWeight: ex.weight || 0, targetReps: typeof ex.reps === 'number' ? ex.reps : 0, isComplete: false })),
            targetSets: ex.sets, targetReps: ex.reps, restTime: ex.restTime, isComplete: false,
          };
        }
      }

      // Fuzzy search: try exact match first, then keyword-based partial match
      let dbEx = await db.exercises.where('name').equalsIgnoreCase(ex.exerciseName).first();
      if (!dbEx) {
        const keywords = ex.exerciseName.toLowerCase().split(/\s+/).filter(k => k.length > 2);
        const candidates = await db.exercises.filter(e => {
          const eName = e.name.toLowerCase();
          return keywords.every(kw => eName.includes(kw)) || keywords.filter(kw => eName.includes(kw)).length >= Math.max(1, keywords.length - 1);
        }).limit(5).toArray();
        if (candidates.length > 0) {
          dbEx = candidates.sort((a, b) => Math.abs(a.name.length - ex.exerciseName.length) - Math.abs(b.name.length - ex.exerciseName.length))[0];
        }
      }
      // Check if exercise matches user equipment
      if (dbEx && selectedEquipment.length > 0) {
        const exEquip = dbEx.equipment?.toLowerCase() || 'body weight';
        if (!selectedEquipment.some(eq => exEquip.includes(eq.toLowerCase()))) {
          const alt = await db.exercises
            .filter(e => e.primaryMuscles.some(m => dbEx!.primaryMuscles.includes(m)) && selectedEquipment.some(eq => (e.equipment || '').toLowerCase().includes(eq.toLowerCase())))
            .first();
          if (alt) {
            return {
              exerciseId: alt.id || 0, exerciseName: alt.name,
              imageUrl: getPrimaryExerciseImage(alt), gifUrl: alt.gifUrl,
              mediaFrames: getExerciseImageFrames(alt),
              sets: Array.from({ length: ex.sets }, (_, i) => ({ setNumber: i + 1, setType: ex.setType as any, weight: 0, reps: typeof ex.reps === 'number' ? ex.reps : 0, targetWeight: 0, targetReps: typeof ex.reps === 'number' ? ex.reps : 0, isComplete: false })),
              targetSets: ex.sets, targetReps: ex.reps, restTime: ex.restTime, isComplete: false,
            };
          }
        }
      }
      const startingWeight = getWorkoutStartingWeight({
        equipment: dbEx?.equipment,
        plannedWeight: ex.weight,
        barWeight,
        dumbbellWeight,
      });
      return {
        exerciseId: dbEx?.id || 0, exerciseName: dbEx?.name || ex.exerciseName,
        imageUrl: dbEx ? getPrimaryExerciseImage(dbEx) : undefined,
        gifUrl: dbEx?.gifUrl,
        mediaFrames: dbEx ? getExerciseImageFrames(dbEx) : [],
        sets: Array.from({ length: ex.sets }, (_, i) => ({ setNumber: i + 1, setType: ex.setType as any, weight: startingWeight, reps: typeof ex.reps === 'number' ? ex.reps : 0, targetWeight: ex.weight || 0, targetReps: typeof ex.reps === 'number' ? ex.reps : 0, isComplete: false })),
        targetSets: ex.sets, targetReps: ex.reps, restTime: ex.restTime, isComplete: false,
      };
    }));

    startWorkout(plan.name, day.name, exercises);
  };

  const categories = useMemo(() => {
    const cats = new Set(plans.map(p => p.category));
    return ['all', ...Array.from(cats)];
  }, [plans]);

  const filteredPlans = useMemo(() => {
    if (categoryFilter === 'all') return plans;
    return plans.filter(p => p.category === categoryFilter);
  }, [plans, categoryFilter]);

  const toggleEquipment = (eq: string) => {
    setSelectedEquipment(prev =>
      prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
    );
  };

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span className="gradient-text">Workout Plans</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          {plans.length} programs • Equipment-filtered
        </p>
      </motion.div>

      {/* Equipment Setup */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        style={{ marginBottom: 16 }}>
        <button onClick={() => setShowEquipment(!showEquipment)} className="card" style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', padding: '14px 16px', border: '1px solid var(--border-subtle)', minHeight: 56,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--gradient-mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={16} color="white" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>My Equipment</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedEquipment.length} items selected</div>
            </div>
          </div>
          {showEquipment ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </button>

        <AnimatePresence>
          {showEquipment && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, padding: '12px 0' }}>
                {ALL_EQUIPMENT.map(eq => (
                  <button key={eq} className={`equipment-check ${selectedEquipment.includes(eq) ? 'selected' : ''}`} onClick={() => toggleEquipment(eq)}>
                    <div className="equipment-check-box">
                      {selectedEquipment.includes(eq) && <Check size={12} color="white" />}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{eq}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSelectedEquipment(ALL_EQUIPMENT)} className="btn-ghost" style={{ flex: 1, fontSize: 11, minHeight: 40 }}>Select All</button>
                <button onClick={() => setSelectedEquipment(['body weight'])} className="btn-ghost" style={{ flex: 1, fontSize: 11, minHeight: 40 }}>Body Only</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Category Filter */}
      <div className="chip-scroll">
        {categories.map(cat => (
          <button key={cat} className={`filter-chip ${categoryFilter === cat ? 'active' : ''}`}
            onClick={() => setCategoryFilter(cat)}>
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Plans List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredPlans.map((plan, i) => {
          const isExpanded = expandedPlan === plan.id;
          const days = planDays[plan.id!] || [];
          const catColor = CATEGORY_COLORS[plan.category] || 'var(--text-muted)';
          const diff = DIFFICULTY_LABELS[plan.difficulty] || DIFFICULTY_LABELS.intermediate;

          return (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden', border: plan.isActive ? '1px solid rgba(16,232,154,0.3)' : '1px solid var(--border-subtle)' }}>
                {plan.isActive && (
                  <div style={{ background: 'var(--gradient-mint)', padding: '5px 0', textAlign: 'center', fontSize: 10, fontWeight: 800, color: 'white', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    ✓ Active Plan
                  </div>
                )}
                <button onClick={() => togglePlan(plan.id!)} style={{
                  width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', minHeight: 80,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.01em' }}>{plan.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 10 }}>{plan.description}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: 10 }}>
                        📅 {plan.daysPerWeek}d/week
                      </span>
                      <span className="badge" style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.color}20`, fontSize: 10, textTransform: 'capitalize' }}>
                        ☆ {plan.difficulty}
                      </span>
                      <span className="badge" style={{ background: `${catColor}10`, color: catColor, border: `1px solid ${catColor}20`, fontSize: 10 }}>
                        {plan.category}
                      </span>
                    </div>
                  </div>
                  <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight size={18} color="var(--text-muted)" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
                      <div style={{ padding: 16 }}>
                        {days.map((day, j) => (
                          <div key={day.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: j < days.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--gradient-fire)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'white', flexShrink: 0 }}>
                                D{day.dayNumber}
                              </div>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{day.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{day.exercises.length} exercises</div>
                              </div>
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.93 }}
                              onClick={() => startDay(plan, day)}
                              style={{
                                background: 'var(--gradient-fire)', border: 'none', color: 'white', borderRadius: 14,
                                padding: '12px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                boxShadow: '0 4px 16px var(--glow-red)', display: 'flex', alignItems: 'center', gap: 6,
                                minHeight: 48,
                              }}>
                              <Play size={14} fill="white" /> Start
                            </motion.button>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                          {!plan.isActive ? (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => activatePlan(plan.id!)}
                              style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '12px 16px', borderRadius: 14, minHeight: 48,
                                background: 'rgba(16,232,154,0.06)', border: '1px solid rgba(16,232,154,0.2)',
                                color: 'var(--accent-green)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              }}>
                              <Target size={14} /> Set as Active Plan
                            </motion.button>
                          ) : (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => deactivatePlan(plan.id!)}
                              style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '12px 16px', borderRadius: 14, minHeight: 48,
                                background: 'rgba(255,61,90,0.06)', border: '1px solid rgba(255,61,90,0.2)',
                                color: 'var(--accent-red)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              }}>
                              <XCircle size={14} /> Remove Active
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Custom Plan Builder Button */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        style={{ marginTop: 24 }}>
        <button onClick={() => setShowBuilder(true)} className="btn-primary" style={{ borderRadius: 16, minHeight: 52 }}>
          <Plus size={18} /> Create Custom Plan
        </button>
      </motion.div>

      {/* Custom Plan Builder Modal */}
      <AnimatePresence>
        {showBuilder && <CustomPlanBuilder onClose={() => { setShowBuilder(false); loadPlans(); }} equipment={selectedEquipment} />}
      </AnimatePresence>
    </div>
  );
}

/* ===== CUSTOM PLAN BUILDER ===== */
function CustomPlanBuilder({ onClose, equipment }: { onClose: () => void; equipment: string[] }) {
  const [planName, setPlanName] = useState('');
  const [days, setDays] = useState<{ name: string; exercises: { name: string; sets: number; reps: number }[] }[]>([{ name: 'Day 1', exercises: [] }]);
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [search, setSearch] = useState('');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    db.exercises.toArray().then(setAllExercises);
  }, []);

  const filteredExercises = useMemo(() => {
    let filtered = allExercises;
    if (equipment.length > 0 && equipment.length < 15) {
      filtered = filtered.filter(e => equipment.some(eq => (e.equipment || '').toLowerCase().includes(eq.toLowerCase())));
    }
    if (search) filtered = filtered.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
    return filtered.slice(0, 50);
  }, [allExercises, equipment, search]);

  const addExercise = (exercise: Exercise) => {
    setDays(prev => {
      const updated = [...prev];
      updated[currentDayIdx] = {
        ...updated[currentDayIdx],
        exercises: [...updated[currentDayIdx].exercises, { name: exercise.name, sets: 3, reps: 10 }],
      };
      return updated;
    });
    setShowExercisePicker(false);
  };

  const removeExercise = (dayIdx: number, exIdx: number) => {
    setDays(prev => {
      const updated = [...prev];
      updated[dayIdx] = { ...updated[dayIdx], exercises: updated[dayIdx].exercises.filter((_, i) => i !== exIdx) };
      return updated;
    });
  };

  const addDay = () => {
    setDays(prev => [...prev, { name: `Day ${prev.length + 1}`, exercises: [] }]);
    setCurrentDayIdx(days.length);
  };

  const savePlan = async () => {
    if (!planName.trim()) return;
    const planId = await db.workoutPlans.add({
      name: planName, description: 'Custom workout plan', category: 'Custom',
      difficulty: 'intermediate', daysPerWeek: days.length, isCustom: true,
      isActive: false, createdAt: new Date(), updatedAt: new Date(),
    } as any);
    for (const day of days) {
      await db.workoutDays.add({
        planId, dayNumber: days.indexOf(day) + 1, name: day.name,
        exercises: day.exercises.map((ex, i) => ({
          exerciseId: 0, exerciseName: ex.name, sets: ex.sets, reps: ex.reps,
          restTime: 90, setType: 'normal', order: i,
        })),
      } as any);
    }
    onClose();
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} style={{ maxHeight: '92dvh' }}>
        <div className="modal-handle" />
        <h2 className="font-display" style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Create Custom Plan</h2>

        {/* Plan Name */}
        <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Plan name..."
          style={{ width: '100%', padding: '14px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 14, color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, outline: 'none', marginBottom: 16, fontFamily: 'inherit', minHeight: 48 }} />

        {/* Day Tabs */}
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {days.map((day, i) => (
            <button key={i} className={`tab-btn ${i === currentDayIdx ? 'active' : ''}`} onClick={() => setCurrentDayIdx(i)}>
              {day.name}
            </button>
          ))}
          <button onClick={addDay} className="tab-btn" style={{ minWidth: 40 }}><Plus size={14} /></button>
        </div>

        {/* Day Name */}
        <input value={days[currentDayIdx]?.name || ''} onChange={e => {
          setDays(prev => { const u = [...prev]; u[currentDayIdx] = { ...u[currentDayIdx], name: e.target.value }; return u; });
        }} placeholder="Day name..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 13, outline: 'none', marginBottom: 12, fontFamily: 'inherit', minHeight: 44 }} />

        {/* Exercises */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {days[currentDayIdx]?.exercises.map((ex, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'var(--bg-glass)', borderRadius: 12, border: '1px solid var(--border)', minHeight: 48 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{ex.name}</div>
              <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ex.sets}×{ex.reps}</div>
              <button onClick={() => removeExercise(currentDayIdx, i)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 6, minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
          ))}
        </div>

        <button onClick={() => setShowExercisePicker(true)} className="btn-secondary" style={{ width: '100%', marginBottom: 16, minHeight: 48, borderRadius: 14 }}>
          <Plus size={14} /> Add Exercise
        </button>

        <button onClick={savePlan} className="btn-primary" style={{ borderRadius: 14, minHeight: 52 }} disabled={!planName.trim() || days.every(d => d.exercises.length === 0)}>
          Save Plan
        </button>

        {/* Exercise Picker */}
        <AnimatePresence>
          {showExercisePicker && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'var(--bg-sheet)', borderRadius: 'var(--r-2xl) var(--r-2xl) 0 0', padding: 20, zIndex: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>Pick Exercise</h3>
                <button onClick={() => setShowExercisePicker(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              </div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="search-bar" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ paddingLeft: 36 }} />
              </div>
              <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredExercises.map(ex => (
                  <button key={ex.id} onClick={() => addExercise(ex)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                    background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12,
                    cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text-primary)', minHeight: 56,
                  }}>
                    <ExerciseMedia
                      gifUrl={ex.gifUrl}
                      imageUrls={ex.imageUrls}
                      images={ex.images}
                      alt={ex.name}
                      style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{ex.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ex.equipment} • {ex.primaryMuscles.join(', ')}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
