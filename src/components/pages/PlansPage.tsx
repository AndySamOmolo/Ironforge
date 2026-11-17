'use client';

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/db';
import { WorkoutPlan, WorkoutDay, PlanCategory, Difficulty, Exercise, EquipmentType } from '@/lib/types';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { Plus, Play, Check, Trash2, ChevronDown, ChevronUp, Sparkles, X, Wand2, Scale, RefreshCw } from 'lucide-react';
import {
  buildResolvedActiveExercises,
  calculatePlanMuscleCoverage,
  generateSmartBalancedDays,
  isGifBackedExercise,
  matchesSelectedEquipment,
  resolvePlanDayExercises,
} from '@/lib/utils/exerciseResolver';

const CATEGORIES: PlanCategory[] = ['Hypertrophy', 'Strength', 'Powerlifting', 'Bodyweight', 'Athletic', 'General Fitness'];
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'expert'];
const EQUIPMENT_FILTERS: { id: EquipmentType; label: string }[] = [
  { id: 'barbell', label: 'Barbell' },
  { id: 'dumbbell', label: 'Dumbbell' },
  { id: 'cable', label: 'Cable' },
  { id: 'machine', label: 'Machine' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'bands', label: 'Bands' },
];

export default function PlansPage() {
  const { startWorkout } = useWorkoutStore();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [planDaysMap, setPlanDaysMap] = useState<Record<number, WorkoutDay[]>>({});
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType[]>([]);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSmartModal, setShowSmartModal] = useState(false);

  // Custom builder state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState<PlanCategory>('Hypertrophy');
  const [newDiff, setNewDiff] = useState<Difficulty>('intermediate');
  const [newDaysCount, setNewDaysCount] = useState(3);
  const [newDays, setNewDays] = useState<{ name: string; exercises: { name: string; sets: number; reps: number }[] }[]>([
    { name: 'Day 1', exercises: [{ name: '', sets: 3, reps: 10 }] },
    { name: 'Day 2', exercises: [{ name: '', sets: 3, reps: 10 }] },
    { name: 'Day 3', exercises: [{ name: '', sets: 3, reps: 10 }] },
  ]);
  const [allExercises, setAllExercises] = useState<string[]>([]);

  // Smart Balanced Plan Generator state
  const [smartName, setSmartName] = useState('Custom Balanced Split');
  const [smartFocus, setSmartFocus] = useState<PlanCategory>('Hypertrophy');
  const [smartDiff, setSmartDiff] = useState<Difficulty>('intermediate');
  const [smartDaysCount, setSmartDaysCount] = useState(4);
  const [smartEquipment, setSmartEquipment] = useState<EquipmentType[]>(['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']);

  const loadPlans = useCallback(async () => {
    setIsLoadingPlans(true);
    try {
      const allPlans = await db.workoutPlans.toArray();
      setPlans(allPlans);
      const daysMap: Record<number, WorkoutDay[]> = {};
      for (const p of allPlans) {
        if (p.id) {
          daysMap[p.id] = await db.workoutDays.where('planId').equals(p.id).sortBy('dayNumber');
        }
      }
      setPlanDaysMap(daysMap);

      const exs = await db.exercises.toArray();
      setCatalog(exs);
      setAllExercises(exs.filter(isGifBackedExercise).map((e) => e.name));
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handleActivatePlan = async (planId: number) => {
    await db.workoutPlans.toCollection().modify({ isActive: false });
    await db.workoutPlans.update(planId, { isActive: true });
    loadPlans();
  };

  const handleDeletePlan = async (planId: number) => {
    await db.workoutDays.where('planId').equals(planId).delete();
    await db.workoutPlans.delete(planId);
    loadPlans();
  };

  const handleStartDay = async (plan: WorkoutPlan, day: WorkoutDay) => {
    const resolvedDayExercises = resolvePlanDayExercises(day.exercises, catalog, selectedEquipment);
    const activeExercises = await buildResolvedActiveExercises(resolvedDayExercises, selectedEquipment);
    startWorkout(plan.id!, day.id!, `${plan.name} — ${day.name}`, activeExercises);
  };

  const handleDaysCountChange = (count: number) => {
    setNewDaysCount(count);
    const updated = [...newDays];
    while (updated.length < count) updated.push({ name: `Day ${updated.length + 1}`, exercises: [{ name: '', sets: 3, reps: 10 }] });
    while (updated.length > count) updated.pop();
    setNewDays(updated);
  };

  const handleAutoFillCustomDays = () => {
    const generated = generateSmartBalancedDays(catalog, newDaysCount, selectedEquipment, newCat);
    setNewDays(
      generated.map((d) => ({
        name: d.name,
        exercises: d.exercises.map((ex) => ({
          name: ex.exerciseName,
          sets: ex.sets,
          reps: ex.reps,
        })),
      }))
    );
  };

  const handleCreatePlan = async () => {
    if (!newName.trim()) return;
    const planId = await db.workoutPlans.add({
      name: newName.trim(),
      description: newDesc.trim() || 'Custom balanced workout plan',
      category: newCat,
      difficulty: newDiff,
      daysPerWeek: newDaysCount,
      isCustom: true,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    for (let i = 0; i < newDays.length; i++) {
      const d = newDays[i];
      await db.workoutDays.add({
        planId,
        dayNumber: i + 1,
        name: d.name || `Day ${i + 1}`,
        exercises: d.exercises.filter((e) => e.name.trim()).map((e, idx) => ({
          exerciseId: 0,
          exerciseName: e.name.trim().toLowerCase(),
          sets: e.sets,
          reps: e.reps,
          restTime: 90,
          setType: 'normal' as const,
          order: idx,
        })),
      });
    }
    setShowCreateModal(false);
    setNewName('');
    setNewDesc('');
    loadPlans();
  };

  const handleCreateSmartPlan = async () => {
    if (!smartName.trim()) return;
    const generatedDays = generateSmartBalancedDays(catalog, smartDaysCount, smartEquipment, smartFocus);
    await db.workoutPlans.toCollection().modify({ isActive: false });

    const equipLabel = smartEquipment.length > 0 ? smartEquipment.join(', ') : 'full gym';
    const planId = await db.workoutPlans.add({
      name: smartName.trim(),
      description: `Auto-balanced ${smartDaysCount}-day ${smartFocus.toLowerCase()} split targeting Chest, Back, Shoulders, Quads, Hamstrings/Glutes, Biceps, Triceps & Core (${equipLabel}).`,
      category: smartFocus,
      difficulty: smartDiff,
      daysPerWeek: smartDaysCount,
      isCustom: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (let i = 0; i < generatedDays.length; i++) {
      const day = generatedDays[i];
      await db.workoutDays.add({
        planId,
        dayNumber: i + 1,
        name: day.name,
        exercises: day.exercises,
      });
    }

    setShowSmartModal(false);
    loadPlans();
  };

  const toggleEquipmentFilter = (eq: EquipmentType) => {
    setSelectedEquipment((prev) =>
      prev.includes(eq) ? prev.filter((item) => item !== eq) : [...prev, eq]
    );
  };

  const toggleSmartEquipment = (eq: EquipmentType) => {
    setSmartEquipment((prev) =>
      prev.includes(eq) ? prev.filter((item) => item !== eq) : [...prev, eq]
    );
  };

  const filtered = plans.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (selectedDifficulty !== 'all' && p.difficulty !== selectedDifficulty) return false;
    return true;
  });

  const getDiffColor = (d: Difficulty) => {
    if (d === 'beginner') return 'badge-success';
    if (d === 'intermediate') return 'badge-warning';
    return 'badge-danger';
  };

  const gifBackedCount = catalog.filter((e) => isGifBackedExercise(e) && matchesSelectedEquipment(e, selectedEquipment)).length;

  return (
    <div className="page-container">
      <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Workout Plans</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem' }}>
            {isLoadingPlans
              ? 'Loading balanced programs & exercise catalog…'
              : `${plans.length} balanced programs • ${gifBackedCount} GIF-verified exercises ready`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 2 }}>
          <button
            className="btn-secondary"
            onClick={() => setShowSmartModal(true)}
            style={{ padding: '7px 10px', fontSize: '0.72rem' }}
            title="Smart Plan Generator"
          >
            <Wand2 size={13} color="var(--accent-primary)" /> Smart
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ padding: '7px 11px', fontSize: '0.72rem' }}
            title="Create Custom Plan"
          >
            <Plus size={13} /> Custom
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="chip-scroll" style={{ marginBottom: 8 }}>
        <button className={`chip ${selectedCategory === 'all' ? 'active' : ''}`} onClick={() => setSelectedCategory('all')}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${selectedCategory === c ? 'active' : ''}`} onClick={() => setSelectedCategory(c)}>{c}</button>
        ))}
      </div>

      {/* Difficulty Filter */}
      <div className="chip-scroll" style={{ marginBottom: 8 }}>
        <button className={`chip ${selectedDifficulty === 'all' ? 'active' : ''}`} onClick={() => setSelectedDifficulty('all')}>All Levels</button>
        {DIFFICULTIES.map((d) => (
          <button key={d} className={`chip ${selectedDifficulty === d ? 'active' : ''}`} onClick={() => setSelectedDifficulty(d)} style={{ textTransform: 'capitalize' }}>{d}</button>
        ))}
      </div>

      {/* Available Equipment Filter (dynamically adapts plan exercises) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Available Equipment {selectedEquipment.length > 0 ? `(${selectedEquipment.length} active — auto-adapts exercises)` : '(All Gym Equipment)'}
          </span>
          {selectedEquipment.length > 0 && (
            <button
              onClick={() => setSelectedEquipment([])}
              style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: '0.68rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Reset
            </button>
          )}
        </div>
        <div className="chip-scroll">
          {EQUIPMENT_FILTERS.map((eq) => (
            <button
              key={eq.id}
              className={`chip ${selectedEquipment.includes(eq.id) ? 'active' : ''}`}
              onClick={() => toggleEquipmentFilter(eq.id)}
            >
              {eq.label}
            </button>
          ))}
        </div>
      </div>

      {/* Plan Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {filtered.map((plan) => {
          const rawDays = plan.id ? planDaysMap[plan.id] || [] : [];
          const resolvedDays = rawDays.map((d) => ({
            ...d,
            exercises: resolvePlanDayExercises(d.exercises, catalog, selectedEquipment),
          }));
          const coverage = calculatePlanMuscleCoverage(resolvedDays, catalog);
          const isExpanded = expandedPlan === plan.id;

          return (
            <div key={plan.id} className="card" style={{ border: plan.isActive ? '1px solid var(--accent-primary)' : undefined, position: 'relative' }}>
              {plan.isActive && (
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  <span className="badge badge-accent"><Sparkles size={10} /> Active</span>
                </div>
              )}
              <div onClick={() => setExpandedPlan(isExpanded ? null : (plan.id ?? null))} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span className="badge badge-accent">{plan.category}</span>
                  <span className={`badge ${getDiffColor(plan.difficulty)}`} style={{ textTransform: 'capitalize' }}>{plan.difficulty}</span>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>{plan.daysPerWeek}d/wk</span>
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Scale size={10} /> Balanced
                  </span>
                  {plan.isCustom && <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#c084fc' }}>Custom</span>}
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4, paddingRight: plan.isActive ? 74 : 0 }}>{plan.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.4 }}>{plan.description}</p>

                {/* Full-Body Muscle Balance Bar (Shows full labels including Delts & Triceps) */}
                {coverage.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', gap: 1 }}>
                      {coverage.map((c) => (
                        <div key={c.group} style={{ width: `${Math.max(8, c.percentage)}%`, background: c.color }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 6 }}>
                      {coverage.map((c) => (
                        <span key={c.group} style={{ fontSize: '0.63rem', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, display: 'inline-block', flexShrink: 0 }} />
                          {c.label} {c.percentage}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{isExpanded ? 'Hide' : 'Show'} {resolvedDays.length} workout days</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border-glass)', paddingTop: 16 }}>
                  {resolvedDays.map((day) => (
                    <div key={day.id || day.dayNumber} style={{ marginBottom: 14, padding: 12, background: 'rgba(255,255,255,0.025)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--accent-secondary)', display: 'block', lineHeight: 1.3 }}>
                            Day {day.dayNumber}: {day.name}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'block', marginTop: 2 }}>
                            {day.exercises.length} exercises • GIF & equipment matched
                          </span>
                        </div>
                        <button
                          className="btn-primary"
                          onClick={() => handleStartDay(plan, day)}
                          style={{ padding: '7px 13px', fontSize: '0.74rem', flexShrink: 0 }}
                        >
                          <Play size={12} fill="white" /> Start
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {day.exercises.map((ex, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '3px 0', borderBottom: i < day.exercises.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                            <span style={{ textTransform: 'capitalize', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.exerciseName}</span>
                            <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0 }}>{ex.sets} × {ex.reps}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {!plan.isActive && (
                      <button className="btn-primary" onClick={() => handleActivatePlan(plan.id!)} style={{ flex: 1, padding: '10px', fontSize: '0.8rem' }}>
                        <Check size={14} /> Set as Active Plan
                      </button>
                    )}
                    {plan.isCustom && (
                      <button className="btn-danger" onClick={() => handleDeletePlan(plan.id!)} style={{ padding: '10px 14px', fontSize: '0.8rem' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Action Buttons: Smart Balanced Generator + Custom Builder */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn-primary" onClick={() => setShowSmartModal(true)} style={{ width: '100%', padding: 13, fontSize: '0.82rem' }}>
          <Wand2 size={16} /> Smart Generator
        </button>
        <button className="btn-secondary" onClick={() => setShowCreateModal(true)} style={{ width: '100%', padding: 13, fontSize: '0.82rem' }}>
          <Plus size={16} /> Custom Plan
        </button>
      </div>

      {/* Smart Balanced Plan Generator Modal */}
      {showSmartModal && (
        <div className="modal-overlay" onClick={() => setShowSmartModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wand2 size={18} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Smart Balanced Generator</h2>
              </div>
              <button onClick={() => setShowSmartModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.45 }}>
              Automatically builds a balanced weekly program across Chest, Back, Shoulders, Quads, Hamstrings/Glutes, Biceps, Triceps, and Core using only exercises with verified GIF demonstrations and your chosen equipment.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="input" placeholder="Plan Name" value={smartName} onChange={(e) => setSmartName(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select className="input" value={smartFocus} onChange={(e) => setSmartFocus(e.target.value as PlanCategory)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="input" value={smartDiff} onChange={(e) => setSmartDiff(e.target.value as Difficulty)}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>
                  Days per week: {smartDaysCount}
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button key={n} className={`chip ${smartDaysCount === n ? 'active' : ''}`} onClick={() => setSmartDaysCount(n)}>{n}d</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>
                  Equipment to Include
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EQUIPMENT_FILTERS.map((eq) => (
                    <button
                      key={eq.id}
                      type="button"
                      className={`chip ${smartEquipment.includes(eq.id) ? 'active' : ''}`}
                      onClick={() => toggleSmartEquipment(eq.id)}
                    >
                      {eq.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn-primary" onClick={handleCreateSmartPlan} style={{ width: '100%', padding: 14, marginTop: 6 }}>
                <Sparkles size={16} /> Generate & Activate Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Plan Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Create Custom Plan</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="input" placeholder="Plan Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input className="input" placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select className="input" value={newCat} onChange={(e) => setNewCat(e.target.value as PlanCategory)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="input" value={newDiff} onChange={(e) => setNewDiff(e.target.value as Difficulty)}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Days per week: {newDaysCount}</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button key={n} className={`chip ${newDaysCount === n ? 'active' : ''}`} onClick={() => handleDaysCountChange(n)}>{n}</button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleAutoFillCustomDays}
                  style={{ padding: '8px 10px', fontSize: '0.72rem' }}
                >
                  <RefreshCw size={12} /> Auto-Balance
                </button>
              </div>
              {newDays.map((day, dIdx) => (
                <div key={dIdx} style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                  <input className="input" style={{ marginBottom: 8 }} placeholder={`Day ${dIdx + 1} Name`} value={day.name}
                    onChange={(e) => { const u = [...newDays]; u[dIdx].name = e.target.value; setNewDays(u); }} />
                  {day.exercises.map((ex, eIdx) => (
                    <div key={eIdx} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                      <input className="input" style={{ flex: 2 }} placeholder="Exercise name" list="ex-list" value={ex.name}
                        onChange={(e) => { const u = [...newDays]; u[dIdx].exercises[eIdx].name = e.target.value; setNewDays(u); }} />
                      <input className="input" style={{ width: 55, textAlign: 'center' }} type="number" placeholder="Sets" value={ex.sets}
                        onChange={(e) => { const u = [...newDays]; u[dIdx].exercises[eIdx].sets = Number(e.target.value); setNewDays(u); }} />
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>×</span>
                      <input className="input" style={{ width: 55, textAlign: 'center' }} type="number" placeholder="Reps" value={ex.reps}
                        onChange={(e) => { const u = [...newDays]; u[dIdx].exercises[eIdx].reps = Number(e.target.value); setNewDays(u); }} />
                      {day.exercises.length > 1 && (
                        <button onClick={() => { const u = [...newDays]; u[dIdx].exercises.splice(eIdx, 1); setNewDays(u); }}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}><X size={14} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => { const u = [...newDays]; u[dIdx].exercises.push({ name: '', sets: 3, reps: 10 }); setNewDays(u); }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', marginTop: 4 }}>
                    + Add Exercise
                  </button>
                </div>
              ))}
              <datalist id="ex-list">
                {allExercises.map((name) => <option key={name} value={name} />)}
              </datalist>
              <button className="btn-primary" onClick={handleCreatePlan} style={{ width: '100%', padding: 14, marginTop: 8 }}>Save Plan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
