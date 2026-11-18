'use client';

import { useState, useEffect } from 'react';
import { useUIStore } from '@/lib/store/uiStore';
import { Dumbbell, RefreshCw, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

interface SeedingScreenProps {
  onRetry?: () => void;
  error?: string | null;
}

export default function SeedingScreen({ onRetry, error }: SeedingScreenProps) {
  const { seedingProgress, seedingMessage } = useUIStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="seeding-screen">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', width: 300, height: 300,
          border: '1px solid rgba(255,59,92,0.05)', borderRadius: '50%',
        }}
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', width: 450, height: 450,
          border: '1px solid rgba(124,106,255,0.04)', borderRadius: '50%',
        }}
      />

      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8, damping: 12 }}
        className="streak-ring"
        style={{
          width: 88, height: 88, borderRadius: '50%',
          background: error ? 'rgba(255,61,90,0.15)' : 'var(--gradient-fire)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: error ? '0 0 50px rgba(255,61,90,0.2)' : '0 0 50px var(--glow-red), 0 0 100px rgba(255,59,92,0.1)',
        }}
      >
        {error ? <AlertTriangle size={38} color="#FF3D5A" /> : <Dumbbell size={38} color="white" strokeWidth={2.5} />}
      </motion.div>

      <motion.h1
        className="font-display gradient-text"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ fontSize: 42, letterSpacing: 4 }}
      >
        IRONFORGE
      </motion.h1>

      {error ? (
        <>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: 'var(--accent-red)', fontSize: 13, fontWeight: 600, textAlign: 'center', maxWidth: 300, lineHeight: 1.5, marginTop: 4 }}
          >
            {error}
          </motion.p>
          {onRetry && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={onRetry}
              style={{
                background: 'var(--gradient-fire)', border: 'none', color: 'white',
                padding: '14px 32px', borderRadius: 14, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
                boxShadow: '0 4px 20px var(--glow-red)',
              }}
            >
              <RefreshCw size={16} /> Reset & Try Again
            </motion.button>
          )}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.5 }}
            style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', maxWidth: 260, lineHeight: 1.5, marginTop: 4 }}
          >
            This will clear any corrupted data and set up fresh. Your exercise library will be reloaded.
          </motion.p>
        </>
      ) : (
        <>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, letterSpacing: 0.3 }}
          >
            Forge Your Best Self
          </motion.p>

          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 220 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            <div className="seeding-progress-bar">
              <motion.div
                className="seeding-progress-fill"
                animate={{ width: `${seedingProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, textAlign: 'center', maxWidth: 280 }}
          >
            {seedingMessage || 'Setting up your workout experience...'}
          </motion.p>

          {elapsed > 12 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 8 }}
            >
              <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                Taking longer than expected...
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  style={{
                    background: 'var(--bg-glass)', border: '1px solid var(--border-bright)',
                    color: 'var(--text-secondary)', padding: '10px 24px', borderRadius: 12,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <RefreshCw size={14} /> Reset & Retry
                </button>
              )}
            </motion.div>
          )}
        </>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.2 }}
        style={{ color: 'var(--text-muted)', fontSize: 11, position: 'absolute', bottom: 40, fontWeight: 500, letterSpacing: 1 }}
      >
        2,240+ EXERCISES • ANIMATED DEMOS • 19 PRO PROGRAMS
      </motion.p>
    </div>
  );
}
