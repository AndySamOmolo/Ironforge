'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, X, Dumbbell, ExternalLink, BookOpen, ChevronDown, Sparkles, Flame, Target, Check, Play } from 'lucide-react';
import { db } from '@/lib/db/schema';
import type { Exercise } from '@/lib/types';
import { MUSCLE_COLORS, SetType } from '@/lib/types';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUIStore } from '@/lib/store/uiStore';
import { ALL_EQUIPMENT, matchesUserEquipment, normalizeEquipmentName, sharesTargetMuscle } from '@/lib/utils/exerciseResolver';
import { getWorkoutStartingWeight } from '@/lib/utils/workoutDefaults';
import { getYoutubeSearchUrl, getVideoSearchOptions } from '@/lib/data/youtube-ids';
import ExerciseMedia from '@/components/ui/ExerciseMedia';
import { ChipScrollBar } from '@/components/ui/CustomSelect';
import {
  hasAnimatedExerciseMedia,
  hasGifExerciseMedia,
  getExerciseGifUrl,
  getExerciseImageFrames,
  getPrimaryExerciseImage,
} from '@/lib/utils/exerciseMedia';

const BODY_PARTS = ['all', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms', 'traps', 'cardio'];
const EQUIPMENT_TYPES = ['all', ...ALL_EQUIPMENT];

export default function ExercisesPage() {
  const { equipment: userEquipment, barWeight, dumbbellWeight, defaultRestTime } = useUserStore();
  const { startWorkout } = useWorkoutStore();
  const { setActiveTab } = useUIStore();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bodyPartFilter, setBodyPartFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [onlyMyEquipment, setOnlyMyEquipment] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => { loadExercises(); }, []);

  const loadExercises = async () => {
    setIsLoading(true);
    try {
      const all = await db.exercises.toArray();
      setExercises(all);
    } catch (err) { console.error('Failed:', err); }
    setIsLoading(false);
  };

  const filteredExercises = useMemo(() => {
    let filtered = exercises;

    if (onlyMyEquipment && userEquipment && userEquipment.length > 0) {
      filtered = filtered.filter(e => matchesUserEquipment(e, userEquipment));
    }

    if (searchQuery.trim()) {
      const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
      filtered = filtered.filter(e => {
        const hay = `${e.name} ${e.equipment || ''} ${(e.primaryMuscles || []).join(' ')} ${(e.secondaryMuscles || []).join(' ')} ${e.category || ''}`.toLowerCase();
        return tokens.every(tok => hay.includes(tok));
      });
    }
    if (bodyPartFilter !== 'all') {
      filtered = filtered.filter(e =>
        sharesTargetMuscle(e.primaryMuscles || [], [bodyPartFilter]) ||
        sharesTargetMuscle(e.secondaryMuscles || [], [bodyPartFilter]) ||
        (e.category && e.category.toLowerCase().includes(bodyPartFilter))
      );
    }
    if (equipmentFilter !== 'all') {
      filtered = filtered.filter(e => normalizeEquipmentName(e.equipment) === equipmentFilter);
    }

    // Prioritize exercises with GIFs as primary media, keeping static image exercises as backups
    return [...filtered].sort((a, b) => {
      const gifDiff = Number(hasGifExerciseMedia(b)) - Number(hasGifExerciseMedia(a));
      if (gifDiff !== 0) return gifDiff;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, searchQuery, bodyPartFilter, equipmentFilter, onlyMyEquipment, userEquipment]);

  const handleImgError = useCallback((id: number | undefined) => {
    if (id !== undefined) setImgErrors(prev => new Set(prev).add(id));
  }, []);

  const handleStartWithExercise = (ex: Exercise) => {
    const startW = getWorkoutStartingWeight({
      equipment: ex.equipment,
      barWeight,
      dumbbellWeight,
    });
    setSelectedExercise(null);
    startWorkout('Single Exercise', ex.name, [
      {
        exerciseId: ex.id || 0,
        exerciseName: ex.name,
        imageUrl: getPrimaryExerciseImage(ex),
        gifUrl: getExerciseGifUrl(ex),
        mediaFrames: getExerciseImageFrames(ex),
        sets: Array.from({ length: 4 }, (_, i) => ({
          setNumber: i + 1,
          setType: SetType.Normal,
          weight: startW,
          reps: 10,
          targetWeight: startW,
          targetReps: 10,
          isComplete: false,
        })),
        targetSets: 4,
        targetReps: 10,
        restTime: defaultRestTime || 90,
        isComplete: false,
      },
    ]);
  };

  const activeFilters = [bodyPartFilter, equipmentFilter].filter(f => f !== 'all').length + (onlyMyEquipment ? 1 : 0);

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
            <div
              className="icon-badge"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--accent-orange) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-orange) 28%, transparent)',
                flexShrink: 0,
              }}
            >
              <Dumbbell size={18} color="var(--accent-orange)" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 className="font-display" style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span className="gradient-text">Exercise Library</span>
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <Sparkles size={11} color="var(--accent-purple)" style={{ flexShrink: 0 }} />
                <span>{isLoading ? 'Loading exercise catalog...' : `${exercises.length.toLocaleString()} exercises • ${filteredExercises.length.toLocaleString()} shown`}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className="btn-secondary"
            style={{ fontSize: 11.5, padding: '8px 12px', minHeight: 36, borderRadius: 10, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
            title="Switch to Workout Plans"
          >
            ← Plans
          </button>
        </div>
      </motion.div>

      {/* Search & Quick Gear Toggle */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 2 }} />
          <input
            className="search-bar"
            type="text"
            placeholder="Search exercises, muscles, gear..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 40, paddingRight: searchQuery ? 82 : 48, minHeight: 42 }}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 48, background: 'var(--bg-subtle-fill)', border: 'none', borderRadius: '50%', width: 26, height: 26, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            aria-label="Toggle equipment filters"
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
            style={{
              position: 'absolute',
              right: 8,
              background: showFilters || activeFilters > 0 ? 'var(--accent-purple)' : 'var(--bg-subtle-fill)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 9,
              width: 32,
              height: 32,
              cursor: 'pointer',
              color: showFilters || activeFilters > 0 ? 'var(--text-on-ocean)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              zIndex: 2,
            }}
          >
            <Filter size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button
            type="button"
            onClick={() => setOnlyMyEquipment(!onlyMyEquipment)}
            className={`filter-chip ${onlyMyEquipment ? 'active' : ''}`}
            style={{ fontSize: 11, padding: '6px 12px', minHeight: 32, flexShrink: 0 }}
            title="Filter by your selected equipment"
          >
            {onlyMyEquipment && <Check size={12} />} My Gear ({userEquipment?.length || 0})
          </button>
          {equipmentFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setEquipmentFilter('all')}
              className="filter-chip"
              style={{ fontSize: 11, padding: '5px 10px', minHeight: 30, textTransform: 'capitalize' }}
            >
              {equipmentFilter} <X size={11} />
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
            {isLoading ? 'Loading...' : `${filteredExercises.length.toLocaleString()} shown`}
          </div>
        </div>
      </motion.div>

      {/* Muscle / Body part chips */}
      <ChipScrollBar
        dropdownTitle="Muscle & Body Parts"
        ariaLabel="Filter by body part"
        chipStyle={{ textTransform: 'capitalize' }}
        items={BODY_PARTS.map(bp => ({
          id: bp,
          label: bp,
          isActive: bodyPartFilter === bp,
          onClick: () => setBodyPartFilter(bodyPartFilter === bp ? 'all' : bp),
        }))}
      />

      {/* Equipment filter */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div className="section-label">Equipment Filter</div>
                <button
                  onClick={() => setOnlyMyEquipment(!onlyMyEquipment)}
                  style={{ background: 'none', border: 'none', color: onlyMyEquipment ? 'var(--accent-green)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {onlyMyEquipment ? '✓ Only My Selected Equipment' : 'Showing All Equipment'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EQUIPMENT_TYPES.map(eq => (
                  <button key={eq} className={`filter-chip ${equipmentFilter === eq ? 'active' : ''}`}
                    onClick={() => setEquipmentFilter(equipmentFilter === eq ? 'all' : eq)}
                    style={{ fontSize: 11, padding: '5px 12px', textTransform: 'capitalize' }}>
                    {eq === 'all' ? 'All' : eq}
                  </button>
                ))}
              </div>
              {(bodyPartFilter !== 'all' || equipmentFilter !== 'all' || onlyMyEquipment) && (
                <button onClick={() => { setBodyPartFilter('all'); setEquipmentFilter('all'); setOnlyMyEquipment(false); }}
                  style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  Clear all filters ×
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          {isLoading ? 'Preparing demonstrations...' : `${filteredExercises.length.toLocaleString()} result${filteredExercises.length !== 1 ? 's' : ''}`}
          {!isLoading && onlyMyEquipment && <span style={{ color: 'var(--accent-green)', marginLeft: 6 }}>• Filtered to your equipment</span>}
        </div>
        {searchQuery && (
          <div style={{ fontSize: 11, color: 'var(--accent-purple)', fontWeight: 700 }}>
            &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="exercise-grid">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '0.8', borderRadius: 18 }} />)}
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
          <Dumbbell size={32} color="var(--text-dim)" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>No matching exercises</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Try adjusting your search or clearing your active muscle and equipment filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setBodyPartFilter('all');
              setEquipmentFilter('all');
              setOnlyMyEquipment(false);
            }}
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 20px', borderRadius: 12, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="exercise-grid">
          {filteredExercises.slice(0, visibleCount).map((exercise, idx) => {
            const hasError = exercise.id !== undefined && imgErrors.has(exercise.id);
            const muscleColor = MUSCLE_COLORS[exercise.primaryMuscles?.[0]?.toLowerCase()] || '#888';
            const hasMedia = hasGifExerciseMedia(exercise) || getExerciseImageFrames(exercise).length > 0;
            const isGif = hasGifExerciseMedia(exercise);
            const isAnimated = hasAnimatedExerciseMedia(exercise);
            return (
              <motion.div key={exercise.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.015, 0.25) }} className="card exercise-card"
                role="button"
                tabIndex={0}
                aria-label={`View exercise details for ${exercise.name}`}
                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => setSelectedExercise(exercise)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedExercise(exercise);
                  }
                }}>
                <div className="exercise-img-container">
                  {hasMedia && !hasError ? (
                    <ExerciseMedia
                      gifUrl={exercise.gifUrl}
                      imageUrls={exercise.imageUrls}
                      images={exercise.images}
                      alt={exercise.name}
                      loading="lazy"
                      onExhausted={() => handleImgError(exercise.id)}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${muscleColor}15, var(--bg-elevated))` }}>
                      <Dumbbell size={30} color="var(--text-dim)" />
                    </div>
                  )}
                  {isAnimated && !hasError && (
                    <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(7,7,16,0.86)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '2px 7px', fontSize: 8.5, fontWeight: 800, color: isGif ? 'var(--accent-green)' : 'var(--accent-cyan)', letterSpacing: 0.5, zIndex: 2, display: 'flex', alignItems: 'center', gap: 3, border: '1px solid rgba(255,255,255,0.14)' }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: isGif ? 'var(--accent-green)' : 'var(--accent-cyan)', display: 'inline-block' }} /> {isGif ? 'GIF' : 'FRAMES'}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px 12px 12px' }}>
                  <div title={exercise.name} style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', letterSpacing: '-0.01em', textTransform: 'capitalize' }}>
                    {exercise.name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(exercise.primaryMuscles || []).slice(0, 2).map(m => (
                      <span key={m} className="badge badge-muscle" style={{ fontSize: 9, padding: '2px 8px', color: MUSCLE_COLORS[m.toLowerCase()] || '#888', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: MUSCLE_COLORS[m.toLowerCase()] || '#888', display: 'inline-block' }} />
                        {m}
                      </span>
                    ))}
                  </div>
                  {exercise.equipment && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textTransform: 'capitalize' }}>{exercise.equipment}</div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {filteredExercises.length > visibleCount && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <button className="btn-secondary" onClick={() => setVisibleCount(prev => prev + 30)} style={{ padding: '12px 32px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ChevronDown size={14} /> Load More ({filteredExercises.length - visibleCount} remaining)
          </button>
        </div>
      )}

      <AnimatePresence>
        {selectedExercise && (
          <ExerciseDetailModal
            exercise={selectedExercise}
            onClose={() => setSelectedExercise(null)}
            onStartWorkout={() => handleStartWithExercise(selectedExercise)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ===== EXERCISE DETAIL MODAL ===== */
function ExerciseDetailModal({
  exercise,
  onClose,
  onStartWorkout,
}: {
  exercise: Exercise;
  onClose: () => void;
  onStartWorkout: () => void;
}) {
  const videoOptions = getVideoSearchOptions(exercise.name);
  const ytSearchUrl = getYoutubeSearchUrl(exercise.name);
  const hasMedia = hasGifExerciseMedia(exercise) || getExerciseImageFrames(exercise).length > 0;
  const isGif = hasGifExerciseMedia(exercise);
  const isAnimated = hasAnimatedExerciseMedia(exercise);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={exercise.name}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <button
          onClick={onClose}
          aria-label="Close modal"
          style={{ position: 'absolute', top: 18, right: 18, zIndex: 10, width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>

        {hasMedia ? (
          <div className="gif-container" style={{ marginBottom: 16, position: 'relative' }}>
            <ExerciseMedia
              gifUrl={exercise.gifUrl}
              imageUrls={exercise.imageUrls}
              images={exercise.images}
              alt={exercise.name}
              loading="eager"
              frameIntervalMs={700}
            />
            <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4, zIndex: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-green)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
              {isGif ? 'Animated GIF' : isAnimated ? 'Animated Frames (Backup)' : 'Image (Backup)'}
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-lg)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Dumbbell size={48} color="var(--text-dim)" />
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <a href={ytSearchUrl} target="_blank" rel="noopener noreferrer" style={{
            flex: 1, minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px', borderRadius: 'var(--r-sm)', textDecoration: 'none',
            background: 'rgba(255,0,0,0.06)', border: '1px solid rgba(255,0,0,0.15)',
            color: '#FF4444', fontWeight: 600, fontSize: 12,
          }}>
            <ExternalLink size={12} /> Watch on YouTube
          </a>
          {videoOptions.slice(1).map(opt => (
            <a key={opt.label} href={opt.url} target="_blank" rel="noopener noreferrer" style={{
              padding: '10px 12px', borderRadius: 'var(--r-sm)', textDecoration: 'none', textAlign: 'center',
              background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
              fontSize: 10, fontWeight: 600,
            }}>
              {opt.label}
            </a>
          ))}
        </div>

        <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em', textTransform: 'capitalize' }}>{exercise.name}</h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {(exercise.primaryMuscles || []).map(m => {
            const color = MUSCLE_COLORS[m.toLowerCase()] || '#888';
            return <span key={m} className="badge" style={{ background: `${color}14`, color, border: `1px solid ${color}28`, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Flame size={10} /> {m}
            </span>;
          })}
          {(exercise.secondaryMuscles || []).slice(0, 4).map(m => {
            const color = MUSCLE_COLORS[m.toLowerCase()] || '#888';
            return <span key={m} className="badge" style={{ background: `${color}0a`, color: `${color}bb`, fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Target size={8} /> {m}
            </span>;
          })}
          {exercise.equipment && (
            <span className="badge badge-muscle" style={{ textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Dumbbell size={10} /> {exercise.equipment}
            </span>
          )}
        </div>

        {exercise.instructions?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={14} color="var(--accent-purple)" /> How to Perform
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {exercise.instructions.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--gradient-ocean)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, color: 'white' }}>{i + 1}</div>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', flex: 1 }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1, borderRadius: 'var(--r-md)' }}>Close</button>
          <button onClick={onStartWorkout} className="btn-primary" style={{ flex: 2, borderRadius: 'var(--r-md)' }}>
            <Play size={15} fill="currentColor" /> Start Workout
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
