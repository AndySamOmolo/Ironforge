'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '@/lib/db';
import { Exercise, MuscleGroup, EquipmentType } from '@/lib/types';
import { Search, Heart, Filter, X, ExternalLink, Play, Dumbbell, Film, Sparkles } from 'lucide-react';
import { hasExerciseMedia, hasLocalGif } from '@/lib/utils/exerciseMedia';
import ExerciseMedia from '@/components/ui/ExerciseMedia';

const MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'traps', 'lats', 'lower back'];
const EQUIPMENT: EquipmentType[] = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'bands', 'ez-bar', 'smith-machine', 'trap-bar', 'other'];

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showMediaOnly, setShowMediaOnly] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [mediaExhausted, setMediaExhausted] = useState<Record<number, boolean>>({});
  const [detailMediaMode, setDetailMediaMode] = useState<'gif' | 'animated-images' | 'static-image' | 'none'>('none');

  const loadExercises = useCallback(async () => {
    const all = await db.exercises.toArray();
    setExercises(all);
  }, []);

  useEffect(() => { loadExercises(); }, [loadExercises]);

  const toggleFavorite = async (ex: Exercise, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ex.id) return;
    await db.exercises.update(ex.id, { isFavorite: !ex.isFavorite });
    setExercises((prev) => prev.map((item) => item.id === ex.id ? { ...item, isFavorite: !item.isFavorite } : item));
    if (selectedExercise?.id === ex.id) setSelectedExercise({ ...ex, isFavorite: !ex.isFavorite });
  };

  const filtered = useMemo(() => {
    const filteredList = exercises.filter((ex) => {
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase()) &&
          !ex.primaryMuscles.some((m) => m.toLowerCase().includes(search.toLowerCase())) &&
          !ex.equipment.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedMuscle !== 'all' && !ex.primaryMuscles.includes(selectedMuscle as MuscleGroup) && !ex.secondaryMuscles.includes(selectedMuscle as MuscleGroup)) return false;
      if (selectedEquipment !== 'all' && ex.equipment !== selectedEquipment) return false;
      if (showFavoritesOnly && !ex.isFavorite) return false;
      if (showMediaOnly && !hasExerciseMedia(ex)) return false;
      return true;
    });

    // Prioritize exercises with local animated GIFs first, then multi-frame images, then alphabetical
    return filteredList.sort((a, b) => {
      const aGif = hasLocalGif(a) ? 2 : hasExerciseMedia(a) ? 1 : 0;
      const bGif = hasLocalGif(b) ? 2 : hasExerciseMedia(b) ? 1 : 0;
      if (aGif !== bGif) return bGif - aGif;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, search, selectedMuscle, selectedEquipment, showFavoritesOnly, showMediaOnly]);

  const gifCount = useMemo(() => exercises.filter(hasLocalGif).length, [exercises]);
  const mediaCount = useMemo(() => exercises.filter(hasExerciseMedia).length, [exercises]);

  const getMuscleIcon = (muscle: string) => {
    const colors: Record<string, string> = {
      chest: '#ef4444', back: '#3b82f6', shoulders: '#f59e0b', biceps: '#10b981',
      triceps: '#8b5cf6', quadriceps: '#ec4899', hamstrings: '#06b6d4', glutes: '#f97316',
      calves: '#14b8a6', abdominals: '#eab308', lats: '#6366f1', traps: '#a855f7',
      forearms: '#64748b', 'lower back': '#2563eb',
    };
    return colors[muscle] || '#6366f1';
  };

  return (
    <div className="page-container">
      <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 className="page-title">Exercises</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`chip ${showMediaOnly ? 'active' : ''}`}
            onClick={() => setShowMediaOnly(!showMediaOnly)}
            style={{ padding: '6px 10px', fontSize: '0.72rem' }}
            title="Filter exercises with visual demonstrations"
          >
            <Film size={12} style={{ marginRight: 4 }} /> Media ({mediaCount})
          </button>
          <button
            className={`chip ${showFavoritesOnly ? 'active' : ''}`}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={{ padding: '6px 10px' }}
            aria-label="Toggle favorites"
          >
            <Heart size={13} fill={showFavoritesOnly ? 'white' : 'none'} />
          </button>
          <button
            className={`chip ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            style={{ padding: '6px 10px' }}
            aria-label="Toggle equipment filter"
          >
            <Filter size={13} />
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginBottom: 14 }}>
        {filtered.length} of {exercises.length} exercises • {gifCount} animated GIFs
      </p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          className="input"
          style={{ paddingLeft: 38, fontSize: '0.82rem' }}
          placeholder="Search by name, muscle, or equipment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Muscle Chips */}
      <div className="chip-scroll" style={{ marginBottom: showFilters ? 8 : 14 }}>
        <button className={`chip ${selectedMuscle === 'all' ? 'active' : ''}`} onClick={() => setSelectedMuscle('all')}>All Muscles</button>
        {MUSCLES.map((m) => (
          <button key={m} className={`chip ${selectedMuscle === m ? 'active' : ''}`} onClick={() => setSelectedMuscle(m)} style={{ textTransform: 'capitalize' }}>{m}</button>
        ))}
      </div>

      {/* Equipment Filter */}
      {showFilters && (
        <div className="chip-scroll" style={{ marginBottom: 14 }}>
          <button className={`chip ${selectedEquipment === 'all' ? 'active' : ''}`} onClick={() => setSelectedEquipment('all')}>All Equipment</button>
          {EQUIPMENT.map((eq) => (
            <button key={eq} className={`chip ${selectedEquipment === eq ? 'active' : ''}`} onClick={() => setSelectedEquipment(eq)} style={{ textTransform: 'capitalize' }}>{eq}</button>
          ))}
        </div>
      )}

      {/* Exercise Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {filtered.map((ex) => {
          const canShowMedia = hasExerciseMedia(ex) && !(ex.id && mediaExhausted[ex.id]);
          const isGif = hasLocalGif(ex);
          const color = getMuscleIcon(ex.primaryMuscles[0]);

          return (
            <div
              key={ex.id}
              className="card"
              onClick={() => setSelectedExercise(ex)}
              title={ex.name}
              style={{ cursor: 'pointer', padding: 0, overflow: 'hidden', position: 'relative' }}
            >
              {/* Thumbnail — GIF primary, multi-frame backup */}
              <div style={{
                width: '100%', height: 116, position: 'relative', overflow: 'hidden',
                background: canShowMedia
                  ? 'radial-gradient(circle at center, rgba(248,250,252,0.92), rgba(226,232,240,0.88))'
                  : `linear-gradient(135deg, ${color}12, ${color}05)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                {canShowMedia ? (
                  <>
                    <ExerciseMedia
                      gifUrl={ex.gifUrl}
                      imageUrls={ex.imageUrls}
                      images={ex.images}
                      alt={ex.name}
                      loading="lazy"
                      frameIntervalMs={950}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        padding: 6,
                        filter: 'contrast(1.03)',
                      }}
                      onExhausted={() => {
                        if (ex.id) setMediaExhausted((prev) => ({ ...prev, [ex.id!]: true }));
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 6,
                        right: 6,
                        padding: '2px 6px',
                        borderRadius: 6,
                        fontSize: '0.56rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        background: isGif ? 'rgba(15, 23, 42, 0.84)' : 'rgba(30, 41, 59, 0.82)',
                        color: isGif ? '#a5b4fc' : '#cbd5e1',
                        border: isGif ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {isGif ? 'GIF' : 'FRAMES'}
                    </span>
                  </>
                ) : (
                  <div style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-md)',
                    background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Dumbbell size={20} color={color} />
                  </div>
                )}

                {/* Favorite button */}
                <button
                  onClick={(e) => toggleFavorite(ex, e)}
                  style={{
                    position: 'absolute', top: 6, left: 6, background: 'rgba(15,23,42,0.72)',
                    border: 'none', borderRadius: 'var(--radius-full)', width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                  }}
                  aria-label={ex.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart size={12} fill={ex.isFavorite ? '#ef4444' : 'none'} color={ex.isFavorite ? '#ef4444' : 'rgba(255,255,255,0.75)'} />
                </button>
              </div>

              {/* Info */}
              <div style={{ padding: '10px 12px' }}>
                <div style={{
                  fontWeight: 600, fontSize: '0.78rem', textTransform: 'capitalize', lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  minHeight: '2.02rem', marginBottom: 6,
                }}>
                  {ex.name}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.62rem', padding: '2px 7px', borderRadius: 'var(--radius-full)',
                    background: `${color}15`, color: color, fontWeight: 600, textTransform: 'capitalize',
                  }}>
                    {ex.primaryMuscles[0]}
                  </span>
                  <span style={{
                    fontSize: '0.62rem', padding: '2px 7px', borderRadius: 'var(--radius-full)',
                    background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)', textTransform: 'capitalize',
                  }}>
                    {ex.equipment}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Exercise Detail Modal */}
      {selectedExercise && (
        <div className="modal-overlay" onClick={() => setSelectedExercise(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'capitalize', flex: 1, letterSpacing: '-0.01em' }}>
                {selectedExercise.name}
              </h2>
              <button onClick={() => setSelectedExercise(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Exercise Visual Preview (GIF primary, animated frames backup) */}
            {hasExerciseMedia(selectedExercise) && !(selectedExercise.id && mediaExhausted[selectedExercise.id]) && (
              <div style={{
                width: '100%', height: 220, borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                marginBottom: 14, background: 'radial-gradient(circle at center, rgba(248,250,252,0.95), rgba(226,232,240,0.9))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border-glass)', position: 'relative',
              }}>
                <ExerciseMedia
                  gifUrl={selectedExercise.gifUrl}
                  imageUrls={selectedExercise.imageUrls}
                  images={selectedExercise.images}
                  alt={selectedExercise.name}
                  loading="eager"
                  frameIntervalMs={700}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                  onMediaModeChange={setDetailMediaMode}
                  onExhausted={() => {
                    if (selectedExercise.id) {
                      setMediaExhausted((prev) => ({ ...prev, [selectedExercise.id!]: true }));
                    }
                  }}
                />
                {detailMediaMode !== 'none' && (
                  <span style={{
                    position: 'absolute', bottom: 8, right: 8,
                    padding: '3px 8px', borderRadius: 'var(--radius-full)',
                    fontSize: '0.62rem', fontWeight: 700,
                    background: 'rgba(15, 23, 42, 0.84)', color: '#a5b4fc',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <Sparkles size={10} />
                    {detailMediaMode === 'gif'
                      ? 'Animated GIF'
                      : detailMediaMode === 'animated-images'
                      ? 'Animated Frames'
                      : 'Reference Image'}
                  </span>
                )}
              </div>
            )}

            {/* Badges */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
              {selectedExercise.primaryMuscles.map((m) => (
                <span key={m} className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{m}</span>
              ))}
              {selectedExercise.secondaryMuscles.map((m) => (
                <span key={m} className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{m}</span>
              ))}
              <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>{selectedExercise.equipment}</span>
            </div>

            {/* Instructions */}
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Instructions</h4>
            <ol style={{ paddingLeft: 18, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedExercise.instructions.map((step, i) => (
                <li key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>

            {/* Tips */}
            {selectedExercise.tips.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Form Tips</h4>
                <ul style={{ paddingLeft: 18, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedExercise.tips.map((tip, i) => (
                    <li key={i} style={{ fontSize: '0.78rem', color: 'var(--warning)', lineHeight: 1.4 }}>{tip}</li>
                  ))}
                </ul>
              </>
            )}

            {/* Video Tutorials */}
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Video Tutorials</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedExercise.videoLinks.map((v, i) => (
                <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.78rem',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Play size={13} color="var(--accent-primary)" />
                    <span style={{ fontWeight: 600 }}>{v.creator}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>— {v.title}</span>
                  </div>
                  <ExternalLink size={13} color="var(--text-tertiary)" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
