'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  User, Dumbbell, Scale, Calculator, Trash2, Download, Check, X, Plus,
  Volume2, Type, RotateCcw, Vibrate, Smartphone, Timer,
  ArrowUp, Database, Zap, Bell, Sparkles, Eye, LayoutGrid, Sliders, Shuffle, Clock,
} from 'lucide-react';
import { useReminderStore } from '@/lib/store/reminderStore';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import type { BodyWeight, BodyMeasurement, WaterLog } from '@/lib/types';
import { ALL_EQUIPMENT, EQUIPMENT_PRESETS } from '@/lib/utils/exerciseResolver';
import { calculatePlates, getPlateColor } from '@/lib/utils/plateCalculator';
import {
  THEME_OPTIONS,
  CUSTOM_ACCENT_OPTIONS,
  FONT_OPTIONS,
  DEFAULT_APPEARANCE,
  applyAppearanceToDOM,
} from '@/lib/utils/appearance';

const FONT_SIZE_OPTIONS = [
  { id: 'xs', label: 'Tiny', sample: 11 },
  { id: 'small', label: 'Small', sample: 13 },
  { id: 'normal', label: 'Normal', sample: 15 },
  { id: 'large', label: 'Large', sample: 18 },
  { id: 'xlarge', label: 'X-Large', sample: 21 },
];

const ACCENT_INTENSITY_OPTIONS = [
  { id: 'subtle', label: 'Subtle', icon: '🌕' },
  { id: 'normal', label: 'Normal', icon: '⭐' },
  { id: 'vibrant', label: 'Vibrant', icon: '✨' },
];

const COLOR_MODE_OPTIONS = [
  { id: 'normal', label: 'Normal', icon: '👁️' },
  { id: 'protanopia', label: 'Red-Blind', icon: '🔴' },
  { id: 'deuteranopia', label: 'Green-Blind', icon: '🟢' },
  { id: 'tritanopia', label: 'Blue-Blind', icon: '🔵' },
  { id: 'monochrome', label: 'Mono', icon: '⚫' },
];

const CONTRAST_OPTIONS = [
  { id: 'normal', label: 'Standard', icon: '🌓' },
  { id: 'high', label: 'High', icon: '◼️' },
  { id: 'max', label: 'Ultra AAA', icon: '⚡' },
];

function getLocalTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ProfilePage() {
  const store = useUserStore();
  const {
    name, setName, unitSystem, setUnitSystem, barWeight, setBarWeight,
    dumbbellWeight, setDumbbellWeight,
    equipment, setEquipment, defaultRestTime, setDefaultRestTime,
    restTimerEnabled, toggleRestTimer,
    soundEnabled, toggleSound, hapticEnabled, toggleHaptic,
    theme, customAccent, font, fontSize, numberFont, headerStyle,
    density, gridColumns, buttonStyle, cardStyle, borderRadius,
    animationLevel, navStyle, bgStyle, accentIntensity, glowIntensity,
    borderThickness, glassOpacity, contrastMode, colorMode, textShadow,
    weightIncrement, autoAdvance, autoStartRest, keepScreenOn,
    showTimer, countdownSound, exerciseVariety,
    showDailyQuote, showActivityHeatmap, showFeatureCards, showLastWorkout,
    setField, loadFromProfile,
  } = store;

  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'workout' | 'tools' | 'data'>('profile');
  const [bodyWeights, setBodyWeights] = useState<BodyWeight[]>([]);
  const [newWeight, setNewWeight] = useState('');
  const [oneRMWeight, setOneRMWeight] = useState('');
  const [oneRMReps, setOneRMReps] = useState('');
  const [dbStats, setDbStats] = useState({ exercises: 0, sessions: 0, plans: 0, size: '' });
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [measForm, setMeasForm] = useState({ bodyFat: '', waist: '', chest: '', arms: '', thighs: '' });
  const [todayWater, setTodayWater] = useState<WaterLog | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);

  useEffect(() => {
    void loadBodyWeights();
    void loadMeasurements();
    void loadTodayWater();
    void loadDBStats();
  }, []);

  const loadMeasurements = async () => {
    try {
      const list = await db.measurements.orderBy('date').reverse().limit(15).toArray();
      setMeasurements(list);
    } catch {}
  };

  const addMeasurement = async () => {
    const bf = parseFloat(measForm.bodyFat);
    const waist = parseFloat(measForm.waist);
    const chest = parseFloat(measForm.chest);
    const arms = parseFloat(measForm.arms);
    const thighs = parseFloat(measForm.thighs);
    if ([bf, waist, chest, arms, thighs].every(v => isNaN(v) || v <= 0)) return;
    await db.measurements.add({
      date: new Date(),
      bodyFat: !isNaN(bf) && bf > 0 ? bf : undefined,
      waist: !isNaN(waist) && waist > 0 ? waist : undefined,
      chest: !isNaN(chest) && chest > 0 ? chest : undefined,
      arms: !isNaN(arms) && arms > 0 ? arms : undefined,
      thighs: !isNaN(thighs) && thighs > 0 ? thighs : undefined,
    });
    setMeasForm({ bodyFat: '', waist: '', chest: '', arms: '', thighs: '' });
    void loadMeasurements();
  };

  const deleteMeasurement = async (id?: number) => {
    if (!id) return;
    await db.measurements.delete(id);
    void loadMeasurements();
  };

  const loadTodayWater = async () => {
    try {
      const todayKey = getLocalTodayKey();
      const existing = await db.waterLogs.where('date').equals(todayKey).first();
      if (existing) {
        setTodayWater(existing);
      } else {
        setTodayWater({ date: todayKey, glasses: 0, targetGlasses: 8 });
      }
    } catch {}
  };

  const updateWater = async (delta: number) => {
    const todayKey = getLocalTodayKey();
    const current = todayWater || { date: todayKey, glasses: 0, targetGlasses: 8 };
    const nextGlasses = Math.max(0, current.glasses + delta);
    const existing = await db.waterLogs.where('date').equals(todayKey).first();
    if (existing?.id) {
      await db.waterLogs.update(existing.id, { glasses: nextGlasses });
      setTodayWater({ ...existing, glasses: nextGlasses });
    } else {
      const id = await db.waterLogs.add({ date: todayKey, glasses: nextGlasses, targetGlasses: current.targetGlasses || 8 });
      setTodayWater({ id, date: todayKey, glasses: nextGlasses, targetGlasses: current.targetGlasses || 8 });
    }
  };

  const loadBodyWeights = async () => {
    try {
      const weights = await db.bodyWeight.orderBy('date').reverse().limit(30).toArray();
      setBodyWeights(weights);
    } catch {}
  };

  const deleteBodyWeight = async (id?: number) => {
    if (!id) return;
    await db.bodyWeight.delete(id);
    void loadBodyWeights();
  };

  const loadDBStats = async () => {
    try {
      const [exercises, sessions, plans] = await Promise.all([
        db.exercises.count(),
        db.workoutSessions.count(),
        db.workoutPlans.count(),
      ]);
      const estimate = await navigator?.storage?.estimate?.();
      const usageKB = estimate?.usage ? Math.round(estimate.usage / 1024) : 0;
      const sizeStr = usageKB > 1024 ? `${(usageKB / 1024).toFixed(1)} MB` : `${usageKB} KB`;
      setDbStats({ exercises, sessions, plans, size: sizeStr });
    } catch {}
  };

  const saveProfileFields = async (updates: Record<string, any>) => {
    try {
      const profiles = await db.userProfile.toArray();
      if (profiles[0]?.id) {
        await db.userProfile.update(profiles[0].id, updates);
      }
    } catch {}
  };

  const updateAppearance = (updates: Partial<typeof DEFAULT_APPEARANCE>) => {
    const nextAppearance = {
      theme,
      customAccent,
      font,
      fontSize,
      numberFont,
      headerStyle,
      density,
      compactMode: (updates.density ?? density) === 'compact',
      gridColumns,
      buttonStyle,
      cardStyle,
      borderRadius,
      animationLevel,
      navStyle,
      bgStyle,
      accentIntensity,
      glowIntensity,
      borderThickness,
      glassOpacity,
      contrastMode,
      colorMode,
      textShadow,
      ...updates,
    };
    if (updates.density !== undefined) {
      nextAppearance.compactMode = updates.density === 'compact';
    }
    loadFromProfile(nextAppearance);
    applyAppearanceToDOM(nextAppearance);
    void saveProfileFields(nextAppearance);
  };

  const resetAppearance = () => {
    loadFromProfile(DEFAULT_APPEARANCE);
    applyAppearanceToDOM(DEFAULT_APPEARANCE);
    void saveProfileFields(DEFAULT_APPEARANCE);
  };

  const updateWorkoutSetting = <K extends keyof typeof store>(key: K, value: (typeof store)[K]) => {
    setField(key, value);
    void saveProfileFields({ [key]: value });
  };

  const addBodyWeight = async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) return;
    await db.bodyWeight.add({ date: new Date(), weight: w, unit: unitSystem === 'metric' ? 'kg' : 'lbs' });
    setNewWeight('');
    void loadBodyWeights();
  };

  const calcOneRM = useMemo(() => {
    const w = parseFloat(oneRMWeight);
    const r = parseInt(oneRMReps);
    if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0) return null;
    return {
      epley: Math.round(w * (1 + r / 30)),
      brzycki: Math.round(w * (36 / (37 - Math.min(36, r)))),
      lombardi: Math.round(w * Math.pow(r, 0.1)),
    };
  }, [oneRMWeight, oneRMReps]);

  const toggleEquipment = (eq: string) => {
    const next = equipment.includes(eq) ? equipment.filter(e => e !== eq) : [...equipment, eq];
    const safeNext = next.length > 0 ? next : ['body weight'];
    setEquipment(safeNext);
    void saveProfileFields({ equipment: safeNext });
  };

  const applyEquipmentPreset = (items: string[]) => {
    setEquipment(items);
    void saveProfileFields({ equipment: items });
  };

  const executeFactoryReset = async () => {
    await db.delete();
    window.location.reload();
  };

  const executeClearHistory = async () => {
    await db.transaction('rw', [db.workoutSessions, db.sets, db.sessionExercises, db.personalRecords], async () => {
      await db.workoutSessions.clear();
      await db.sets.clear();
      await db.sessionExercises.clear();
      await db.personalRecords.clear();
    });
    setConfirmClearHistory(false);
    void loadDBStats();
  };

  const exportData = async () => {
    try {
      const data = {
        version: 3,
        exportedAt: new Date().toISOString(),
        sessions: await db.workoutSessions.toArray(),
        sessionExercises: await db.sessionExercises.toArray(),
        sets: await db.sets.toArray(),
        bodyWeight: await db.bodyWeight.toArray(),
        measurements: await db.measurements.toArray(),
        waterLogs: await db.waterLogs.toArray(),
        profile: await db.userProfile.toArray(),
        prs: await db.personalRecords.toArray(),
        customPlans: (await db.workoutPlans.toArray()).filter(p => p.isCustom),
        workoutDays: await db.workoutDays.toArray(),
        swaps: await db.exerciseSwaps.toArray(),
        reminders: await db.workoutReminders.toArray(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ironforge-backup-${getLocalTodayKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data.sessions) && data.sessions.length > 0) {
        const normalized = data.sessions.map((s: any) => ({
          ...s,
          startedAt: new Date(s.startedAt || s.startTime || Date.now()),
          completedAt: (s.completedAt || s.endTime) ? new Date(s.completedAt || s.endTime) : undefined,
        }));
        await db.workoutSessions.bulkPut(normalized);
      }
      if (Array.isArray(data.sessionExercises) && data.sessionExercises.length > 0) {
        await db.sessionExercises.bulkPut(data.sessionExercises);
      }
      if (Array.isArray(data.sets) && data.sets.length > 0) {
        const normalizedSets = data.sets.map((s: any) => ({
          ...s,
          completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
        }));
        await db.sets.bulkPut(normalizedSets);
      }
      if (Array.isArray(data.bodyWeight) && data.bodyWeight.length > 0) {
        await db.bodyWeight.bulkPut(data.bodyWeight.map((b: any) => ({ ...b, date: new Date(b.date) })));
      }
      if (Array.isArray(data.measurements) && data.measurements.length > 0) {
        await db.measurements.bulkPut(data.measurements.map((m: any) => ({ ...m, date: new Date(m.date) })));
      }
      if (Array.isArray(data.waterLogs) && data.waterLogs.length > 0) {
        await db.waterLogs.bulkPut(data.waterLogs);
      }
      if (Array.isArray(data.prs) && data.prs.length > 0) {
        await db.personalRecords.bulkPut(data.prs.map((p: any) => ({ ...p, date: new Date(p.date || p.achievedAt || Date.now()) })));
      }
      if (Array.isArray(data.customPlans) && data.customPlans.length > 0) {
        await db.workoutPlans.bulkPut(
          data.customPlans.map((p: any) => ({
            ...p,
            createdAt: new Date(p.createdAt || Date.now()),
            updatedAt: new Date(p.updatedAt || Date.now()),
          }))
        );
      }
      if (Array.isArray(data.workoutDays) && data.workoutDays.length > 0) {
        await db.workoutDays.bulkPut(data.workoutDays);
      }
      if (Array.isArray(data.swaps) && data.swaps.length > 0) {
        await db.exerciseSwaps.bulkPut(
          data.swaps.map((sw: any) => ({ ...sw, swappedAt: new Date(sw.swappedAt || Date.now()) }))
        );
      }
      if (Array.isArray(data.reminders) && data.reminders.length > 0) {
        await db.workoutReminders.bulkPut(
          data.reminders.map((r: any) => ({
            ...r,
            createdAt: new Date(r.createdAt || Date.now()),
            lastFiredAt: r.lastFiredAt ? new Date(r.lastFiredAt) : undefined,
          }))
        );
      }
      if (Array.isArray(data.profile) && data.profile[0]) {
        const restoredProfile = data.profile[0];
        await db.userProfile.put(restoredProfile);
        loadFromProfile(restoredProfile);
        applyAppearanceToDOM(restoredProfile);
      }
      void loadBodyWeights();
      void loadMeasurements();
      void loadTodayWater();
      void loadDBStats();
      setImportStatus('✅ Full backup restored successfully!');
      setTimeout(() => setImportStatus(null), 4000);
    } catch {
      setImportStatus('❌ Invalid backup file');
      setTimeout(() => setImportStatus(null), 4000);
    }
    e.target.value = '';
  };

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

  const Toggle = ({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label?: string }) => (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={enabled}
      aria-label={label || 'Toggle setting'}
      style={{
        width: 48, height: 26, borderRadius: 13, border: 'none',
        background: enabled ? 'var(--accent-green)' : 'var(--bg-input)',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: enabled ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );

  const SettingRow = ({ icon: Icon, iconColor, label, description, children }: { icon: any; iconColor: string; label: string; description?: string; children: React.ReactNode }) => (
    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${iconColor}12`, border: `1px solid ${iconColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} color={iconColor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
          {description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <div className="page-container">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span className="gradient-text">Settings</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Customize your equipment, appearance &amp; workout engine</p>
      </motion.div>

      {/* Tab Bar */}
      <div className="chip-scroll" style={{ marginBottom: 20, paddingBottom: 4 }}>
        {([
          { id: 'profile' as const, label: '👤 Profile & Gear' },
          { id: 'appearance' as const, label: '🎨 Appearance' },
          { id: 'workout' as const, label: '💪 Workout' },
          { id: 'tools' as const, label: '🧮 Tools' },
          { id: 'data' as const, label: '💾 Data' },
        ]).map(tab => (
          <button key={tab.id} className={`filter-chip ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ======== PROFILE TAB ======== */}
      {activeTab === 'profile' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SettingRow icon={User} iconColor="var(--accent-purple)" label="Name">
            <input
              value={name}
              onChange={e => { setName(e.target.value); void saveProfileFields({ name: e.target.value }); }}
              style={{ width: 150, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'inherit', padding: '7px 10px', textAlign: 'right' }}
            />
          </SettingRow>

          <SettingRow icon={Scale} iconColor="var(--accent-green)" label="Units" description="Weight & measurement system">
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 10, padding: 3 }}>
              {(['metric', 'imperial'] as const).map(sys => (
                <button key={sys} onClick={() => { setUnitSystem(sys); void saveProfileFields({ unitSystem: sys }); }}
                  style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: unitSystem === sys ? 'var(--gradient-fire)' : 'transparent', color: unitSystem === sys ? 'var(--on-accent-text)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {sys}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon={Dumbbell} iconColor="var(--accent-orange)" label="Bar Weight" description="Standard barbell weight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              <input
                type="number"
                min={0}
                step={unitSystem === 'metric' ? 2.5 : 5}
                value={barWeight}
                onChange={e => {
                  const next = Number.parseFloat(e.target.value);
                  if (Number.isFinite(next)) {
                    const normalized = Math.max(0, Math.round(next * 2) / 2);
                    setBarWeight(normalized);
                    void saveProfileFields({ barWeight: normalized });
                  }
                }}
                style={{ width: 86, textAlign: 'right', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-bright)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 26 }}>{unitSystem === 'metric' ? 'kg' : 'lb'}</span>
            </div>
          </SettingRow>

          <SettingRow icon={Dumbbell} iconColor="var(--accent-cyan)" label="Dumbbell Default" description="Per-dumbbell starting weight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              <input
                type="number"
                min={0}
                step={unitSystem === 'metric' ? 2.5 : 5}
                value={dumbbellWeight}
                onChange={e => {
                  const next = Number.parseFloat(e.target.value);
                  if (Number.isFinite(next)) {
                    const normalized = Math.max(0, Math.round(next * 2) / 2);
                    setDumbbellWeight(normalized);
                    void saveProfileFields({ dumbbellWeight: normalized });
                  }
                }}
                style={{ width: 86, textAlign: 'right', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-bright)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 26 }}>{unitSystem === 'metric' ? 'kg' : 'lb'}</span>
            </div>
          </SettingRow>

          {/* Equipment Presets */}
          <div className="section-label" style={{ marginTop: 10 }}>Quick Equipment Presets</div>
          <div className="chip-scroll" style={{ marginBottom: 4 }}>
            {EQUIPMENT_PRESETS.map(preset => (
              <button
                key={preset.id}
                className="filter-chip"
                onClick={() => applyEquipmentPreset(preset.items)}
                style={{ fontSize: 11, padding: '6px 12px' }}
              >
                <span>{preset.icon}</span> {preset.label}
              </button>
            ))}
          </div>

          {/* Equipment */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div className="section-label">My Equipment ({equipment.length} selected)</div>
            <div style={{ fontSize: 10, color: 'var(--accent-green)', fontWeight: 700 }}>Strict Workout Filter Active</div>
          </div>
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

      {/* ======== APPEARANCE TAB ======== */}
      {activeTab === 'appearance' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Sticky Live Preview Banner so changes are visible while scrolling */}
          <div
            className="card hero-gradient"
            style={{
              padding: 14,
              position: 'sticky',
              top: 'max(8px, env(safe-area-inset-top))',
              zIndex: 30,
              background: 'color-mix(in srgb, var(--bg-sheet) 92%, transparent)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid var(--border-bright)',
              boxShadow: '0 10px 28px rgba(0,0,0,0.38)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="badge" style={{ background: 'rgba(16,232,154,0.12)', color: 'var(--accent-green)', border: '1px solid rgba(16,232,154,0.25)', fontSize: 10 }}>
                <Sparkles size={10} /> Live Preview (Pinned)
              </span>
              <button onClick={resetAppearance} className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RotateCcw size={12} /> Reset Defaults
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h3 className="font-display" style={{ fontSize: 17, fontWeight: 800 }}>
                  <span className="gradient-text">IronForge Studio</span>
                </h3>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Theme: <strong style={{ textTransform: 'capitalize' }}>{theme}</strong> • Card: <strong style={{ textTransform: 'capitalize' }}>{cardStyle}</strong> • Button: <strong style={{ textTransform: 'capitalize' }}>{buttonStyle}</strong>
                </p>
              </div>
              <div className="font-mono" style={{ fontSize: 19, fontWeight: 800, color: 'var(--accent-green)' }}>100kg</div>
            </div>
          </div>

          {/* Theme Selector (24 Themes) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Theme ({THEME_OPTIONS.length} Options — Dark, OLED &amp; Light)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(62px, 1fr))', gap: 8 }}>
              {THEME_OPTIONS.map(t => {
                const isActive = theme === t.id;
                return (
                  <button key={t.id} onClick={() => updateAppearance({ theme: t.id })} style={{
                    padding: '10px 4px', borderRadius: 'var(--r-md)', border: isActive ? `2px solid ${t.colors[0]}` : '1px solid var(--border-subtle)',
                    background: t.colors[2], cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
                    boxShadow: isActive ? `0 0 12px ${t.colors[0]}40` : 'none', minHeight: 62, transition: 'all 0.2s',
                  }} title={t.label}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.colors[0], border: '1px solid rgba(0,0,0,0.2)' }} />
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.colors[1], border: '1px solid rgba(0,0,0,0.2)' }} />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? t.colors[0] : (t.id === 'daylight' || t.id === 'sand' ? '#334155' : '#94a3b8'), letterSpacing: 0.4 }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Primary Accent Override */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Primary Accent Color Override</div>
            <div className="responsive-pills-grid">
              {CUSTOM_ACCENT_OPTIONS.map(acc => {
                const isActive = customAccent === acc.id;
                return (
                  <button key={acc.id} onClick={() => updateAppearance({ customAccent: acc.id })} style={{
                    padding: '10px 4px', borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    background: isActive ? 'var(--bg-elevated)' : 'var(--bg-glass)',
                    border: isActive ? `2px solid ${acc.color || 'var(--accent-red)'}` : '1px solid var(--border-subtle)',
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: acc.color ? `linear-gradient(135deg, ${acc.color}, ${acc.secondary})` : 'var(--gradient-fire)',
                    }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{acc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Selector (10 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>UI Typography ({FONT_OPTIONS.length} Fonts)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {FONT_OPTIONS.map(f => (
                <button key={f.id} onClick={() => updateAppearance({ font: f.id })} className="card"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                    width: '100%', textAlign: 'left',
                    border: font === f.id ? '2px solid var(--accent-red)' : '1px solid var(--border-subtle)',
                    boxShadow: font === f.id ? '0 0 12px var(--glow-red)' : 'none',
                    padding: '12px 14px',
                  }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: f.cssVar }}>{f.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: f.cssVar }}>{f.preview}</div>
                  </div>
                  {font === f.id && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--gradient-fire)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={11} color="var(--on-accent-text)" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size (5 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Text &amp; UI Scale</div>
            <div className="responsive-pills-grid">
              {FONT_SIZE_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ fontSize: opt.id })}
                  style={{
                    padding: '12px 4px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    background: fontSize === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                    border: fontSize === opt.id ? 'none' : '1px solid var(--border-subtle)',
                    color: fontSize === opt.id ? 'var(--on-accent-text)' : 'var(--text-secondary)',
                  }}>
                  <div style={{ fontSize: opt.sample, fontWeight: 800, marginBottom: 4 }}>Aa</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Number / Metrics Font */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Numbers &amp; Metrics Font</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { id: 'mono', label: 'Monospace', sample: '125.5 kg', ff: 'var(--font-jetbrains), monospace' },
                { id: 'display', label: 'Athletic', sample: '125.5 kg', ff: 'var(--font-space-grotesk), sans-serif' },
                { id: 'sans', label: 'Match UI', sample: '125.5 kg', ff: 'inherit' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ numberFont: opt.id })}
                  style={{
                    padding: '12px 6px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                    background: numberFont === opt.id ? 'var(--gradient-ocean)' : 'var(--bg-glass)',
                    border: numberFont === opt.id ? 'none' : '1px solid var(--border-subtle)',
                    color: numberFont === opt.id ? 'white' : 'var(--text-secondary)',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 800, fontFamily: opt.ff, marginBottom: 4 }}>{opt.sample}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Header Style */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Heading Style</div>
            <div className="responsive-pills-grid">
              {[
                { id: 'gradient', label: 'Gradient', icon: '🌈' },
                { id: 'solid', label: 'Clean', icon: '✒️' },
                { id: 'glow', label: 'Neon', icon: '⚡' },
                { id: 'uppercase', label: 'Tactical', icon: '🔠' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ headerStyle: opt.id })}
                  style={{
                    padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                    background: headerStyle === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                    border: headerStyle === opt.id ? 'none' : '1px solid var(--border-subtle)',
                    color: headerStyle === opt.id ? 'var(--on-accent-text)' : 'var(--text-secondary)',
                  }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Layout Density */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Layout Density</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { id: 'compact', label: 'Compact', icon: '📐' },
                { id: 'normal', label: 'Comfortable', icon: '✨' },
                { id: 'spacious', label: 'Spacious', icon: '🌿' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ density: opt.id })}
                  style={{
                    padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                    background: density === opt.id ? 'var(--gradient-mint)' : 'var(--bg-glass)',
                    border: density === opt.id ? 'none' : '1px solid var(--border-subtle)',
                    color: density === opt.id ? 'white' : 'var(--text-secondary)',
                  }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Exercise Grid Columns */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Exercise Library Grid</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { id: '1', label: '1 Col (List)', icon: '📋' },
                { id: '2', label: '2 Col (Cards)', icon: '🔲' },
                { id: '3', label: '3 Col (Dense)', icon: '🎛️' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ gridColumns: opt.id })}
                  style={{
                    padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                    background: gridColumns === opt.id ? 'var(--gradient-ocean)' : 'var(--bg-glass)',
                    border: gridColumns === opt.id ? 'none' : '1px solid var(--border-subtle)',
                    color: gridColumns === opt.id ? 'white' : 'var(--text-secondary)',
                  }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Button Style (7 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Button Style (7 Variants)</div>
            <div className="responsive-pills-grid">
              {[
                { id: 'default', label: 'Default', preview: '⬛' },
                { id: 'pill', label: 'Pill', preview: '💊' },
                { id: 'sharp', label: 'Sharp', preview: '🔲' },
                { id: 'outline', label: 'Outline', preview: '⬜' },
                { id: 'neon', label: 'Neon', preview: '✨' },
                { id: 'glass', label: 'Glass', preview: '🫧' },
                { id: '3d', label: '3D Tactile', preview: '🕹️' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ buttonStyle: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: buttonStyle === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                  border: buttonStyle === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: buttonStyle === opt.id ? 'var(--on-accent-text)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.preview}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Card Style (7 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Card Style (7 Variants)</div>
            <div className="responsive-pills-grid">
              {[
                { id: 'glass', label: 'Glass', preview: '🪟' },
                { id: 'solid', label: 'Solid', preview: '🧱' },
                { id: 'outline', label: 'Outline', preview: '📐' },
                { id: 'flat', label: 'Flat', preview: '📄' },
                { id: 'neon', label: 'Neon', preview: '💡' },
                { id: 'elevated', label: 'Elevated', preview: '🏔️' },
                { id: 'gradient', label: 'Gradient', preview: '🌌' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ cardStyle: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: cardStyle === opt.id ? 'var(--gradient-ocean)' : 'var(--bg-glass)',
                  border: cardStyle === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: cardStyle === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.preview}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Corner Radius (5 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Corner Radius</div>
            <div className="responsive-pills-grid">
              {[
                { id: 'none', label: 'Square', icon: '⬜' },
                { id: 'small', label: 'Subtle', icon: '🔳' },
                { id: 'default', label: 'Default', icon: '⬛' },
                { id: 'large', label: 'Round', icon: '🔵' },
                { id: 'pill', label: 'Capsule', icon: '💊' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ borderRadius: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: borderRadius === opt.id ? 'var(--gradient-mint)' : 'var(--bg-glass)',
                  border: borderRadius === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: borderRadius === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Background Pattern */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Background Pattern</div>
            <div className="responsive-pills-grid">
              {[
                { id: 'mesh', label: 'Mesh', icon: '🌌' },
                { id: 'grid', label: 'Grid', icon: '🕸️' },
                { id: 'dots', label: 'Dots', icon: '⠿' },
                { id: 'aurora', label: 'Aurora', icon: '🌅' },
                { id: 'clean', label: 'Clean', icon: '🌑' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ bgStyle: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: bgStyle === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                  border: bgStyle === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: bgStyle === opt.id ? 'var(--on-accent-text)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Nav Style (6 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Navigation Bar (6 Styles)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { id: 'default', label: 'Blur Dock', icon: '🫧' },
                { id: 'floating', label: 'Floating Island', icon: '🛸' },
                { id: 'minimal', label: 'Minimal Icons', icon: '➖' },
                { id: 'solid', label: 'Solid Bar', icon: '🧱' },
                { id: 'pill', label: 'Center Pill', icon: '💊' },
                { id: 'bordered', label: 'Neon Top Line', icon: '⚡' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ navStyle: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: navStyle === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                  border: navStyle === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: navStyle === opt.id ? 'var(--on-accent-text)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Animation Level */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Animations &amp; Transitions</div>
            <div className="responsive-pills-grid">
              {[
                { id: 'none', label: 'None', icon: '⏹️' },
                { id: 'subtle', label: 'Subtle', icon: '🌊' },
                { id: 'normal', label: 'Normal', icon: '💨' },
                { id: 'full', label: 'Max', icon: '🚀' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ animationLevel: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: animationLevel === opt.id ? 'var(--gradient-sunset)' : 'var(--bg-glass)',
                  border: animationLevel === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: animationLevel === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Accent Intensity */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Accent Saturation</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {ACCENT_INTENSITY_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ accentIntensity: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: accentIntensity === opt.id ? 'var(--gradient-hero)' : 'var(--bg-glass)',
                  border: accentIntensity === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: accentIntensity === opt.id ? 'var(--on-accent-text)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Glow Intensity (4 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Glow Intensity</div>
            <div className="responsive-pills-grid">
              {[
                { id: 'none', label: 'Off', icon: '🌑' },
                { id: 'low', label: 'Subtle', icon: '💫' },
                { id: 'normal', label: 'Normal', icon: '✨' },
                { id: 'high', label: 'Intense', icon: '⚡' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ glowIntensity: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: glowIntensity === opt.id ? 'var(--gradient-mint)' : 'var(--bg-glass)',
                  border: glowIntensity === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: glowIntensity === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Border Thickness (4 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Border Thickness</div>
            <div className="responsive-pills-grid">
              {[
                { id: 'none', label: 'None', icon: '⭕' },
                { id: 'thin', label: 'Thin', icon: '📏' },
                { id: 'normal', label: 'Normal', icon: '📐' },
                { id: 'thick', label: 'Thick', icon: '📊' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ borderThickness: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: borderThickness === opt.id ? 'var(--gradient-ocean)' : 'var(--bg-glass)',
                  border: borderThickness === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: borderThickness === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Glass Opacity (4 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Surface Opacity &amp; Blur</div>
            <div className="responsive-pills-grid">
              {[
                { id: 'clear', label: 'Crystal', icon: '💎' },
                { id: 'light', label: 'Light', icon: '☁️' },
                { id: 'medium', label: 'Medium', icon: '🌫️' },
                { id: 'heavy', label: 'Frosted', icon: '🧊' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ glassOpacity: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: glassOpacity === opt.id ? 'var(--gradient-mint)' : 'var(--bg-glass)',
                  border: glassOpacity === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: glassOpacity === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Contrast Mode (3 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Contrast Level</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {CONTRAST_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ contrastMode: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: contrastMode === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                  border: contrastMode === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: contrastMode === opt.id ? 'var(--on-accent-text)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Vision Mode (5 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Color Vision Accessibility</div>
            <div className="responsive-pills-grid">
              {COLOR_MODE_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ colorMode: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: colorMode === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                  border: colorMode === opt.id ? 'none' : '1px solid var(--border-subtle)',
                  color: colorMode === opt.id ? 'var(--on-accent-text)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16 }}>{opt.icon}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Text Shadow Toggle */}
          <SettingRow icon={Type} iconColor="var(--accent-pink)" label="Text Shadow" description="Add crisp depth to headings & numbers">
            <Toggle enabled={textShadow} onToggle={() => updateAppearance({ textShadow: !textShadow })} label="Text Shadow" />
          </SettingRow>

          {/* Home Dashboard Widgets Customization */}
          <div className="section-label" style={{ marginTop: 8 }}>Home Dashboard Widgets</div>
          <SettingRow icon={Eye} iconColor="var(--accent-purple)" label="Daily Motivational Quote" description="Show quote card on Home tab">
            <Toggle enabled={showDailyQuote} onToggle={() => updateWorkoutSetting('showDailyQuote', !showDailyQuote)} label="Daily Quote" />
          </SettingRow>
          <SettingRow icon={Clock} iconColor="var(--accent-green)" label="Last Workout Summary" description="Show previous workout stats card">
            <Toggle enabled={showLastWorkout} onToggle={() => updateWorkoutSetting('showLastWorkout', !showLastWorkout)} label="Last Workout Summary" />
          </SettingRow>
          <SettingRow icon={LayoutGrid} iconColor="var(--accent-cyan)" label="16-Week Activity Heatmap" description="Show consistency grid on Home tab">
            <Toggle enabled={showActivityHeatmap} onToggle={() => updateWorkoutSetting('showActivityHeatmap', !showActivityHeatmap)} label="Activity Heatmap" />
          </SettingRow>
          <SettingRow icon={Sliders} iconColor="var(--accent-yellow)" label="Quick Navigation Cards" description="Show feature shortcut tiles on Home tab">
            <Toggle enabled={showFeatureCards} onToggle={() => updateWorkoutSetting('showFeatureCards', !showFeatureCards)} label="Quick Navigation Cards" />
          </SettingRow>

        </motion.div>
      )}

      {/* ======== WORKOUT TAB ======== */}
      {activeTab === 'workout' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <SettingRow icon={Shuffle} iconColor="var(--accent-purple)" label="Exercise Variety" description="Rotate exercises across workouts">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {([
                { id: 'low' as const, label: 'Low' },
                { id: 'medium' as const, label: 'Balanced' },
                { id: 'high' as const, label: 'High' },
              ]).map(v => (
                <button key={v.id} onClick={() => updateWorkoutSetting('exerciseVariety', v.id)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: exerciseVariety === v.id ? 'none' : '1px solid var(--border-subtle)', background: exerciseVariety === v.id ? 'var(--gradient-fire)' : 'transparent', color: exerciseVariety === v.id ? 'var(--on-accent-text)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon={Timer} iconColor="var(--accent-cyan)" label="Default Rest" description="Auto-start rest timer duration">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {[30, 60, 90, 120, 180, 300].map(t => (
                <button key={t} onClick={() => { setDefaultRestTime(t); void saveProfileFields({ defaultRestTime: t }); }}
                  style={{ padding: '6px 9px', borderRadius: 8, border: defaultRestTime === t ? 'none' : '1px solid var(--border-subtle)', background: defaultRestTime === t ? 'var(--gradient-fire)' : 'transparent', color: defaultRestTime === t ? 'var(--on-accent-text)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {t >= 60 ? `${t / 60}m` : `${t}s`}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon={ArrowUp} iconColor="var(--accent-orange)" label="Weight Increment" description="Step for +/- weight buttons in workout">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {[0.5, 1, 1.25, 2.5, 5, 10].map(inc => (
                <button key={inc} onClick={() => updateWorkoutSetting('weightIncrement', inc)}
                  style={{ padding: '6px 9px', borderRadius: 8, border: weightIncrement === inc ? 'none' : '1px solid var(--border-subtle)', background: weightIncrement === inc ? 'var(--gradient-ocean)' : 'transparent', color: weightIncrement === inc ? 'white' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {inc}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon={Timer} iconColor="var(--accent-green)" label="Enable Rest Timer" description="Master toggle for rest timer overlay">
            <Toggle enabled={restTimerEnabled} onToggle={() => { toggleRestTimer(); void saveProfileFields({ restTimerEnabled: !restTimerEnabled }); }} label="Enable Rest Timer" />
          </SettingRow>

          <SettingRow icon={Timer} iconColor="var(--accent-blue)" label="Auto-start Rest" description="Start rest timer after completing a set">
            <Toggle enabled={autoStartRest} onToggle={() => updateWorkoutSetting('autoStartRest', !autoStartRest)} label="Auto-start Rest" />
          </SettingRow>

          <SettingRow icon={Zap} iconColor="var(--accent-green)" label="Auto-advance Exercises" description="Jump to next exercise when all sets done">
            <Toggle enabled={autoAdvance} onToggle={() => updateWorkoutSetting('autoAdvance', !autoAdvance)} label="Auto-advance Exercises" />
          </SettingRow>

          <SettingRow icon={Clock} iconColor="var(--accent-orange)" label="Show Workout Stopwatch" description="Display elapsed time in workout header">
            <Toggle enabled={showTimer} onToggle={() => updateWorkoutSetting('showTimer', !showTimer)} label="Show Workout Stopwatch" />
          </SettingRow>

          <SettingRow icon={Volume2} iconColor="var(--accent-yellow)" label="Sound Effects" description="Set & rest timer completion sounds">
            <Toggle enabled={soundEnabled} onToggle={() => { toggleSound(); void saveProfileFields({ soundEnabled: !soundEnabled }); }} label="Sound Effects" />
          </SettingRow>

          <SettingRow icon={Bell} iconColor="var(--accent-cyan)" label="Countdown Beeps (3-2-1)" description="Audio ticks on final 3 seconds of rest">
            <Toggle enabled={countdownSound} onToggle={() => updateWorkoutSetting('countdownSound', !countdownSound)} label="Countdown Beeps" />
          </SettingRow>

          <SettingRow icon={Vibrate} iconColor="var(--accent-pink)" label="Haptic Feedback" description="Vibrate on set & workout completion">
            <Toggle enabled={hapticEnabled} onToggle={() => { toggleHaptic(); void saveProfileFields({ hapticEnabled: !hapticEnabled }); }} label="Haptic Feedback" />
          </SettingRow>

          <SettingRow icon={Smartphone} iconColor="var(--accent-purple)" label="Keep Screen On" description="Prevent screen sleep during workouts">
            <Toggle enabled={keepScreenOn} onToggle={() => updateWorkoutSetting('keepScreenOn', !keepScreenOn)} label="Keep Screen On" />
          </SettingRow>

          {/* Workout Reminders */}
          <ReminderSection />
        </motion.div>
      )}

      {/* ======== TOOLS TAB ======== */}
      {activeTab === 'tools' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={16} color="var(--accent-green)" /> Body Weight
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder={`Weight (${unitSystem === 'metric' ? 'kg' : 'lbs'})`} type="number" step="0.1"
                style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', minHeight: 46 }} />
              <button onClick={addBodyWeight} style={{ padding: '12px 18px', background: 'var(--gradient-mint)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, cursor: 'pointer', minHeight: 46 }}>
                <Plus size={16} />
              </button>
            </div>
            {bodyWeights.length > 1 && (
              <svg width="100%" viewBox="0 0 300 80" style={{ marginBottom: 8 }}>
                <polyline fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={weightChartPoints} />
                <polyline fill="url(#weightGrad)" stroke="none" points={`10,70 ${weightChartPoints} 290,70`} />
                <defs><linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(16,232,154,0.18)" /><stop offset="100%" stopColor="rgba(16,232,154,0)" /></linearGradient></defs>
              </svg>
            )}
            {bodyWeights.slice(0, 6).map(bw => (
              <div key={bw.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{new Date(bw.date).toLocaleDateString()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="font-mono" style={{ fontWeight: 700 }}>{bw.weight} {bw.unit}</span>
                  <button onClick={() => void deleteBodyWeight(bw.id)} aria-label="Delete weight entry" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calculator size={16} color="var(--accent-purple)" /> 1RM Calculator
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={oneRMWeight} onChange={e => setOneRMWeight(e.target.value)} placeholder="Weight" type="number"
                style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', minHeight: 46 }} />
              <input value={oneRMReps} onChange={e => setOneRMReps(e.target.value)} placeholder="Reps" type="number"
                style={{ width: 88, padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', minHeight: 46 }} />
            </div>
            {calcOneRM && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { label: 'Epley', value: calcOneRM.epley, color: 'var(--accent-red)' },
                  { label: 'Brzycki', value: calcOneRM.brzycki, color: 'var(--accent-purple)' },
                  { label: 'Lombardi', value: calcOneRM.lombardi, color: 'var(--accent-green)' },
                ].map(est => (
                  <div key={est.label} style={{ padding: 12, borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <div className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: est.color }}>{est.value}</div>
                    <div className="section-label" style={{ marginTop: 2 }}>{est.label}</div>
                  </div>
                ))}
              </div>
            )}

            {calcOneRM && (
              <div style={{ marginTop: 12 }}>
                <div className="section-label" style={{ marginBottom: 6 }}>Training Percentages (Epley)</div>
                <div className="responsive-stats-4">
                  {[95, 90, 85, 80, 75, 70, 65, 60].map(pct => (
                    <div key={pct} style={{ padding: '8px 4px', borderRadius: 8, background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct}%</div>
                      <div className="font-mono" style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(calcOneRM.epley * pct / 100)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <PlateCalculator barWeight={barWeight} unit={unitSystem} />

          {/* Daily Hydration Tracker */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                💧 Daily Hydration
              </h3>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {todayWater?.glasses || 0} / {todayWater?.targetGlasses || 8} glasses ({((todayWater?.glasses || 0) * 0.25).toFixed(2)}L)
              </span>
            </div>
            <div className="progress-bar" style={{ height: 8, marginBottom: 12 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min(100, ((todayWater?.glasses || 0) / (todayWater?.targetGlasses || 8)) * 100)}%`,
                  background: 'var(--gradient-ocean)',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => void updateWater(-1)}
                className="btn-secondary"
                style={{ flex: 1, minHeight: 42, borderRadius: 10, fontSize: 13, fontWeight: 700 }}
              >
                - 1 Glass
              </button>
              <button
                onClick={() => void updateWater(1)}
                className="btn-primary"
                style={{ flex: 2, minHeight: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--gradient-ocean)', color: '#fff' }}
              >
                + Add Glass (250ml)
              </button>
            </div>
          </div>

          {/* Body Measurements Tracker */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              📏 Body Measurements ({unitSystem === 'metric' ? 'cm' : 'in'})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
              <input value={measForm.bodyFat} onChange={e => setMeasForm({ ...measForm, bodyFat: e.target.value })} placeholder="Body Fat %" type="number" step="0.1"
                style={{ padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
              <input value={measForm.chest} onChange={e => setMeasForm({ ...measForm, chest: e.target.value })} placeholder="Chest" type="number" step="0.1"
                style={{ padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
              <input value={measForm.waist} onChange={e => setMeasForm({ ...measForm, waist: e.target.value })} placeholder="Waist" type="number" step="0.1"
                style={{ padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
              <input value={measForm.arms} onChange={e => setMeasForm({ ...measForm, arms: e.target.value })} placeholder="Arms" type="number" step="0.1"
                style={{ padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
              <input value={measForm.thighs} onChange={e => setMeasForm({ ...measForm, thighs: e.target.value })} placeholder="Thighs" type="number" step="0.1"
                style={{ padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
              <button onClick={() => void addMeasurement()} className="btn-primary" style={{ minHeight: 40, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                <Plus size={14} /> Log
              </button>
            </div>
            {measurements.slice(0, 5).map((m, idx) => (
              <div key={m.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{new Date(m.date).toLocaleDateString()}</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {m.bodyFat && <span className="font-mono" style={{ color: 'var(--accent-yellow)' }}>{m.bodyFat}% BF</span>}
                  {m.chest && <span className="font-mono">C: {m.chest}</span>}
                  {m.waist && <span className="font-mono">W: {m.waist}</span>}
                  {m.arms && <span className="font-mono">A: {m.arms}</span>}
                  {m.thighs && <span className="font-mono">T: {m.thighs}</span>}
                  <button onClick={() => void deleteMeasurement(m.id)} aria-label="Delete measurement" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ======== DATA TAB ======== */}
      {activeTab === 'data' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={16} color="var(--accent-blue)" /> Database Info
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { label: 'Exercises', value: dbStats.exercises.toLocaleString(), color: 'var(--accent-green)' },
                { label: 'Sessions', value: dbStats.sessions.toLocaleString(), color: 'var(--accent-purple)' },
                { label: 'Plans', value: dbStats.plans.toLocaleString(), color: 'var(--accent-orange)' },
                { label: 'Storage', value: dbStats.size || 'N/A', color: 'var(--accent-cyan)' },
              ].map(stat => (
                <div key={stat.label} style={{ padding: 12, borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                  <div className="font-mono" style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div className="section-label" style={{ marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <button className="card" onClick={exportData} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid rgba(16,232,154,0.2)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,232,154,0.1)', border: '1px solid rgba(16,232,154,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Download size={16} color="var(--accent-green)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>Export Full Backup</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Download sessions, sets, PRs, measurements, reminders &amp; custom plans as JSON</div>
            </div>
          </button>

          <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid rgba(56,189,248,0.2)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowUp size={16} color="var(--accent-cyan)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-cyan)' }}>Import Backup (Restore JSON)</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{importStatus || 'Restore workouts, custom plans, PRs & appearance from a backup file'}</div>
            </div>
            <input type="file" accept=".json,application/json" onChange={handleImportData} style={{ display: 'none' }} />
          </label>

          {/* In-App Confirmation for Clearing Workout History */}
          <div className="card" style={{ border: '1px solid rgba(251,191,36,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <RotateCcw size={16} color="var(--accent-yellow)" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-yellow)' }}>Clear Workout History</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Remove all logged sessions &amp; PRs while keeping exercises &amp; plans</div>
                </div>
              </div>
              {!confirmClearHistory && (
                <button onClick={() => setConfirmClearHistory(true)} className="btn-secondary" style={{ padding: '8px 12px', fontSize: 11, borderRadius: 10, flexShrink: 0 }}>
                  Clear
                </button>
              )}
            </div>
            {confirmClearHistory && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmClearHistory(false)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>Cancel</button>
                <button onClick={() => void executeClearHistory()} className="btn-cancel" style={{ padding: '8px 14px', fontSize: 12 }}>Confirm Clear History</button>
              </div>
            )}
          </div>

          {/* In-App Confirmation for Factory Reset */}
          <div className="card" style={{ border: '1px solid rgba(255,61,90,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,61,90,0.1)', border: '1px solid rgba(255,61,90,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 size={16} color="var(--accent-red)" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>Factory Reset</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Delete ALL data and re-initialize fresh. Cannot be undone.</div>
                </div>
              </div>
              {!confirmFactoryReset && (
                <button onClick={() => setConfirmFactoryReset(true)} className="btn-cancel" style={{ padding: '8px 12px', fontSize: 11, borderRadius: 10, flexShrink: 0 }}>
                  Reset
                </button>
              )}
            </div>
            {confirmFactoryReset && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmFactoryReset(false)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>Cancel</button>
                <button onClick={() => void executeFactoryReset()} className="btn-cancel" style={{ padding: '8px 14px', fontSize: 12, background: 'var(--accent-red)', color: 'white' }}>Wipe Everything</button>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 16, padding: 16 }}>
            <div className="font-display gradient-text" style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>IRONFORGE</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>v5.1.0 • Precision Engineered</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              {(dbStats.exercises || 2243).toLocaleString()} Exercises • {dbStats.plans || 17} Programs • {THEME_OPTIONS.length} Themes
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ===== REMINDER SECTION ===== */
function ReminderSection() {
  const { reminders, loadReminders, addReminder, deleteReminder, toggleReminder, requestPermission, permissionGranted, startBackgroundCheck } = useReminderStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newDay, setNewDay] = useState(1);
  const [newHour, setNewHour] = useState(8);
  const [newMinute, setNewMinute] = useState(0);
  const [newLabel, setNewLabel] = useState('Workout time!');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => { void loadReminders(); }, [loadReminders]);
  useEffect(() => { if (permissionGranted && reminders.some(r => r.isEnabled)) startBackgroundCheck(); }, [permissionGranted, reminders, startBackgroundCheck]);

  const handleAdd = async () => {
    if (!permissionGranted) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    await addReminder({ dayOfWeek: newDay, timeHour: newHour, timeMinute: newMinute, isEnabled: true, label: newLabel });
    setShowAdd(false);
    startBackgroundCheck();
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div className="section-label" style={{ marginBottom: 10 }}>🔔 Workout Reminders</div>
      {!permissionGranted && (
        <div className="card" style={{ padding: 12, marginBottom: 10, border: '1px dashed rgba(251,191,36,0.35)' }}>
          <div style={{ fontSize: 12, color: 'var(--accent-yellow)', fontWeight: 600, marginBottom: 6 }}>Notifications not enabled</div>
          <button onClick={requestPermission} className="btn-primary" style={{ fontSize: 11, padding: '6px 14px', minHeight: 32, borderRadius: 8, width: 'auto' }}>
            <Bell size={12} /> Enable Notifications
          </button>
        </div>
      )}

      {reminders.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, padding: '12px 0' }}>
          No reminders set. Add one to get notified before your workouts.
        </div>
      )}

      {reminders.map(r => (
        <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, opacity: r.isEnabled ? 1 : 0.55 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: r.isEnabled ? 'rgba(16,232,154,0.1)' : 'var(--bg-glass)', border: `1px solid ${r.isEnabled ? 'rgba(16,232,154,0.2)' : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={14} color={r.isEnabled ? 'var(--accent-green)' : 'var(--text-muted)'} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{dayNames[r.dayOfWeek]} at {String(r.timeHour).padStart(2, '0')}:{String(r.timeMinute).padStart(2, '0')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.label}</div>
          </div>
          <button onClick={() => r.id && void toggleReminder(r.id)}
            style={{ width: 48, height: 26, borderRadius: 13, border: 'none', background: r.isEnabled ? 'var(--accent-green)' : 'var(--bg-input)', cursor: 'pointer', position: 'relative' as const, flexShrink: 0 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute' as const, top: 3, left: r.isEnabled ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </button>
          <button onClick={() => r.id && void deleteReminder(r.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 4 }}>
            <X size={14} />
          </button>
        </div>
      ))}

      {showAdd ? (
        <div className="card" style={{ padding: 14, marginTop: 8, border: '1px solid var(--accent-purple)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>New Reminder</div>
          <div style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Day</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {dayNames.map((d, i) => (
                <button key={i} onClick={() => setNewDay(i)} style={{
                  flex: 1, padding: '8px 2px', borderRadius: 8, border: newDay === i ? 'none' : '1px solid var(--border-subtle)',
                  background: newDay === i ? 'var(--gradient-fire)' : 'transparent', color: newDay === i ? 'var(--on-accent-text)' : 'var(--text-muted)',
                  fontSize: 10, fontWeight: 700, cursor: 'pointer',
                }}>{d}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="section-label" style={{ marginBottom: 4 }}>Hour</div>
              <select value={newHour} onChange={e => setNewHour(parseInt(e.target.value))} style={{ width: '100%', padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div className="section-label" style={{ marginBottom: 4 }}>Minute</div>
              <select value={newMinute} onChange={e => setNewMinute(parseInt(e.target.value))} style={{ width: '100%', padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Label</div>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} style={{ width: '100%', padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} className="btn-primary" style={{ flex: 1, minHeight: 40, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>Save</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary" style={{ flex: 1, minHeight: 40, borderRadius: 10, fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="btn-secondary" style={{ width: '100%', minHeight: 44, borderRadius: 12, fontSize: 13, fontWeight: 700, marginTop: 8 }}>
          <Plus size={14} /> Add Reminder
        </button>
      )}
    </div>
  );
}

/* ===== PLATE CALCULATOR ===== */
function PlateCalculator({ barWeight, unit }: { barWeight: number; unit: 'metric' | 'imperial' }) {
  const [targetWeight, setTargetWeight] = useState('');
  const unitLabel = unit === 'metric' ? 'kg' : 'lbs';

  const result = useMemo(() => {
    const target = parseFloat(targetWeight);
    if (isNaN(target) || target <= barWeight) return null;
    return calculatePlates(target, barWeight, unit);
  }, [targetWeight, barWeight, unit]);

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Dumbbell size={16} color="var(--accent-red)" /> Plate Calculator
      </h3>
      <input
        value={targetWeight}
        onChange={e => setTargetWeight(e.target.value)}
        placeholder={`Target weight (${unitLabel})`}
        type="number"
        style={{ width: '100%', padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 12, minHeight: 46 }}
      />
      {result && result.perSide.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>
            Each side ({((parseFloat(targetWeight) - barWeight) / 2).toFixed(1)} {unitLabel}/side)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '12px 0', overflowX: 'auto' }}>
            <div style={{ height: 8, width: 52, background: '#64748B', borderRadius: 2, flexShrink: 0 }} />
            {result.perSide.flatMap((p, idx) =>
              Array.from({ length: p.count }, (_, cIdx) => {
                const color = getPlateColor(p.weight, unit);
                return (
                  <div
                    key={`${idx}-${cIdx}`}
                    style={{
                      height: Math.max(26, 22 + p.weight * (unit === 'metric' ? 1.2 : 0.7)),
                      width: Math.max(12, 8 + p.weight * 0.25),
                      background: color,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 7,
                      fontWeight: 800,
                      color: p.weight === 10 && unit === 'imperial' || p.weight === 5 && unit === 'metric' ? '#0F172A' : '#FFFFFF',
                      writingMode: 'vertical-lr',
                      textOrientation: 'mixed',
                      flexShrink: 0,
                    }}
                  >
                    {p.weight}
                  </div>
                );
              })
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {result.perSide.map((p, i) => {
              const color = getPlateColor(p.weight, unit);
              return (
                <span key={i} className="badge" style={{ background: `${color}18`, color, border: `1px solid ${color}38`, fontSize: 12, fontWeight: 700 }}>
                  {p.weight}{unitLabel} ×{p.count}
                </span>
              );
            })}
          </div>
          {!result.isExact && (
            <div style={{ fontSize: 11, color: 'var(--accent-yellow)', marginTop: 8 }}>
              Nearest loadable weight with standard plates: {result.totalWeight}{unitLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
