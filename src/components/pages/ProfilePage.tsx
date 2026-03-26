'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, Dumbbell, Scale, Calculator, Trash2, Download, ChevronRight, Check, X, Plus, TrendingUp, Moon, Volume2 } from 'lucide-react';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import type { BodyWeight } from '@/lib/types';

const ALL_EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'body weight', 'machine', 'leverage machine',
  'band', 'kettlebell', 'medicine ball', 'smith machine', 'ez barbell',
  'olympic barbell', 'trap bar', 'stability ball',
];

export default function ProfilePage() {
  const {
    name, setName, unitSystem, setUnitSystem, barWeight, setBarWeight,
    equipment, setEquipment, defaultRestTime, setDefaultRestTime,
    soundEnabled, toggleSound, hapticEnabled, toggleHaptic,
  } = useUserStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'equipment' | 'tools' | 'data'>('profile');
  const [bodyWeights, setBodyWeights] = useState<BodyWeight[]>([]);
  const [newWeight, setNewWeight] = useState('');
  const [showOneRM, setShowOneRM] = useState(false);
  const [oneRMWeight, setOneRMWeight] = useState('');
  const [oneRMReps, setOneRMReps] = useState('');

  useEffect(() => { loadBodyWeights(); }, []);

  const loadBodyWeights = async () => {
    try {
      const weights = await db.bodyWeight.orderBy('date').reverse().limit(30).toArray();
      setBodyWeights(weights);
    } catch {}
  };

  const addBodyWeight = async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) return;
    await db.bodyWeight.add({ date: new Date(), weight: w, unit: unitSystem === 'metric' ? 'kg' : 'lbs' });
    setNewWeight('');
    loadBodyWeights();
  };

  const calcOneRM = useMemo(() => {
    const w = parseFloat(oneRMWeight);
    const r = parseInt(oneRMReps);
    if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0) return null;
    return {
      epley: Math.round(w * (1 + r / 30)),
      brzycki: Math.round(w * (36 / (37 - r))),
      lombardi: Math.round(w * Math.pow(r, 0.1)),
    };
  }, [oneRMWeight, oneRMReps]);

  const toggleEquipment = (eq: string) => {
    const updated = equipment.includes(eq) ? equipment.filter(e => e !== eq) : [...equipment, eq];
    setEquipment(updated);
    db.userProfile.toArray().then(profiles => {
      if (profiles[0]?.id) db.userProfile.update(profiles[0].id, { equipment: updated });
    });
  };

  const handleFactoryReset = async () => {
    if (!confirm('This will delete ALL data. Are you sure?')) return;
    await db.delete();
    window.location.reload();
  };

  const saveProfileField = async (field: string, value: any) => {
    const profiles = await db.userProfile.toArray();
    if (profiles[0]?.id) await db.userProfile.update(profiles[0].id, { [field]: value });
  };

  // Body weight chart (simple SVG sparkline)
  const weightChartPoints = useMemo(() => {
    if (bodyWeights.length < 2) return '';
    const sorted = [...bodyWeights].reverse();
    const min = Math.min(...sorted.map(w => w.weight));
    const max = Math.max(...sorted.map(w => w.weight));
    const range = max - min || 1;
    return sorted.map((w, i) => {
      const x = (i / (sorted.length - 1)) * 280 + 10;
      const y = 70 - ((w.weight - min) / range) * 60;
      return `${x},${y}`;
    }).join(' ');
  }, [bodyWeights]);

  return (
    <div className="page-container">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span className="gradient-text">Settings</span>
        </h1>
      </motion.div>

      {/* Tab Bar */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {(['profile', 'equipment', 'tools', 'data'] as const).map(tab => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)} style={{ textTransform: 'capitalize' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Name */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <User size={18} color="var(--accent-purple)" />
            <div style={{ flex: 1 }}>
              <div className="section-label">Name</div>
              <input value={name} onChange={e => { setName(e.target.value); saveProfileField('name', e.target.value); }}
                style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, outline: 'none', fontFamily: 'inherit', padding: 0 }} />
            </div>
          </div>

          {/* Unit System */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Scale size={18} color="var(--accent-green)" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Units</span>
            </div>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 'var(--r-sm)', padding: 3 }}>
              {(['metric', 'imperial'] as const).map(sys => (
                <button key={sys} onClick={() => { setUnitSystem(sys); saveProfileField('unitSystem', sys); }}
                  style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: unitSystem === sys ? 'var(--gradient-fire)' : 'transparent', color: unitSystem === sys ? 'white' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {sys}
                </button>
              ))}
            </div>
          </div>

          {/* Bar Weight */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Dumbbell size={18} color="var(--accent-orange)" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Bar Weight</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[15, 20, 25].map(w => (
                <button key={w} onClick={() => { setBarWeight(w); saveProfileField('barWeight', w); }}
                  style={{ padding: '6px 12px', borderRadius: 8, border: barWeight === w ? 'none' : '1px solid var(--border)', background: barWeight === w ? 'var(--gradient-ocean)' : 'transparent', color: barWeight === w ? 'white' : 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {w}kg
                </button>
              ))}
            </div>
          </div>

          {/* Rest Time */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Settings size={18} color="var(--accent-cyan)" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Rest Timer</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[60, 90, 120, 180].map(t => (
                <button key={t} onClick={() => { setDefaultRestTime(t); saveProfileField('defaultRestTime', t); }}
                  style={{ padding: '6px 10px', borderRadius: 8, border: defaultRestTime === t ? 'none' : '1px solid var(--border)', background: defaultRestTime === t ? 'var(--gradient-fire)' : 'transparent', color: defaultRestTime === t ? 'white' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {t}s
                </button>
              ))}
            </div>
          </div>

          {/* Sound */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Volume2 size={18} color="var(--accent-yellow)" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Sound Effects</span>
            </div>
            <button onClick={() => { toggleSound(); saveProfileField('soundEnabled', !soundEnabled); }}
              style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: soundEnabled ? 'var(--accent-green)' : 'var(--bg-input)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: soundEnabled ? 23 : 3, transition: 'left 0.2s' }} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            Select equipment you have access to. Workout plans will automatically filter exercises to match.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {ALL_EQUIPMENT.map(eq => (
              <button key={eq} className={`equipment-check ${equipment.includes(eq) ? 'selected' : ''}`} onClick={() => toggleEquipment(eq)}>
                <div className="equipment-check-box">
                  {equipment.includes(eq) && <Check size={12} color="white" />}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{eq}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tools Tab */}
      {activeTab === 'tools' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Body Weight Tracker */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={16} color="var(--accent-green)" /> Body Weight
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder={`Weight (${unitSystem === 'metric' ? 'kg' : 'lbs'})`} type="number" step="0.1"
                style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={addBodyWeight} style={{ padding: '10px 16px', background: 'var(--gradient-mint)', border: 'none', borderRadius: 'var(--r-sm)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={16} />
              </button>
            </div>
            {bodyWeights.length > 1 && (
              <svg width="100%" viewBox="0 0 300 80" style={{ marginBottom: 8 }}>
                <polyline fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={weightChartPoints} />
                <polyline fill="url(#weightGrad)" stroke="none" points={`10,70 ${weightChartPoints} 290,70`} />
                <defs><linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(16,232,154,0.15)" /><stop offset="100%" stopColor="rgba(16,232,154,0)" /></linearGradient></defs>
              </svg>
            )}
            {bodyWeights.slice(0, 5).map(bw => (
              <div key={bw.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{new Date(bw.date).toLocaleDateString()}</span>
                <span className="font-mono" style={{ fontWeight: 700 }}>{bw.weight} {bw.unit}</span>
              </div>
            ))}
          </div>

          {/* 1RM Calculator */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calculator size={16} color="var(--accent-purple)" /> 1RM Calculator
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={oneRMWeight} onChange={e => setOneRMWeight(e.target.value)} placeholder="Weight" type="number"
                style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              <input value={oneRMReps} onChange={e => setOneRMReps(e.target.value)} placeholder="Reps" type="number"
                style={{ width: 80, padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            {calcOneRM && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { label: 'Epley', value: calcOneRM.epley, color: 'var(--accent-red)' },
                  { label: 'Brzycki', value: calcOneRM.brzycki, color: 'var(--accent-purple)' },
                  { label: 'Lombardi', value: calcOneRM.lombardi, color: 'var(--accent-green)' },
                ].map(est => (
                  <div key={est.label} style={{ padding: 10, borderRadius: 'var(--r-sm)', background: 'var(--bg-glass)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: est.color }}>{est.value}</div>
                    <div className="section-label" style={{ marginTop: 2 }}>{est.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Percentage table */}
            {calcOneRM && (
              <div style={{ marginTop: 12 }}>
                <div className="section-label" style={{ marginBottom: 6 }}>Training Percentages (Epley)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {[95, 90, 85, 80, 75, 70, 65, 60].map(pct => (
                    <div key={pct} style={{ padding: '6px 4px', borderRadius: 6, background: 'var(--bg-glass)', border: '1px solid var(--border)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct}%</div>
                      <div className="font-mono" style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(calcOneRM.epley * pct / 100)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Plate Calculator */}
          <PlateCalculator barWeight={barWeight} unit={unitSystem} />
        </motion.div>
      )}

      {/* Data Tab */}
      {activeTab === 'data' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="card" onClick={handleFactoryReset} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid rgba(255,61,90,0.15)' }}>
            <Trash2 size={18} color="var(--accent-red)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>Factory Reset</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Delete all data and reseed exercises</div>
            </div>
          </button>
        </motion.div>
      )}
    </div>
  );
}

/* ===== PLATE CALCULATOR ===== */
function PlateCalculator({ barWeight, unit }: { barWeight: number; unit: string }) {
  const [targetWeight, setTargetWeight] = useState('');
  const plates = useMemo(() => {
    const target = parseFloat(targetWeight);
    if (isNaN(target) || target <= barWeight) return [];
    const perSide = (target - barWeight) / 2;
    const available = unit === 'metric' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5];
    const result: { weight: number; color: string }[] = [];
    const colors: Record<number, string> = { 25: '#FF3D5A', 20: '#38BDF8', 15: '#FBBF24', 10: '#10E89A', 5: '#F472B6', 2.5: '#8B5CF6', 1.25: '#22D3EE', 45: '#FF3D5A', 35: '#FBBF24' };
    let remaining = perSide;
    for (const plate of available) {
      while (remaining >= plate) { result.push({ weight: plate, color: colors[plate] || '#888' }); remaining -= plate; }
    }
    return result;
  }, [targetWeight, barWeight, unit]);

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Dumbbell size={16} color="var(--accent-red)" /> Plate Calculator
      </h3>
      <input value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder={`Target weight (${unit === 'metric' ? 'kg' : 'lbs'})`} type="number"
        style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 12 }} />
      {plates.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Each side ({((parseFloat(targetWeight) - barWeight) / 2).toFixed(1)} {unit === 'metric' ? 'kg' : 'lbs'}/side)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '12px 0' }}>
            {/* Bar */}
            <div style={{ height: 8, width: 60, background: '#666', borderRadius: 2 }} />
            {/* Plates */}
            {plates.map((p, i) => (
              <div key={i} style={{ height: Math.max(24, 20 + p.weight * 1.2), width: Math.max(10, 6 + p.weight * 0.3), background: p.color, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800, color: 'white', writingMode: 'vertical-lr', textOrientation: 'mixed' }}>
                {p.weight}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {plates.map((p, i) => (
              <span key={i} className="badge" style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30`, fontSize: 12, fontWeight: 700 }}>
                {p.weight}{unit === 'metric' ? 'kg' : 'lbs'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
