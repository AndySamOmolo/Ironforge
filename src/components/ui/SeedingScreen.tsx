'use client';

import { useUIStore } from '@/lib/store/uiStore';
import { Dumbbell } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SeedingScreen() {
  const { seedingProgress, seedingMessage } = useUIStore();

  return (
    <div className="seeding-screen">
      {/* Animated background rings */}
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
          background: 'var(--gradient-fire)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 50px var(--glow-red), 0 0 100px rgba(255,59,92,0.1)',
        }}
      >
        <Dumbbell size={38} color="white" strokeWidth={2.5} />
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
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.2 }}
        style={{ color: 'var(--text-muted)', fontSize: 11, position: 'absolute', bottom: 40, fontWeight: 500, letterSpacing: 1 }}
      >
        870+ EXERCISES • REAL IMAGES • PRO PROGRAMS
      </motion.p>
    </div>
  );
}
