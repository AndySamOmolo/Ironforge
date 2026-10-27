'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, ChevronUp, Target, Plus, X, Check, Settings, Search, Play, XCircle, Shuffle, Sparkles, Trash2, Copy } from 'lucide-react';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import type { WorkoutPlan, WorkoutDay, Exercise } from '@/lib/types';
import {
  ALL_EQUIPMENT,
  EQUIPMENT_PRESETS,
  matchesUserEquipment,
  resolveWorkoutDayExercises,
  generateSmartWorkout,
} from '@/lib/utils/exerciseResolver';
import ExerciseMedia from '@/components/ui/ExerciseMedia';

const CATEGORY_COLORS: Record<string, string> = {
  Hypertrophy: 'var(--accent-purple)',
  Strength: 'var(--accent-blue)',
  Powerlifting: 'var(--accent-red)',
  Cardio: 'var(--accent-orange)',
  Bodyweight: 'var(--accent-green)',
  Mobility: 'var(--accent-cyan)',
  Custom: 'var(--accent-pink)',
};

const DIFFICULTY_LABELS: Record<string, { color: string; bg: string }> = {
  beginner: { color: 'var(--accent-green)', bg: 'rgba(16,232,154,0.08)' },
  intermediate: { color: 'var(--accent-yellow)', bg: 'rgba(251,191,36,0.08)' },
  expert: { color: 'var(--accent-red)', bg: 'rgba(255,61,90,0.08)' },
};

