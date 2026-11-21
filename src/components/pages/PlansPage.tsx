'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, ChevronUp, Target, Plus, X, Check, Settings, Search, Play, XCircle, Shuffle, Sparkles, Trash2, Copy, Scale, Dumbbell, ClipboardList } from 'lucide-react';
import { useUIStore } from '@/lib/store/uiStore';
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
  analyzePlanMuscleBalance,
  type PlanMuscleBalanceSummary,
} from '@/lib/utils/exerciseResolver';
import ExerciseMedia from '@/components/ui/ExerciseMedia';
import CustomSelect, { ChipScrollBar } from '@/components/ui/CustomSelect';

const CATEGORY_COLORS: Record<string, string> = {
  Hypertrophy: 'var(--accent-purple)',
  Calisthenics: 'var(--accent-green)',
  Strength: 'var(--accent-blue)',
  Powerlifting: 'var(--accent-red)',
  Athletic: 'var(--accent-cyan)',
  Cardio: 'var(--accent-orange)',
  Bodyweight: 'var(--accent-lime)',
  Mobility: 'var(--accent-cyan)',
  Custom: 'var(--accent-pink)',
};

const DIFFICULTY_LABELS: Record<string, { color: string; bg: string }> = {
  beginner: { color: 'var(--accent-green)', bg: 'color-mix(in srgb, var(--accent-green) 8%, transparent)' },
  intermediate: { color: 'var(--accent-yellow)', bg: 'color-mix(in srgb, var(--accent-yellow) 8%, transparent)' },
  expert: { color: 'var(--accent-red)', bg: 'color-mix(in srgb, var(--accent-red) 8%, transparent)' },
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
  const { setActiveTab } = useUIStore();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [allSwaps, setAllSwaps] = useState<Record<string, Record<string, { newExerciseId: number; newExerciseName: string; newGifUrl?: string }>>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
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
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  const selectedEquipment = useMemo(
    () => (userEquipment && userEquipment.length > 0 ? userEquipment : [...ALL_EQUIPMENT]),
    [userEquipment]
  );

  useEffect(() => {
    loadPlansAndCatalog();
  }, []);

  const loadPlansAndCatalog = async () => {
    try {
      const [allPlans, allDays, catalog, recentSets, completedCount, swapsList] = await Promise.all([
        db.workoutPlans.toArray(),
        db.workoutDays.toArray(),
        db.exercises.toArray(),
        db.sets.orderBy('completedAt').reverse().limit(120).toArray(),
        db.workoutSessions.filter(s => s.isComplete).count(),
        db.exerciseSwaps.toArray(),
      ]);
      const swapsMap: Record<string, Record<string, { newExerciseId: number; newExerciseName: string; newGifUrl?: string }>> = {};
      for (const sw of swapsList) {
        const key = `${sw.planName}::${sw.dayName}`;
        if (!swapsMap[key]) swapsMap[key] = {};
        swapsMap[key][sw.originalExerciseName.toLowerCase()] = {
          newExerciseId: sw.newExerciseId,
          newExerciseName: sw.newExerciseName,
          newGifUrl: sw.newGifUrl,
        };
      }
      setAllSwaps(swapsMap);
      const daysByPlan: Record<number, WorkoutDay[]> = {};
      for (const d of allDays) {
        if (!daysByPlan[d.planId]) daysByPlan[d.planId] = [];
        daysByPlan[d.planId].push(d);
      }
      for (const pid of Object.keys(daysByPlan)) {
        daysByPlan[Number(pid)].sort((a, b) => a.dayNumber - b.dayNumber);
      }
      setPlans(allPlans);
      setPlanDays(daysByPlan);
      setAllExercises(catalog);
      setRecentExerciseIds(new Set(recentSets.map(s => s.exerciseId).filter(Boolean)));
      setSessionCount(completedCount);
    } catch {} finally {
      setIsLoadingPlans(false);
    }
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
    await db.transaction('rw', db.workoutPlans, async () => {
      const all = await db.workoutPlans.toArray();
      for (const p of all) {
        if (p.id) await db.workoutPlans.update(p.id, { isActive: p.id === planId });
      }
    });
    loadPlansAndCatalog();
  };

  const deactivatePlan = async (planId: number) => {
    await db.workoutPlans.update(planId, { isActive: false });
    loadPlansAndCatalog();
  };

  const deleteCustomPlan = async (planId: number) => {
    const planObj = plans.find(p => p.id === planId);
    if (planObj?.name) {
      await db.exerciseSwaps.where('planName').equals(planObj.name).delete();
    }
    await db.workoutDays.where('planId').equals(planId).delete();
    await db.workoutPlans.delete(planId);
    setConfirmDeleteId(null);
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
    const customVary = dayVarietySeeds[`${plan.id || 0}_${day.dayNumber}`] || 0;
    const savedSwapsForDay = allSwaps[`${plan.name}::${day.name}`] || {};
    const hasSwaps = Object.keys(savedSwapsForDay).length > 0;
    const seed = hasSwaps && customVary === 0 ? 0 : getDaySeed(plan.id || 0, day.dayNumber);
    const resolved = resolveWorkoutDayExercises({
      dayExercises: day.exercises,
      allExercises,
      userEquipment: selectedEquipment,
      barWeight,
      dumbbellWeight,
      savedSwaps: savedSwapsForDay,
      recentExerciseIds,
      varietySeed: seed,
      varietyLevel: exerciseVariety || 'medium',
    });
    return resolved.map(r => r.exerciseName);
  }, [allExercises, selectedEquipment, barWeight, dumbbellWeight, recentExerciseIds, exerciseVariety, sessionCount, dayVarietySeeds, allSwaps]);

  const startDay = async (plan: WorkoutPlan, day: WorkoutDay) => {
    const savedSwaps: Record<string, { newExerciseId: number; newExerciseName: string; newGifUrl?: string }> = {};
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
    const customVary = dayVarietySeeds[`${plan.id || 0}_${day.dayNumber}`] || 0;
    const seed = Object.keys(savedSwaps).length > 0 && customVary === 0 ? 0 : getDaySeed(plan.id || 0, day.dayNumber);

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

  const balanceByPlanId = useMemo(() => {
    const map: Record<number, PlanMuscleBalanceSummary> = {};
    for (const p of plans) {
      if (p.id && planDays[p.id]?.length) {
        map[p.id] = analyzePlanMuscleBalance(planDays[p.id], allExercises);
      }
    }
    return map;
  }, [plans, planDays, allExercises]);

  const availableExerciseCount = useMemo(() => {
    if (allExercises.length === 0) return 0;
    return allExercises.filter(e => matchesUserEquipment(e, selectedEquipment)).length;
  }, [allExercises, selectedEquipment]);

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
          <div
            className="icon-badge"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--accent-red) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-red) 28%, transparent)',
              flexShrink: 0,
            }}
          >
            <ClipboardList size={18} color="var(--accent-red)" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="font-display" style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, whiteSpace: 'nowrap' }}>
              <span className="gradient-text">Workout Plans</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isLoadingPlans
                ? 'Loading balanced programs...'
                : `${plans.length} programs • ${availableExerciseCount.toLocaleString()} exercises matched`}
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTab('exercises')}
            className="btn-secondary"
            title="Browse full Exercise Library"
            style={{ padding: '9px 12px', minHeight: 40, borderRadius: 12, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid var(--border-subtle)' }}
          >
            <Dumbbell size={14} color="var(--accent-green)" /> Exercise Library
          </button>
          <button
            type="button"
            onClick={() => setShowSmartGenerator(true)}
            className="btn-secondary"
            style={{ padding: '9px 12px', minHeight: 40, borderRadius: 12, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid color-mix(in srgb, var(--accent-purple) 45%, transparent)' }}
          >
            <Sparkles size={14} color="var(--accent-purple)" /> Smart Generate
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
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-green) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 28%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Settings size={16} color="var(--accent-green)" />
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
                <ChipScrollBar
                  dropdownTitle="Equipment Presets"
                  ariaLabel="Quick equipment presets"
                  style={{ marginBottom: 10 }}
                  chipStyle={{ fontSize: 11, padding: '6px 11px', minHeight: 32 }}
                  items={EQUIPMENT_PRESETS.map(preset => ({
                    id: preset.id,
                    label: preset.label,
                    icon: <span>{preset.icon}</span>,
                    onClick: () => persistEquipment(preset.items),
                  }))}
                />

                <div className="section-label" style={{ marginBottom: 8 }}>Available Equipment (Strict Filter)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 12 }}>
                  {ALL_EQUIPMENT.map(eq => (
                    <button key={eq} className={`equipment-check ${selectedEquipment.includes(eq) ? 'selected' : ''}`} onClick={() => toggleEquipment(eq)}>
                      <div className="equipment-check-box">
                        {selectedEquipment.includes(eq) && <Check size={12} color="white" />}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-secondary)', textAlign: 'left', flex: 1, minWidth: 0, lineHeight: 1.25 }}>{eq}</span>
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
                        color: (exerciseVariety || 'medium') === v.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
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
      <ChipScrollBar
        dropdownTitle="Program Categories"
        ariaLabel="Filter plans by category"
        items={categories.map(cat => ({
          id: cat,
          label: cat === 'all' ? 'All' : cat,
          isActive: categoryFilter === cat,
          onClick: () => setCategoryFilter(cat),
        }))}
      />

      {/* Plans List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredPlans.map((plan, i) => {
          const isExpanded = expandedPlan === plan.id;
          const days = planDays[plan.id!] || [];
          const catColor = CATEGORY_COLORS[plan.category] || 'var(--accent-purple)';
          const diff = DIFFICULTY_LABELS[plan.difficulty] || DIFFICULTY_LABELS.intermediate;
          const balance = plan.id ? balanceByPlanId[plan.id] || null : null;

          return (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}>
              <div
                className="card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  border: plan.isActive
                    ? '1.5px solid color-mix(in srgb, var(--accent-green) 45%, transparent)'
                    : '1px solid var(--border-subtle)',
                  boxShadow: plan.isActive
                    ? '0 10px 30px rgba(0, 0, 0, 0.35), 0 0 20px color-mix(in srgb, var(--accent-green) 8%, transparent)'
                    : undefined,
                }}
              >
                {plan.isActive && (
                  <div style={{ padding: '8px 10px 0' }}>
                    <div
                      style={{
                        padding: '5px 11px',
                        borderRadius: 10,
                        background: 'linear-gradient(90deg, color-mix(in srgb, var(--accent-green) 16%, transparent), color-mix(in srgb, var(--accent-green) 5%, transparent))',
                        border: '1px solid color-mix(in srgb, var(--accent-green) 22%, transparent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 6px var(--accent-green)', animation: 'pulse-dot 2.2s ease-in-out infinite', flexShrink: 0 }} />
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.55, color: 'var(--accent-green)', textTransform: 'uppercase' }}>
                        Active Program
                      </span>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => togglePlan(plan.id!)}
                  style={{
                    width: '100%',
                    padding: '11px 13px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    background: plan.isActive
                      ? 'radial-gradient(ellipse 90% 60% at 50% 0%, color-mix(in srgb, var(--accent-green) 7%, transparent), transparent 75%)'
                      : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                  }}
                >
                  {/* Top Metadata Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minWidth: 0 }}>

                      <span
                        className="badge"
                        style={{
                          background: `color-mix(in srgb, ${catColor} 14%, transparent)`,
                          color: catColor,
                          border: `1px solid color-mix(in srgb, ${catColor} 28%, transparent)`,
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 7px',
                        }}
                      >
                        {plan.category}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: diff.bg,
                          color: diff.color,
                          border: `1px solid color-mix(in srgb, ${diff.color} 25%, transparent)`,
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 7px',
                          textTransform: 'capitalize',
                        }}
                      >
                        ★ {plan.difficulty}
                      </span>
                    </div>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        background: isExpanded ? 'color-mix(in srgb, var(--accent-purple) 18%, transparent)' : 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex' }}>
                        <ChevronRight size={14} color={isExpanded ? 'var(--accent-purple)' : 'var(--text-secondary)'} />
                      </motion.div>
                    </div>
                  </div>

                  {/* Plan Title & Compact Description */}
                  <div className="font-display" style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.015em', lineHeight: 1.2 }}>
                    {plan.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.35,
                      marginBottom: 8,
                      ...(!isExpanded
                        ? {
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }
                        : {}),
                    }}
                  >
                    {plan.description}
                  </div>

                  {/* Compact 3-Column Program Telemetry Strip */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 5,
                      marginBottom: balance ? 7 : 0,
                    }}
                  >
                    <div style={{ padding: '5px 7px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Days</span>
                      <span className="font-mono" style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {plan.daysPerWeek}d/wk
                      </span>
                    </div>
                    <div style={{ padding: '5px 7px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Vol</span>
                      <span className="font-mono" style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent-cyan)', whiteSpace: 'nowrap' }}>
                        {balance ? `${balance.totalSets} sets` : `${days.length || plan.daysPerWeek}d`}
                      </span>
                    </div>
                    <div style={{ padding: '5px 7px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Sym</span>
                      <span className="font-mono" style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent-green)', whiteSpace: 'nowrap' }}>
                        {balance ? `${balance.balanceScore}%` : 'Bal'}
                      </span>
                    </div>
                  </div>

                  {/* Compact Visual Body-Part Balance Bar */}
                  {balance && (
                    <div style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-subtle-fill)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-track)', gap: 2 }}>
                        {balance.categories.filter(c => c.sets > 0).map(c => (
                          <div key={c.id} style={{ flex: c.sets, background: c.color, borderRadius: 999 }} title={`${c.label}: ${c.percentage}%`} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '3px 8px', flexWrap: 'wrap', marginTop: 4 }}>
                        {balance.categories.filter(c => c.sets > 0).map(c => (
                          <span key={c.id} style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                            {c.label} <strong style={{ color: 'var(--text-primary)' }}>{c.percentage}%</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden', borderTop: '1px solid var(--border-subtle)', background: 'color-mix(in srgb, var(--bg-primary) 45%, transparent)' }}>
                      <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {days.map((day) => {
                          const resolvedNames = previewDayExercises(plan, day);
                          return (
                            <div
                              key={day.id}
                              style={{
                                padding: '13px',
                                borderRadius: 14,
                                background: 'color-mix(in srgb, var(--bg-elevated) 70%, transparent)',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                  <div className="day-badge">
                                    <span className="day-badge__eyebrow">DAY</span>
                                    <span className="day-badge__num">{String(day.dayNumber).padStart(2, '0')}</span>
                                  </div>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.25 }}>{day.name}</div>
                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                      {day.exercises.length} exercises • GIF &amp; equipment matched
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => shuffleDayExercises(plan.id!, day.dayNumber)}
                                  title="Vary exercises from catalog"
                                  style={{
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-bright)',
                                    color: 'var(--text-secondary)',
                                    borderRadius: 9,
                                    padding: '6px 10px',
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Shuffle size={11} color="var(--accent-purple)" /> Vary
                                </button>
                              </div>

                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 11 }}>
                                {resolvedNames.map((exName, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: 10.5,
                                      padding: '4px 9px',
                                      borderRadius: 8,
                                      background: 'var(--bg-input)',
                                      border: '1px solid var(--border-subtle)',
                                      color: 'var(--text-primary)',
                                      textTransform: 'capitalize',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      fontWeight: 600,
                                    }}
                                  >
                                    <span className="font-mono" style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent-purple)' }}>
                                      {idx + 1}.
                                    </span>
                                    {exName}
                                  </span>
                                ))}
                              </div>

                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.97 }}
                                onClick={() => startDay(plan, day)}
                                className="btn-primary"
                                style={{
                                  borderRadius: 11,
                                  padding: '10px 16px',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  minHeight: 40,
                                  textTransform: 'none',
                                  letterSpacing: 0.2,
                                }}
                              >
                                <Play size={13} fill="currentColor" /> Start Day {day.dayNumber}
                              </motion.button>
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
                                background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)',
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
                                background: 'color-mix(in srgb, var(--accent-red) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)',
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
                            confirmDeleteId === plan.id ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  onClick={() => deleteCustomPlan(plan.id!)}
                                  className="btn-cancel"
                                  style={{ padding: '10px 12px', borderRadius: 14, minHeight: 46, fontSize: 11, fontWeight: 800 }}
                                >
                                  Confirm Delete
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="btn-secondary"
                                  style={{ padding: '10px 10px', borderRadius: 14, minHeight: 46, fontSize: 11 }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(plan.id!)}
                                className="btn-cancel"
                                aria-label={`Delete custom plan ${plan.name}`}
                                style={{ padding: '10px 14px', borderRadius: 14, minHeight: 46, fontSize: 12 }}
                                title="Delete custom plan"
                              >
                                <Trash2 size={14} />
                              </button>
                            )
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
          <Sparkles size={18} color="var(--accent-purple)" /> Smart Balanced Workout Generator
        </button>
        <button onClick={() => setShowBuilder(true)} className="btn-primary" style={{ borderRadius: 16, minHeight: 52 }}>
          <Plus size={18} /> Create Custom Plan
        </button>
      </motion.div>

      <AnimatePresence>
        {showBuilder && (
          <CustomPlanBuilder
            onClose={() => { setShowBuilder(false); loadPlansAndCatalog(); }}
            equipment={selectedEquipment}
            allExercises={allExercises}
          />
        )}
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
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>(['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'biceps', 'triceps', 'abs']);
  const [exerciseCount, setExerciseCount] = useState(6);
  const [setsCount, setSetsCount] = useState(3);
  const [repsCount, setRepsCount] = useState(10);
  const [seed, setSeed] = useState(() => Date.now());
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const MUSCLE_CHOICES = [
    'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms', 'traps',
  ];

  const SPLIT_PRESETS = [
    { label: 'Full Body Balance', muscles: ['quads', 'hamstrings', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'abs'] },
    { label: 'Calisthenics Skill & Bar', muscles: ['back', 'chest', 'shoulders', 'triceps', 'biceps', 'abs', 'quads'] },
    { label: 'Push (Chest/Delts/Tri)', muscles: ['chest', 'shoulders', 'triceps'] },
    { label: 'Pull (Back/Traps/Bi)', muscles: ['back', 'traps', 'biceps', 'forearms'] },
    { label: 'Legs & Core', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
    { label: 'Upper Body Symmetry', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
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
    await db.transaction('rw', [db.workoutPlans, db.workoutDays], async () => {
      const planId = await db.workoutPlans.add({
        name,
        description: `Balanced smart plan for ${equipment.slice(0, 3).join(', ')} (${selectedMuscles.join(', ')})`,
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
        name: 'Balanced Session',
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
    });
    onClose();
  };

  return (
    <motion.div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Smart Balanced Generator"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} style={{ maxHeight: '92dvh' }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 800 }}>✨ Smart Balanced Generator</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Balances compound & isolation movements across target muscles using GIF-backed exercises for your {equipment.length} selected equipment items.
        </p>

        <div className="section-label" style={{ marginBottom: 6 }}>Balanced Split Presets</div>
        <ChipScrollBar
          dropdownTitle="Balanced Split Presets"
          ariaLabel="Balanced split presets"
          style={{ marginBottom: 12 }}
          chipStyle={{ fontSize: 10.5, padding: '5px 11px', minHeight: 31 }}
          items={SPLIT_PRESETS.map(p => {
            const isMatched =
              p.muscles.length === selectedMuscles.length &&
              p.muscles.every(m => selectedMuscles.includes(m));
            return {
              id: p.label,
              label: p.label,
              icon: <Scale size={11} />,
              isActive: isMatched,
              onClick: () => setSelectedMuscles([...p.muscles]),
            };
          })}
        />

        <div className="section-label" style={{ marginBottom: 6 }}>Target Muscles</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {MUSCLE_CHOICES.map(m => (
            <button key={m} className={`filter-chip ${selectedMuscles.includes(m) ? 'active' : ''}`}
              onClick={() => toggleMuscle(m)} style={{ fontSize: 10, padding: '4px 9px', minHeight: 27, textTransform: 'capitalize' }}>
              {m}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>Exercises</div>
            <CustomSelect
              compact
              ariaLabel="Number of exercises"
              value={exerciseCount}
              onChange={(val) => setExerciseCount(Number(val))}
              options={[4, 5, 6, 7, 8, 10].map((n) => ({ value: n, label: `${n} exercises` }))}
            />
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>Sets</div>
            <CustomSelect
              compact
              ariaLabel="Sets per exercise"
              value={setsCount}
              onChange={(val) => setSetsCount(Number(val))}
              options={[2, 3, 4, 5].map((n) => ({ value: n, label: `${n} sets` }))}
            />
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>Reps</div>
            <CustomSelect
              compact
              ariaLabel="Reps per set"
              value={repsCount}
              onChange={(val) => setRepsCount(Number(val))}
              options={[5, 8, 10, 12, 15].map((n) => ({ value: n, label: `${n} reps` }))}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="section-label">Generated Lineup</span>
          <button onClick={() => setSeed(Date.now() + Math.floor(Math.random() * 10000))} className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-purple)' }}>
            <Shuffle size={12} /> Reroll Exercises
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '26vh', overflowY: 'auto', marginBottom: 14 }}>
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
          style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12, marginBottom: 8 }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSaveAsPlan} className="btn-secondary" style={{ flex: 1, minHeight: 40, padding: '8px 10px', borderRadius: 11, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
            Save as Plan
          </button>
          <button onClick={handleStartNow} className="btn-primary" style={{ flex: 1, minHeight: 40, padding: '8px 10px', borderRadius: 11, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            <Play size={13} fill="currentColor" /> Start Workout
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ===== CUSTOM PLAN BUILDER ===== */
function CustomPlanBuilder({
  onClose,
  equipment,
  allExercises: initialExercises,
}: {
  onClose: () => void;
  equipment: string[];
  allExercises?: Exercise[];
}) {
  const [planName, setPlanName] = useState('');
  const [days, setDays] = useState<{ name: string; exercises: { name: string; sets: number; reps: number }[] }[]>([{ name: 'Day 1', exercises: [] }]);
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [search, setSearch] = useState('');
  const [pickerEquip, setPickerEquip] = useState<string>('my_gear');
  const [allExercises, setAllExercises] = useState<Exercise[]>(initialExercises || []);

  useEffect(() => {
    if (initialExercises && initialExercises.length > 0) {
      setAllExercises(initialExercises);
    } else {
      db.exercises.toArray().then(setAllExercises);
    }
  }, [initialExercises]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showExercisePicker) setShowExercisePicker(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showExercisePicker]);

  const pickerEquipOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ex of allExercises) {
      const eq = (ex.equipment || 'body weight').trim().toLowerCase();
      counts.set(eq, (counts.get(eq) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([eq]) => eq);
  }, [allExercises]);

  const filteredExercises = useMemo(() => {
    let list = allExercises;
    if (pickerEquip === 'my_gear') {
      list = list.filter(e => matchesUserEquipment(e, equipment));
    } else if (pickerEquip !== 'all') {
      list = list.filter(e => (e.equipment || 'body weight').trim().toLowerCase() === pickerEquip);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list.filter(e => {
        const hay = `${e.name} ${e.equipment || ''} ${(e.primaryMuscles || []).join(' ')} ${(e.secondaryMuscles || []).join(' ')}`.toLowerCase();
        return tokens.every(tok => hay.includes(tok));
      });
    }
    return list.slice(0, 80);
  }, [allExercises, equipment, pickerEquip, search]);

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

  const autoBalanceDay = () => {
    const generated = generateSmartWorkout({
      targetMuscles: ['quads', 'hamstrings', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'abs'],
      exerciseCount: 6,
      setsPerExercise: 3,
      repsPerSet: 10,
      allExercises,
      userEquipment: equipment,
      seed: Date.now(),
    });
    setDays(prev => {
      const updated = [...prev];
      updated[currentDayIdx] = {
        ...updated[currentDayIdx],
        exercises: generated.map(g => ({ name: g.name, sets: g.sets, reps: g.reps })),
      };
      return updated;
    });
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

  const removeDay = (dayIdx: number) => {
    if (days.length <= 1) return;
    setDays(prev => prev.filter((_, i) => i !== dayIdx));
    setCurrentDayIdx(prev => Math.max(0, Math.min(prev, days.length - 2)));
  };

  const savePlan = async () => {
    if (!planName.trim()) return;
    const validDays = days.filter(d => d.exercises.length > 0);
    if (validDays.length === 0) return;
    await db.transaction('rw', [db.workoutPlans, db.workoutDays], async () => {
      const planId = await db.workoutPlans.add({
        name: planName.trim(), description: 'Custom balanced workout plan', category: 'Custom',
        difficulty: 'intermediate', daysPerWeek: validDays.length, isCustom: true,
        isActive: false, createdAt: new Date(), updatedAt: new Date(),
      } as any);
      for (let i = 0; i < validDays.length; i++) {
        const day = validDays[i];
        await db.workoutDays.add({
          planId, dayNumber: i + 1, name: day.name,
          exercises: day.exercises.map((ex, idx) => ({
            exerciseId: 0, exerciseName: ex.name, sets: ex.sets, reps: ex.reps,
            restTime: 90, setType: 'normal', order: idx,
          })),
        } as any);
      }
    });
    onClose();
  };

  return (
    <motion.div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Create Custom Plan"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} style={{ maxHeight: '92dvh' }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 800 }}>Create Custom Plan</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Plan name..."
          style={{ width: '100%', padding: '14px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 14, color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, outline: 'none', marginBottom: 16, fontFamily: 'inherit', minHeight: 48 }} />

        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {days.map((day, i) => (
            <button key={i} className={`tab-btn ${i === currentDayIdx ? 'active' : ''}`} onClick={() => setCurrentDayIdx(i)}>
              {day.name}
            </button>
          ))}
          <button onClick={addDay} aria-label="Add day" className="tab-btn" style={{ minWidth: 40 }}><Plus size={14} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input value={days[currentDayIdx]?.name || ''} onChange={e => {
            setDays(prev => { const u = [...prev]; u[currentDayIdx] = { ...u[currentDayIdx], name: e.target.value }; return u; });
          }} placeholder="Day name..." style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit', minHeight: 44 }} />
          {days.length > 1 && (
            <button
              type="button"
              onClick={() => removeDay(currentDayIdx)}
              className="btn-cancel"
              aria-label="Delete Day"
              style={{ padding: '10px 12px', borderRadius: 12, minHeight: 44, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
            >
              <Trash2 size={14} /> Delete Day
            </button>
          )}
        </div>

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
              <button onClick={() => removeExercise(currentDayIdx, i)} aria-label={`Remove ${ex.name}`} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowExercisePicker(true)}
            className="btn-secondary"
            style={{
              minHeight: 42,
              padding: '8px 10px',
              borderRadius: 12,
              fontSize: 11.5,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={14} style={{ flexShrink: 0 }} /> Add Exercise
          </button>
          <button
            type="button"
            onClick={autoBalanceDay}
            className="btn-secondary"
            style={{
              minHeight: 42,
              padding: '8px 10px',
              borderRadius: 12,
              fontSize: 11.5,
              fontWeight: 700,
              borderColor: 'var(--accent-purple)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            }}
          >
            <Sparkles size={14} color="var(--accent-purple)" style={{ flexShrink: 0 }} /> Auto-Fill Day
          </button>
        </div>

        <button onClick={savePlan} className="btn-primary" style={{ borderRadius: 14, minHeight: 52 }} disabled={!planName.trim() || days.every(d => d.exercises.length === 0)}>
          {!planName.trim() ? 'Enter a Plan Name to Save' : days.every(d => d.exercises.length === 0) ? 'Add at Least 1 Exercise to Save' : 'Save Plan'}
        </button>

        <AnimatePresence>
          {showExercisePicker && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'var(--bg-sheet)', borderRadius: 'var(--r-2xl) var(--r-2xl) 0 0', padding: 20, zIndex: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>Pick Exercise ({filteredExercises.length} match equipment)</h3>
                <button
                  onClick={() => setShowExercisePicker(false)}
                  aria-label="Close exercise picker"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="search-bar" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercise, muscle, or gear..." style={{ paddingLeft: 36, minHeight: 38, fontSize: 12.5 }} />
              </div>
              <ChipScrollBar
                dropdownTitle="Filter by Equipment"
                ariaLabel="Filter picker by equipment"
                style={{ marginBottom: 10 }}
                chipStyle={{ fontSize: 10.5, padding: '4px 10px', minHeight: 28, textTransform: 'capitalize' }}
                items={[
                  { id: 'my_gear', label: 'My Gear', isActive: pickerEquip === 'my_gear', onClick: () => setPickerEquip('my_gear') },
                  { id: 'all', label: 'All Equipment', isActive: pickerEquip === 'all', onClick: () => setPickerEquip('all') },
                  ...pickerEquipOptions.map(eq => ({
                    id: eq,
                    label: eq,
                    isActive: pickerEquip === eq,
                    onClick: () => setPickerEquip(eq),
                  })),
                ]}
              />
              <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredExercises.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No matching exercises found.
                  </div>
                ) : (
                  filteredExercises.map(ex => (
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
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
