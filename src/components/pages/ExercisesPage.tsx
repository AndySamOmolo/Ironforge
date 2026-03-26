'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, X, Dumbbell, Play, ExternalLink, BookOpen, Zap, ChevronDown } from 'lucide-react';
import { db } from '@/lib/db/schema';
import type { Exercise } from '@/lib/types';
import { MUSCLE_COLORS } from '@/lib/types';
import { getYoutubeSearchUrl, getVideoSearchOptions } from '@/lib/data/youtube-ids';

const BODY_PARTS = ['all', 'back', 'chest', 'upper arms', 'lower arms', 'shoulders', 'upper legs', 'lower legs', 'waist', 'cardio'];
const EQUIPMENT_TYPES = ['all', 'barbell', 'dumbbell', 'cable', 'body weight', 'machine', 'leverage machine', 'band', 'kettlebell', 'medicine ball'];

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bodyPartFilter, setBodyPartFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(30);

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
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.primaryMuscles.some(m => m.toLowerCase().includes(q)) ||
        e.secondaryMuscles.some(m => m.toLowerCase().includes(q)) ||
        (e.equipment && e.equipment.toLowerCase().includes(q))
      );
    }
    if (bodyPartFilter !== 'all') {
      filtered = filtered.filter(e =>
        e.primaryMuscles.some(m => m.toLowerCase().includes(bodyPartFilter)) ||
        e.secondaryMuscles.some(m => m.toLowerCase().includes(bodyPartFilter)) ||
        (e.equipment && e.equipment.toLowerCase().includes(bodyPartFilter))
      );
    }
    if (equipmentFilter !== 'all') {
      filtered = filtered.filter(e => e.equipment?.toLowerCase().includes(equipmentFilter));
    }
    return filtered;
  }, [exercises, searchQuery, bodyPartFilter, equipmentFilter]);

  const handleImgError = useCallback((id: number | undefined) => {
    if (id !== undefined) setImgErrors(prev => new Set(prev).add(id));
  }, []);

  const getDisplayImage = (exercise: Exercise) => {
    if (exercise.gifUrl) return exercise.gifUrl;
    if (exercise.imageUrls?.length) return exercise.imageUrls[0];
    return null;
  };

  const activeFilters = [bodyPartFilter, equipmentFilter].filter(f => f !== 'all').length;

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span className="gradient-text">Exercise Library</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          {exercises.length} exercises with animated demos
        </p>
      </motion.div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="search-bar" type="text" placeholder="Search exercises, muscles, equipment..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 48, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        )}
        <button onClick={() => setShowFilters(!showFilters)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: activeFilters > 0 ? 'var(--accent-purple)' : 'transparent', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: activeFilters > 0 ? 'white' : 'var(--text-muted)', transition: 'all 0.2s' }}>
          <Filter size={14} />
        </button>
      </div>

      {/* Body part chips */}
      <div className="chip-scroll">
        {BODY_PARTS.map(bp => (
          <button key={bp} className={`filter-chip ${bodyPartFilter === bp ? 'active' : ''}`}
            onClick={() => setBodyPartFilter(bodyPartFilter === bp ? 'all' : bp)}>
            <span style={{ textTransform: 'capitalize' }}>{bp}</span>
          </button>
        ))}
      </div>

      {/* Equipment filter */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Equipment</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EQUIPMENT_TYPES.map(eq => (
                  <button key={eq} className={`filter-chip ${equipmentFilter === eq ? 'active' : ''}`}
                    onClick={() => setEquipmentFilter(equipmentFilter === eq ? 'all' : eq)}
                    style={{ fontSize: 11, padding: '5px 12px' }}>
                    {eq === 'all' ? 'All' : eq}
                  </button>
                ))}
              </div>
              {activeFilters > 0 && (
                <button onClick={() => { setBodyPartFilter('all'); setEquipmentFilter('all'); }}
                  style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  Clear all ×
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>
        {filteredExercises.length} result{filteredExercises.length !== 1 ? 's' : ''}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="exercise-grid">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '0.8', borderRadius: 18 }} />)}
        </div>
      ) : (
        <div className="exercise-grid">
          {filteredExercises.slice(0, visibleCount).map((exercise, idx) => {
            const imgSrc = getDisplayImage(exercise);
            const hasError = exercise.id !== undefined && imgErrors.has(exercise.id);
            const muscleColor = MUSCLE_COLORS[exercise.primaryMuscles[0]?.toLowerCase()] || '#888';
            return (
              <motion.div key={exercise.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.015, 0.25) }} className="card exercise-card"
                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => setSelectedExercise(exercise)}>
                <div className="exercise-img-container">
                  {imgSrc && !hasError ? (
                    <img src={imgSrc} alt={exercise.name} loading="lazy" onError={() => handleImgError(exercise.id)} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${muscleColor}08, var(--bg-elevated))` }}>
                      <Dumbbell size={30} color="var(--text-dim)" />
                    </div>
                  )}
                  {exercise.gifUrl && (
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: 6, padding: '3px 8px', fontSize: 9, fontWeight: 700, color: 'var(--accent-green)', letterSpacing: 0.5, zIndex: 2 }}>GIF</div>
                  )}
                </div>
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', letterSpacing: '-0.01em' }}>
                    {exercise.name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {exercise.primaryMuscles.slice(0, 2).map(m => (
                      <span key={m} className="badge badge-muscle" style={{ fontSize: 9, padding: '2px 8px', color: MUSCLE_COLORS[m.toLowerCase()] || '#888' }}>{m}</span>
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
        {selectedExercise && <ExerciseDetailModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ===== EXERCISE DETAIL MODAL ===== */
function ExerciseDetailModal({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const [mediaMode, setMediaMode] = useState<'gif' | 'video'>('gif');
  const videoOptions = getVideoSearchOptions(exercise.name);
  const ytSearchUrl = getYoutubeSearchUrl(exercise.name);
  const ytEmbedUrl = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(exercise.name + ' exercise form')}`;

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-content" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />

        {/* Media Toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'var(--bg-glass)', borderRadius: 'var(--r-sm)', padding: 3, border: '1px solid var(--border)' }}>
          <button onClick={() => setMediaMode('gif')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: mediaMode === 'gif' ? 'var(--gradient-fire)' : 'transparent', color: mediaMode === 'gif' ? 'white' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
            🎬 Animation
          </button>
          <button onClick={() => setMediaMode('video')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: mediaMode === 'video' ? 'var(--gradient-fire)' : 'transparent', color: mediaMode === 'video' ? 'white' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
            ▶ Video Guide
          </button>
        </div>

        {/* Media Display */}
        {mediaMode === 'gif' ? (
          exercise.gifUrl ? (
            <div className="gif-container" style={{ marginBottom: 16 }}>
              <img src={exercise.gifUrl} alt={exercise.name} />
            </div>
          ) : (
            <div style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-lg)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Dumbbell size={48} color="var(--text-dim)" />
            </div>
          )
        ) : (
          <div style={{ marginBottom: 16 }}>
            {/* Embedded YouTube Player */}
            <div className="youtube-embed" style={{ marginBottom: 8 }}>
              <iframe
                src={ytEmbedUrl}
                title={`${exercise.name} form guide`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {/* External link fallback */}
            <a href={ytSearchUrl} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px', borderRadius: 'var(--r-sm)', textDecoration: 'none',
              background: 'rgba(255,0,0,0.06)', border: '1px solid rgba(255,0,0,0.15)',
              color: '#FF4444', fontWeight: 600, fontSize: 12,
            }}>
              <ExternalLink size={12} /> Open on YouTube (more results)
            </a>
            {/* Channel shortcuts */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {videoOptions.slice(1).map(opt => (
                <a key={opt.label} href={opt.url} target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, padding: '7px', borderRadius: 'var(--r-sm)', textDecoration: 'none', textAlign: 'center',
                  background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                  fontSize: 10, fontWeight: 600,
                }}>
                  {opt.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Title */}
        <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>{exercise.name}</h2>

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {exercise.primaryMuscles.map(m => {
            const color = MUSCLE_COLORS[m.toLowerCase()] || '#888';
            return <span key={m} className="badge" style={{ background: `${color}14`, color, border: `1px solid ${color}28`, fontWeight: 700 }}>● {m}</span>;
          })}
          {exercise.secondaryMuscles.slice(0, 3).map(m => {
            const color = MUSCLE_COLORS[m.toLowerCase()] || '#888';
            return <span key={m} className="badge" style={{ background: `${color}0a`, color: `${color}bb`, fontSize: 10 }}>○ {m}</span>;
          })}
          {exercise.equipment && <span className="badge badge-muscle" style={{ textTransform: 'capitalize' }}>🏋️ {exercise.equipment}</span>}
        </div>

        {/* Instructions */}
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

        <button onClick={onClose} className="btn-primary" style={{ borderRadius: 'var(--r-md)' }}>Done</button>
      </motion.div>
    </motion.div>
  );
}