export default function PlansPage() {
  const {
    equipment: userEquipment,
    setEquipment: setStoreEquipment,
    barWeight,
    dumbbellWeight,
    exerciseVariety,
    setField,
  } = useUserStore();
  const { startWorkout } = useWorkoutStore();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [planDays, setPlanDays] = useState<Record<number, WorkoutDay[]>>({});
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [recentExerciseIds, setRecentExerciseIds] = useState<Set<number>>(new Set());
  const [sessionCount, setSessionCount] = useState(0);
  const [dayVarietySeeds, setDayVarietySeeds] = useState<Record<string, number>>({});
  const [showEquipment, setShowEquipment] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showSmartGenerator, setShowSmartGenerator] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const selectedEquipment = useMemo(
    () => (userEquipment && userEquipment.length > 0 ? userEquipment : [...ALL_EQUIPMENT]),
    [userEquipment]
  );

  useEffect(() => {
    loadPlansAndCatalog();
  }, []);

  const loadPlansAndCatalog = async () => {
    try {
      const [allPlans, catalog, recentSets, completedCount] = await Promise.all([
        db.workoutPlans.toArray(),
        db.exercises.toArray(),
        db.sets.orderBy('completedAt').reverse().limit(120).toArray(),
        db.workoutSessions.filter(s => s.isComplete).count(),
      ]);
      setPlans(allPlans);
      setAllExercises(catalog);
      setRecentExerciseIds(new Set(recentSets.map(s => s.exerciseId).filter(Boolean)));
      setSessionCount(completedCount);
    } catch {}
  };

  const persistEquipment = useCallback((updated: string[]) => {
    const safeList = updated.length > 0 ? updated : ['body weight'];
    setStoreEquipment(safeList);
    db.userProfile.toArray().then(profiles => {
      if (profiles[0]?.id) {
        db.userProfile.update(profiles[0].id, { equipment: safeList });
      }
    });
  }, [setStoreEquipment]);

  const toggleEquipment = (eq: string) => {
    const updated = selectedEquipment.includes(eq)
      ? selectedEquipment.filter(e => e !== eq)
      : [...selectedEquipment, eq];
    persistEquipment(updated);
  };

  const togglePlan = async (planId: number) => {
    if (expandedPlan === planId) {
      setExpandedPlan(null);
      return;
    }
    setExpandedPlan(planId);
    if (!planDays[planId]) {
      const days = await db.workoutDays.where('planId').equals(planId).sortBy('dayNumber');
      setPlanDays(prev => ({ ...prev, [planId]: days }));
    }
  };

  const activatePlan = async (planId: number) => {
    const all = await db.workoutPlans.toArray();
    for (const p of all) {
      if (p.id) await db.workoutPlans.update(p.id, { isActive: p.id === planId });
    }
    loadPlansAndCatalog();
  };

  const deactivatePlan = async (planId: number) => {
    await db.workoutPlans.update(planId, { isActive: false });
    loadPlansAndCatalog();
  };

  const deleteCustomPlan = async (planId: number) => {
    await db.workoutDays.where('planId').equals(planId).delete();
    await db.workoutPlans.delete(planId);
    if (expandedPlan === planId) setExpandedPlan(null);
    loadPlansAndCatalog();
  };

  const duplicatePlan = async (plan: WorkoutPlan) => {
    if (!plan.id) return;
    const days = planDays[plan.id] || await db.workoutDays.where('planId').equals(plan.id).sortBy('dayNumber');
    const newPlanId = await db.workoutPlans.add({
      ...plan,
      id: undefined,
      name: `${plan.name} (Custom)`,
      category: 'Custom',
      isCustom: true,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    for (const day of days) {
      await db.workoutDays.add({
        ...day,
        id: undefined,
        planId: newPlanId,
      } as any);
    }
    loadPlansAndCatalog();
  };

  const getDaySeed = (planId: number, dayNumber: number) => {
    const key = `${planId}_${dayNumber}`;
    const customSeed = dayVarietySeeds[key] || 0;
    return sessionCount + dayNumber * 2 + customSeed;
  };

  const shuffleDayExercises = (planId: number, dayNumber: number) => {
    const key = `${planId}_${dayNumber}`;
    setDayVarietySeeds(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };

  const previewDayExercises = useCallback((plan: WorkoutPlan, day: WorkoutDay) => {
    if (allExercises.length === 0) {
      return day.exercises.map(e => e.exerciseName);
    }
    const seed = getDaySeed(plan.id || 0, day.dayNumber);
    const resolved = resolveWorkoutDayExercises({
      dayExercises: day.exercises,
      allExercises,
      userEquipment: selectedEquipment,
      barWeight,
      dumbbellWeight,
      recentExerciseIds,
      varietySeed: seed,
      varietyLevel: exerciseVariety || 'medium',
    });
    return resolved.map(r => r.exerciseName);
  }, [allExercises, selectedEquipment, barWeight, dumbbellWeight, recentExerciseIds, exerciseVariety, sessionCount, dayVarietySeeds]);

  const startDay = async (plan: WorkoutPlan, day: WorkoutDay) => {
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

    const catalog = allExercises.length > 0 ? allExercises : await db.exercises.toArray();
    const seed = getDaySeed(plan.id || 0, day.dayNumber);

    const exercises = resolveWorkoutDayExercises({
      dayExercises: day.exercises,
      allExercises: catalog,
      userEquipment: selectedEquipment,
      barWeight,
      dumbbellWeight,
      savedSwaps,
      recentExerciseIds,
      varietySeed: seed,
      varietyLevel: exerciseVariety || 'medium',
    });

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

  const availableExerciseCount = useMemo(() => {
    if (allExercises.length === 0) return 0;
    return allExercises.filter(e => matchesUserEquipment(e, selectedEquipment)).length;
  }, [allExercises, selectedEquipment]);

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
              <span className="gradient-text">Workout Plans</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              {plans.length} programs • {availableExerciseCount.toLocaleString()} exercises match your equipment
            </p>
          </div>
          <button
            onClick={() => setShowSmartGenerator(true)}
            className="btn-secondary"
            style={{ padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, border: '1px solid var(--accent-purple)' }}
          >
            <Sparkles size={14} color="var(--accent-purple)" /> Generate
          </button>
        </div>
      </motion.div>

      {/* Equipment Setup + Variety Control */}
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
              <div style={{ fontSize: 14, fontWeight: 700 }}>My Equipment & Variety</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {selectedEquipment.length} selected ({selectedEquipment.slice(0, 3).join(', ')}{selectedEquipment.length > 3 ? '...' : ''}) • Variety: {exerciseVariety || 'medium'}
              </div>
            </div>
          </div>
          {showEquipment ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </button>

        <AnimatePresence>
          {showEquipment && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div className="card" style={{ marginTop: 8, padding: 14 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>Quick Equipment Presets</div>
                <div className="chip-scroll" style={{ marginBottom: 12 }}>
                  {EQUIPMENT_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      className="filter-chip"
                      onClick={() => persistEquipment(preset.items)}
                      style={{ fontSize: 11, padding: '6px 12px' }}
                    >
                      <span>{preset.icon}</span> {preset.label}
                    </button>
                  ))}
                </div>

                <div className="section-label" style={{ marginBottom: 8 }}>Available Equipment (Strict Filter)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 12 }}>
                  {ALL_EQUIPMENT.map(eq => (
                    <button key={eq} className={`equipment-check ${selectedEquipment.includes(eq) ? 'selected' : ''}`} onClick={() => toggleEquipment(eq)}>
                      <div className="equipment-check-box">
                        {selectedEquipment.includes(eq) && <Check size={12} color="white" />}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{eq}</span>
                    </button>
                  ))}
                </div>

                <div className="section-label" style={{ marginBottom: 8 }}>Exercise Variety Mode</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {([
                    { id: 'low' as const, label: 'Consistent', desc: 'Stick to core lifts' },
                    { id: 'medium' as const, label: 'Balanced', desc: 'Rotate accessories' },
                    { id: 'high' as const, label: 'High Variety', desc: 'Max exercise mix' },
                  ]).map(v => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setField('exerciseVariety', v.id);
                        db.userProfile.toArray().then(p => {
                          if (p[0]?.id) db.userProfile.update(p[0].id, { exerciseVariety: v.id });
                        });
                      }}
                      style={{
                        padding: '10px 6px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                        background: (exerciseVariety || 'medium') === v.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                        border: (exerciseVariety || 'medium') === v.id ? 'none' : '1px solid var(--border)',
                        color: (exerciseVariety || 'medium') === v.id ? 'white' : 'var(--text-secondary)',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{v.label}</div>
                      <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{v.desc}</div>
                    </button>
                  ))}
                </div>
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
                        {days.map((day, j) => {
                          const resolvedNames = previewDayExercises(plan, day);
                          return (
                            <div key={day.id} style={{ padding: '12px 0', borderBottom: j < days.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--gradient-fire)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'white', flexShrink: 0 }}>
                                    D{day.dayNumber}
                                  </div>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>{day.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                      {day.exercises.length} exercises • Equipment-matched
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    onClick={() => shuffleDayExercises(plan.id!, day.dayNumber)}
                                    title="Vary exercises from catalog"
                                    style={{
                                      background: 'var(--bg-glass)', border: '1px solid var(--border-bright)', color: 'var(--text-secondary)',
                                      borderRadius: 12, padding: '10px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', gap: 4, minHeight: 42,
                                    }}
                                  >
                                    <Shuffle size={13} /> Vary
                                  </button>
                                  <motion.button
                                    whileTap={{ scale: 0.93 }}
                                    onClick={() => startDay(plan, day)}
                                    style={{
                                      background: 'var(--gradient-fire)', border: 'none', color: 'white', borderRadius: 12,
                                      padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                      boxShadow: '0 4px 16px var(--glow-red)', display: 'flex', alignItems: 'center', gap: 6,
                                      minHeight: 42,
                                    }}>
                                    <Play size={14} fill="white" /> Start
                                  </motion.button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, paddingLeft: 48 }}>
                                {resolvedNames.map((exName, idx) => (
                                  <span key={idx} style={{
                                    fontSize: 10, padding: '3px 8px', borderRadius: 6,
                                    background: 'var(--bg-glass)', border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)', textTransform: 'capitalize',
                                  }}>
                                    {exName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                          {!plan.isActive ? (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => activatePlan(plan.id!)}
                              style={{
                                flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '12px 16px', borderRadius: 14, minHeight: 46,
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
                                flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '12px 16px', borderRadius: 14, minHeight: 46,
                                background: 'rgba(255,61,90,0.06)', border: '1px solid rgba(255,61,90,0.2)',
                                color: 'var(--accent-red)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              }}>
                              <XCircle size={14} /> Remove Active
                            </motion.button>
                          )}
                          <button
                            onClick={() => duplicatePlan(plan)}
                            className="btn-secondary"
                            style={{ padding: '10px 14px', borderRadius: 14, minHeight: 46, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                            title="Clone this plan to customize"
                          >
                            <Copy size={13} /> Clone
                          </button>
                          {plan.isCustom && (
                            <button
                              onClick={() => deleteCustomPlan(plan.id!)}
                              className="btn-cancel"
                              style={{ padding: '10px 14px', borderRadius: 14, minHeight: 46, fontSize: 12 }}
                              title="Delete custom plan"
                            >
                              <Trash2 size={14} />
                            </button>
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

      {/* Action Buttons */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => setShowSmartGenerator(true)} className="btn-secondary" style={{ borderRadius: 16, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid var(--accent-purple)' }}>
          <Sparkles size={18} color="var(--accent-purple)" /> Smart Workout Generator (2,200+ Exercises)
        </button>
        <button onClick={() => setShowBuilder(true)} className="btn-primary" style={{ borderRadius: 16, minHeight: 52 }}>
          <Plus size={18} /> Create Custom Plan
        </button>
      </motion.div>

      <AnimatePresence>
        {showBuilder && <CustomPlanBuilder onClose={() => { setShowBuilder(false); loadPlansAndCatalog(); }} equipment={selectedEquipment} />}
      </AnimatePresence>

      <AnimatePresence>
        {showSmartGenerator && (
          <SmartWorkoutGeneratorModal
            onClose={() => { setShowSmartGenerator(false); loadPlansAndCatalog(); }}
            equipment={selectedEquipment}
            allExercises={allExercises}
            recentExerciseIds={recentExerciseIds}
            barWeight={barWeight}
            dumbbellWeight={dumbbellWeight}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ===== SMART WORKOUT GENERATOR MODAL ===== */
function SmartWorkoutGeneratorModal({
  onClose,
  equipment,
  allExercises,
  recentExerciseIds,
  barWeight,
  dumbbellWeight,
}: {
  onClose: () => void;
  equipment: string[];
  allExercises: Exercise[];
  recentExerciseIds: Set<number>;
  barWeight: number;
  dumbbellWeight: number;
}) {
  const { startWorkout } = useWorkoutStore();
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>(['chest', 'back', 'shoulders']);
  const [exerciseCount, setExerciseCount] = useState(6);
  const [setsCount, setSetsCount] = useState(3);
  const [repsCount, setRepsCount] = useState(10);
  const [seed, setSeed] = useState(() => Date.now());
  const [saveName, setSaveName] = useState('');

  const MUSCLE_CHOICES = [
    'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms', 'traps',
  ];

  const toggleMuscle = (m: string) => {
    setSelectedMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const generatedList = useMemo(() => {
    return generateSmartWorkout({
      targetMuscles: selectedMuscles,
      exerciseCount,
      setsPerExercise: setsCount,
      repsPerSet: repsCount,
      allExercises,
      userEquipment: equipment,
      recentExerciseIds,
      seed,
    });
  }, [selectedMuscles, exerciseCount, setsCount, repsCount, allExercises, equipment, recentExerciseIds, seed]);

  const handleStartNow = () => {
    const dayExercises = generatedList.map((item, i) => ({
      exerciseId: 0,
      exerciseName: item.name,
      sets: item.sets,
      reps: item.reps,
      restTime: 90,
      setType: 'normal' as any,
      order: i,
    }));
    const resolved = resolveWorkoutDayExercises({
      dayExercises,
      allExercises,
      userEquipment: equipment,
      barWeight,
      dumbbellWeight,
      recentExerciseIds,
      varietySeed: 0,
      varietyLevel: 'low',
    });
    startWorkout('Smart Workout', `${selectedMuscles.slice(0, 2).join(' + ').toUpperCase()} Session`, resolved);
    onClose();
  };

  const handleSaveAsPlan = async () => {
    const name = saveName.trim() || `Smart ${selectedMuscles.slice(0, 2).join('/')} Plan`;
    const planId = await db.workoutPlans.add({
      name,
      description: `Generated for ${equipment.slice(0, 3).join(', ')} (${selectedMuscles.join(', ')})`,
      category: 'Custom',
      difficulty: 'intermediate',
      daysPerWeek: 3,
      isCustom: true,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await db.workoutDays.add({
      planId,
      dayNumber: 1,
      name: 'Generated Session',
      exercises: generatedList.map((ex, i) => ({
        exerciseId: 0,
        exerciseName: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        restTime: 90,
        setType: 'normal',
        order: i,
      })),
    } as any);
    onClose();
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} style={{ maxHeight: '92dvh' }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 800 }}>✨ Smart Workout Generator</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Picks non-repeating exercises strictly matching your {equipment.length} selected equipment items.
        </p>

        <div className="section-label" style={{ marginBottom: 8 }}>Target Muscles</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {MUSCLE_CHOICES.map(m => (
            <button key={m} className={`filter-chip ${selectedMuscles.includes(m) ? 'active' : ''}`}
              onClick={() => toggleMuscle(m)} style={{ fontSize: 11, padding: '6px 12px', textTransform: 'capitalize' }}>
              {m}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>Exercises</div>
            <select value={exerciseCount} onChange={e => setExerciseCount(Number(e.target.value))}
              style={{ width: '100%', padding: 10, borderRadius: 10, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              {[4, 5, 6, 7, 8, 10].map(n => <option key={n} value={n}>{n} exercises</option>)}
            </select>
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>Sets</div>
            <select value={setsCount} onChange={e => setSetsCount(Number(e.target.value))}
              style={{ width: '100%', padding: 10, borderRadius: 10, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} sets</option>)}
            </select>
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>Reps</div>
            <select value={repsCount} onChange={e => setRepsCount(Number(e.target.value))}
              style={{ width: '100%', padding: 10, borderRadius: 10, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              {[5, 8, 10, 12, 15].map(n => <option key={n} value={n}>{n} reps</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="section-label">Generated Lineup</span>
          <button onClick={() => setSeed(Date.now() + Math.floor(Math.random() * 10000))} className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-purple)' }}>
            <Shuffle size={12} /> Reroll Exercises
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '28vh', overflowY: 'auto', marginBottom: 14 }}>
          {generatedList.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{item.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.equipment} • {item.primaryMuscle}</div>
              </div>
              <div className="font-mono" style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 700 }}>{item.sets}×{item.reps}</div>
            </div>
          ))}
        </div>

        <input
          value={saveName}
          onChange={e => setSaveName(e.target.value)}
          placeholder="Optional: plan name to save..."
          style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 13, marginBottom: 10 }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSaveAsPlan} className="btn-secondary" style={{ flex: 1, minHeight: 48, borderRadius: 14 }}>
            Save as Plan
          </button>
          <button onClick={handleStartNow} className="btn-primary" style={{ flex: 1, minHeight: 48, borderRadius: 14 }}>
            <Play size={15} fill="white" /> Start Workout
          </button>
        </div>
      </motion.div>
    </motion.div>
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
    let filtered = allExercises.filter(e => matchesUserEquipment(e, equipment));
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.primaryMuscles?.some(m => m.toLowerCase().includes(q))
      );
    }
    return filtered.slice(0, 80);
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

  const updateExerciseSetsReps = (dayIdx: number, exIdx: number, field: 'sets' | 'reps', val: number) => {
    setDays(prev => {
      const updated = [...prev];
      const list = [...updated[dayIdx].exercises];
      list[exIdx] = { ...list[exIdx], [field]: Math.max(1, val) };
      updated[dayIdx] = { ...updated[dayIdx], exercises: list };
      return updated;
    });
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

        <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Plan name..."
          style={{ width: '100%', padding: '14px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 14, color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, outline: 'none', marginBottom: 16, fontFamily: 'inherit', minHeight: 48 }} />

        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {days.map((day, i) => (
            <button key={i} className={`tab-btn ${i === currentDayIdx ? 'active' : ''}`} onClick={() => setCurrentDayIdx(i)}>
              {day.name}
            </button>
          ))}
          <button onClick={addDay} className="tab-btn" style={{ minWidth: 40 }}><Plus size={14} /></button>
        </div>

        <input value={days[currentDayIdx]?.name || ''} onChange={e => {
          setDays(prev => { const u = [...prev]; u[currentDayIdx] = { ...u[currentDayIdx], name: e.target.value }; return u; });
        }} placeholder="Day name..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 13, outline: 'none', marginBottom: 12, fontFamily: 'inherit', minHeight: 44 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {days[currentDayIdx]?.exercises.map((ex, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-glass)', borderRadius: 12, border: '1px solid var(--border)', minHeight: 48 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{ex.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={ex.sets}
                  onChange={e => updateExerciseSetsReps(currentDayIdx, i, 'sets', Number(e.target.value) || 3)}
                  style={{ width: 42, padding: '4px 6px', textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}
                  title="Sets"
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>×</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={ex.reps}
                  onChange={e => updateExerciseSetsReps(currentDayIdx, i, 'reps', Number(e.target.value) || 10)}
                  style={{ width: 46, padding: '4px 6px', textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}
                  title="Reps"
                />
              </div>
              <button onClick={() => removeExercise(currentDayIdx, i)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
            </div>
          ))}
        </div>

        <button onClick={() => setShowExercisePicker(true)} className="btn-secondary" style={{ width: '100%', marginBottom: 16, minHeight: 48, borderRadius: 14 }}>
          <Plus size={14} /> Add Exercise (Filtered to Your Equipment)
        </button>

        <button onClick={savePlan} className="btn-primary" style={{ borderRadius: 14, minHeight: 52 }} disabled={!planName.trim() || days.every(d => d.exercises.length === 0)}>
          Save Plan
        </button>

        <AnimatePresence>
          {showExercisePicker && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'var(--bg-sheet)', borderRadius: 'var(--r-2xl) var(--r-2xl) 0 0', padding: 20, zIndex: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>Pick Exercise ({filteredExercises.length} match equipment)</h3>
                <button onClick={() => setShowExercisePicker(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              </div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="search-bar" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or muscle..." style={{ paddingLeft: 36 }} />
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
