'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, Clock, Dumbbell, TrendingUp, Star, Zap, ArrowRight, Share2, Copy, Check } from 'lucide-react';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import { db } from '@/lib/db/schema';

interface WorkoutCompletePageProps {
  onFinish: () => void;
}

export default function WorkoutCompletePage({ onFinish }: WorkoutCompletePageProps) {
  const { totalVolume, totalSets, totalReps, elapsedTime, newPRs, exercises, planName, dayName } = useWorkoutStore();
  const { endWorkout } = useWorkoutStore();
  const [showConfetti, setShowConfetti] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [musclesTrained, setMusclesTrained] = useState<string[]>([]);
  const [prevSession, setPrevSession] = useState<{ volume: number; sets: number; duration: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Confetti animation
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confettiColors = ['#FF3B5C', '#FF8C42', '#FFD166', '#7C6AFF', '#00E5A0', '#4DA6FF', '#FF6EAF'];
    const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number; rotation: number; rotationSpeed: number; shape: 'rect' | 'circle' }[] = [];

    for (let i = 0; i < 150; i++) {
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
    const animate = () => {
      if (frame > 200) { setShowConfetti(false); return; }
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
      requestAnimationFrame(animate);
    };
    animate();
  }, []);

  // Load muscles trained and previous session for comparison
  useEffect(() => {
    const load = async () => {
      // Get muscles from current exercises
      const exIds = exercises.map(e => e.exerciseId).filter(Boolean);
      if (exIds.length === 0) return;
      try {
        const exs = await db.exercises.where('id').anyOf(exIds).toArray();
        const muscles = new Set<string>();
        exs.forEach(e => {
          (e.primaryMuscles || []).forEach(m => muscles.add(m.toLowerCase()));
        });
        setMusclesTrained([...muscles].slice(0, 8));

        // Find previous session with same day name to compare
        if (dayName) {
          const prev = await db.workoutSessions
            .orderBy('startedAt')
            .reverse()
            .filter(s => s.isComplete && s.dayName === dayName)
            .limit(2)
            .toArray();
          // Skip the current session (it might already be saved), take the prior one
          const old = prev.length > 1 ? prev[1] : prev.length === 1 ? prev[0] : null;
          if (old && old.totalVolume > 0) {
            setPrevSession({ volume: old.totalVolume, sets: old.totalSets, duration: old.duration });
          }
        }
      } catch {}
    };
    load();
  }, [exercises, dayName]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  };

  const completedExercises = exercises.filter(e => e.isComplete).length;
  const stats = [
    { icon: TrendingUp, label: 'Total Volume', value: `${totalVolume.toLocaleString()} kg`, color: 'var(--accent-green)' },
    { icon: Dumbbell, label: 'Sets Completed', value: totalSets.toString(), color: 'var(--accent-purple)' },
    { icon: Zap, label: 'Total Reps', value: totalReps.toString(), color: 'var(--accent-orange)' },
    { icon: Clock, label: 'Duration', value: formatTime(elapsedTime), color: 'var(--accent-blue)' },
  ];

  // Volume change vs last time
  const volumeChange = prevSession ? ((totalVolume - prevSession.volume) / prevSession.volume * 100) : null;

  const handleShare = useCallback(async () => {
    const text = [
      `🏋️ ${dayName || planName || 'Workout'} Complete!`,
      `⏱ ${formatTime(elapsedTime)}`,
      `📊 ${totalVolume.toLocaleString()}kg volume`,
      `💪 ${totalSets} sets, ${totalReps} reps`,
      `🎯 ${completedExercises} exercises`,
      newPRs.length > 0 ? `🏆 ${newPRs.length} new PR${newPRs.length > 1 ? 's' : ''}!` : '',
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
  }, [dayName, planName, elapsedTime, totalVolume, totalSets, totalReps, completedExercises, newPRs]);

  const handleFinish = () => {
    endWorkout();
    onFinish();
  };

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 20px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Confetti canvas */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10 }} />

      {/* Background radial glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(255,59,92,0.08) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Trophy Animation */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8, damping: 10, delay: 0.2 }}
        className="celebrate-in"
        style={{
          width: 100, height: 100, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(255,209,102,0.2), rgba(255,140,66,0.15))',
          border: '2px solid rgba(255,209,102,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, position: 'relative',
          boxShadow: '0 0 40px rgba(255,209,102,0.15)',
        }}
      >
        <Trophy size={44} color="#FFD166" />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: '2px solid rgba(255,209,102,0.2)',
          }}
        />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="gradient-text font-display"
        style={{ fontSize: 38, letterSpacing: 3, marginBottom: 4 }}
      >
        WORKOUT COMPLETE
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 28, fontWeight: 500 }}
      >
        {completedExercises} exercise{completedExercises !== 1 ? 's' : ''} crushed 💪
      </motion.p>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, width: '100%', maxWidth: 400, marginBottom: 16 }}
      >
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 + i * 0.1 }}
            className="stat-card"
            style={{ alignItems: 'center', textAlign: 'center', position: 'relative' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: stat.color, borderRadius: '20px 20px 0 0', opacity: 0.6 }} />
            <stat.icon size={20} color={stat.color} style={{ marginBottom: 4, marginTop: 4 }} />
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Compare to last session */}
      {volumeChange !== null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          style={{
            width: '100%', maxWidth: 400, marginBottom: 16, padding: '12px 16px',
            borderRadius: 14, background: volumeChange >= 0 ? 'rgba(16,232,154,0.06)' : 'rgba(255,61,90,0.06)',
            border: `1px solid ${volumeChange >= 0 ? 'rgba(16,232,154,0.2)' : 'rgba(255,61,90,0.2)'}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>vs Last {dayName || 'Session'}</div>
          <div className="font-mono" style={{
            fontSize: 18, fontWeight: 800,
            color: volumeChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
          }}>
            {volumeChange >= 0 ? '↑' : '↓'} {Math.abs(Math.round(volumeChange))}% volume
          </div>
        </motion.div>
      )}

      {/* Muscles Trained */}
      {musclesTrained.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15 }}
          style={{ width: '100%', maxWidth: 400, marginBottom: 16 }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Muscles Trained</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {musclesTrained.map(m => (
              <span key={m} style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                color: 'var(--accent-purple)', textTransform: 'capitalize',
              }}>{m}</span>
            ))}
          </div>
        </motion.div>
      )}

      {/* PRs */}
      {newPRs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          style={{ width: '100%', maxWidth: 400, marginBottom: 16 }}
        >
          <div style={{
            padding: 18, borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(255,209,102,0.08), rgba(255,140,66,0.05))',
            border: '1px solid rgba(255,209,102,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Star size={18} color="var(--accent-yellow)" />
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent-yellow)' }}>
                New Personal Records! 🎉
              </span>
            </div>
            {newPRs.map((pr, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{pr.exerciseName}</span>
                <span className="font-mono" style={{ fontSize: 14, color: 'var(--accent-yellow)', fontWeight: 800 }}>{pr.weight}kg × {pr.reps}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
        style={{ width: '100%', maxWidth: 400, display: 'flex', gap: 10 }}
      >
        <button onClick={handleShare}
          className="btn-secondary"
          style={{ minHeight: 54, borderRadius: 16, flex: '0 0 54px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {copied ? <Check size={18} color="var(--accent-green)" /> : <Share2 size={18} />}
        </button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="btn-primary animate-glow"
          onClick={handleFinish}
          style={{ fontSize: 17, padding: '18px 24px', borderRadius: 16, flex: 1 }}
        >
          Continue <ArrowRight size={18} />
        </motion.button>
      </motion.div>
    </div>
  );
}
