'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, Dumbbell, TrendingUp, Star, Zap, ArrowRight, Share2, Check, ArrowLeft } from 'lucide-react';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { useUserStore } from '@/lib/store/userStore';
import { db } from '@/lib/db/schema';

interface WorkoutCompletePageProps {
  onFinish: () => void;
}

export default function WorkoutCompletePage({ onFinish }: WorkoutCompletePageProps) {
  const { totalVolume, totalSets, totalReps, elapsedTime, newPRs, exercises, planName, dayName, sessionId, endWorkout } = useWorkoutStore();
  const { unitSystem } = useUserStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [musclesTrained, setMusclesTrained] = useState<string[]>([]);
  const [prevSession, setPrevSession] = useState<{ volume: number; sets: number; duration: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [sessionNote, setSessionNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confettiColors = ['#FF3B5C', '#FF8C42', '#FFD166', '#7C6AFF', '#00E5A0', '#4DA6FF', '#FF6EAF'];
    const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number; rotation: number; rotationSpeed: number; shape: 'rect' | 'circle' }[] = [];

    for (let i = 0; i < 140; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        size: Math.random() * 8 + 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }

    let frame = 0;
    let rafId = 0;
    const animate = () => {
      if (frame > 200) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.rotation += p.rotationSpeed;
        p.vx *= 0.99;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / 200);

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      frame++;
      rafId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const load = async () => {
      const exIds = exercises.map(e => e.exerciseId).filter(Boolean);
      if (exIds.length === 0) return;
      try {
        const exs = await db.exercises.where('id').anyOf(exIds).toArray();
        const muscles = new Set<string>();
        exs.forEach(e => {
          (e.primaryMuscles || []).forEach(m => muscles.add(m.toLowerCase()));
        });
        setMusclesTrained([...muscles].slice(0, 8));

        if (dayName) {
          const prev = await db.workoutSessions
            .orderBy('startedAt')
            .reverse()
            .filter(s => s.isComplete && s.dayName === dayName)
            .limit(2)
            .toArray();
          const old = prev.length > 1 ? prev[1] : null;
          if (old && old.totalVolume > 0) {
            setPrevSession({ volume: old.totalVolume, sets: old.totalSets, duration: old.duration });
          }
        }
      } catch (err) {
        console.warn('Failed to load workout completion metadata:', err);
      }
    };
    load();
  }, [exercises, dayName]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  };

  const completedExercises = exercises.filter(e => e.isComplete || e.sets.some(s => s.isComplete)).length;
  const stats = [
    { icon: TrendingUp, label: 'Total Volume', value: `${totalVolume.toLocaleString()} ${unitLabel}`, color: 'var(--accent-green)' },
    { icon: Dumbbell, label: 'Sets Completed', value: totalSets.toString(), color: 'var(--accent-purple)' },
    { icon: Zap, label: 'Total Reps', value: totalReps.toString(), color: 'var(--accent-orange)' },
    { icon: Clock, label: 'Duration', value: formatTime(elapsedTime), color: 'var(--accent-blue)' },
  ];

  const volumeChange = prevSession ? ((totalVolume - prevSession.volume) / prevSession.volume * 100) : null;

  const handleShare = useCallback(async () => {
    const text = [
      `🏋️ ${dayName || planName || 'Workout'} Complete! (${'⭐'.repeat(rating)})`,
      `⏱ ${formatTime(elapsedTime)}`,
      `📊 ${totalVolume.toLocaleString()}${unitLabel} volume`,
      `💪 ${totalSets} sets, ${totalReps} reps`,
      `🎯 ${completedExercises} exercises`,
      newPRs.length > 0 ? `🏆 ${newPRs.length} new PR${newPRs.length > 1 ? 's' : ''}!` : '',
      sessionNote.trim() ? `📝 ${sessionNote.trim()}` : '',
      '',
      '#IronForge',
    ].filter(Boolean).join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  }, [dayName, planName, elapsedTime, totalVolume, totalSets, totalReps, completedExercises, newPRs, rating, sessionNote, unitLabel]);

  const handleFinish = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);

    if (sessionId) {
      try {
        const existing = await db.workoutSessions.get(sessionId);
        if (existing) {
          const baseNotes = existing.notes || '';
          const extraNote = sessionNote.trim();
          const mergedNotes = extraNote && !baseNotes.includes(extraNote)
            ? [baseNotes, extraNote].filter(Boolean).join(' — ')
            : baseNotes || undefined;
          await db.workoutSessions.update(sessionId, {
            rating,
            notes: mergedNotes,
          });
        }
      } catch (err) {
        console.warn('Failed to save session rating/notes:', err);
      }
    }
    endWorkout();
    onFinish();
  }, [sessionId, rating, sessionNote, endWorkout, onFinish]);

  return (
    <div
      className="active-workout-container"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px 20px', position: 'relative', overflow: 'hidden',
      }}
    >
      <style>{`.active-workout-container { min-height: 100vh; min-height: 100dvh; }`}</style>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10 }} />

      {/* Top Back / Done bar */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, position: 'relative', zIndex: 12 }}>
        <button
          onClick={handleFinish}
          className="btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={14} /> Home
        </button>
        <span
          role="status"
          aria-live="polite"
          className="badge"
          style={{ background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)', color: 'var(--accent-green)', border: '1px solid color-mix(in srgb, var(--accent-green) 25%, transparent)', fontSize: 10 }}
        >
          ✓ Workout Saved
        </span>
      </div>

      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500,
        background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-red) 8%, transparent) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8, damping: 10, delay: 0.2 }}
        className="celebrate-in"
        style={{
          width: 88, height: 88, borderRadius: '50%',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-yellow) 20%, transparent), color-mix(in srgb, var(--accent-orange) 15%, transparent))',
          border: '2px solid color-mix(in srgb, var(--accent-yellow) 30%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, position: 'relative',
          boxShadow: '0 0 40px color-mix(in srgb, var(--accent-yellow) 15%, transparent)',
        }}
      >
        <Trophy size={40} color="#FFD166" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="gradient-text font-display"
        style={{ fontSize: 34, letterSpacing: 2, marginBottom: 4, textAlign: 'center' }}
      >
        WORKOUT COMPLETE
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, fontWeight: 500 }}
      >
        {completedExercises} exercise{completedExercises !== 1 ? 's' : ''} crushed 💪
      </motion.p>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, width: '100%', maxWidth: 400, marginBottom: 14 }}
      >
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.08 }}
            className="stat-card"
            style={{ alignItems: 'center', textAlign: 'center', position: 'relative' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: stat.color, borderRadius: '20px 20px 0 0', opacity: 0.6 }} />
            <stat.icon size={18} color={stat.color} style={{ marginBottom: 2, marginTop: 2 }} />
            <div className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Compare to last session */}
      {volumeChange !== null && (
        <div
          style={{
            width: '100%', maxWidth: 400, marginBottom: 14, padding: '10px 16px',
            borderRadius: 14, background: volumeChange >= 0 ? 'color-mix(in srgb, var(--accent-green) 6%, transparent)' : 'color-mix(in srgb, var(--accent-red) 6%, transparent)',
            border: `1px solid ${volumeChange >= 0 ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)' : 'color-mix(in srgb, var(--accent-red) 20%, transparent)'}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>vs Last {dayName || 'Session'}</div>
          <div className="font-mono" style={{
            fontSize: 16, fontWeight: 800,
            color: volumeChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
          }}>
            {volumeChange >= 0 ? '↑' : '↓'} {Math.abs(Math.round(volumeChange))}% volume
          </div>
        </div>
      )}

      {/* PRs */}
      {newPRs.length > 0 && (
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 14 }}>
          <div style={{
            padding: 14, borderRadius: 16,
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-yellow) 10%, transparent), color-mix(in srgb, var(--accent-orange) 6%, transparent))',
            border: '1px solid color-mix(in srgb, var(--accent-yellow) 25%, transparent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Star size={16} color="var(--accent-yellow)" />
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent-yellow)' }}>
                New Personal Records! 🎉
              </span>
            </div>
            {newPRs.map((pr, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
                <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{pr.exerciseName}</span>
                <span className="font-mono" style={{ fontSize: 13, color: 'var(--accent-yellow)', fontWeight: 800 }}>{pr.weight}{unitLabel} × {pr.reps}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Muscles Trained */}
      {musclesTrained.length > 0 && (
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Muscles Trained</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {musclesTrained.map(m => (
              <span key={m} style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: 'color-mix(in srgb, var(--accent-purple) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-purple) 20%, transparent)',
                color: 'var(--accent-purple)', textTransform: 'capitalize',
              }}>{m}</span>
            ))}
          </div>
        </div>
      )}

      {/* Session Rating & Notes */}
      <div className="card" style={{ width: '100%', maxWidth: 400, marginBottom: 16, padding: 14 }}>
        <div className="section-label" style={{ marginBottom: 8, textAlign: 'center' }}>Rate Session & Add Note</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              aria-label={`Rate workout ${star} out of 5 stars`}
              aria-pressed={rating === star}
              onClick={() => setRating(star)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <Star size={24} color="#FBBF24" fill={star <= rating ? '#FBBF24' : 'transparent'} />
            </button>
          ))}
        </div>
        <input
          value={sessionNote}
          onChange={e => setSessionNote(e.target.value)}
          placeholder="How did the workout feel? (Optional)"
          style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', gap: 10 }}>
        <button onClick={handleShare}
          aria-label="Share workout summary"
          className="btn-secondary"
          style={{ minHeight: 52, borderRadius: 16, flex: '0 0 54px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {copied ? <Check size={18} color="var(--accent-green)" /> : <Share2 size={18} />}
        </button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="btn-primary animate-glow"
          onClick={handleFinish}
          disabled={isSaving}
          style={{ fontSize: 16, padding: '16px 24px', borderRadius: 16, flex: 1, opacity: isSaving ? 0.7 : 1 }}
        >
          {isSaving ? 'Continuing...' : 'Done & Continue'} <ArrowRight size={18} />
        </motion.button>
      </div>
    </div>
  );
}
