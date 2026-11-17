'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db';
import { useUserStore } from '@/lib/store/userStore';
import { BodyMetric, AccentColor, ThemeMode, FontScale, LayoutDensity } from '@/lib/types';
import {
  ACCENT_PALETTES,
  THEME_PALETTES,
  FONT_FAMILY_OPTIONS,
  CARD_STYLE_OPTIONS,
  BORDER_RADIUS_OPTIONS,
  NAV_STYLE_OPTIONS,
  DEFAULT_APPEARANCE,
} from '@/lib/utils/appearance';
import {
  User, Scale, Download, Upload, Trash2, Calculator, Droplets,
  Moon, Bell, Volume2, Vibrate, Shield, Sparkles, Check, ChevronRight,
  Palette, Sun, Smartphone, RotateCcw, Eye, Type, Layout, Sliders, Compass, Gauge, Accessibility,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type SettingsSection = 'general' | 'appearance' | 'workout' | 'tools' | 'data';
type AppearanceFilter = 'all' | 'theme' | 'typography' | 'cards' | 'widgets';

const ACCENT_COLORS: { id: AccentColor; label: string; color: string; secondary: string }[] = (
  Object.keys(ACCENT_PALETTES) as AccentColor[]
).map((id) => ({
  id,
  label: ACCENT_PALETTES[id].label,
  color: ACCENT_PALETTES[id].primary,
  secondary: ACCENT_PALETTES[id].secondary,
}));

const THEME_MODES: { id: ThemeMode; label: string; desc: string; preview: string }[] = (
  Object.keys(THEME_PALETTES) as ThemeMode[]
).map((id) => ({
  id,
  label: THEME_PALETTES[id].label,
  desc: THEME_PALETTES[id].desc,
  preview: THEME_PALETTES[id].preview,
}));

export default function ProfilePage() {
  const {
    profile, setName, setWeightUnit, setRestTimer, setWeeklyGoal, setExperienceLevel,
    setThemeMode, setAccentColor, setFontScale, setLayoutDensity,
    setAutoRestTimer, setRestTimerSound, setRestTimerVibrate, setKeepScreenAwake,
    setShowWarmupSets, setDefaultWeightIncrement, setCompactCards, setAnimationsEnabled,
    setAppearance, resetAppearance,
  } = useUserStore();

  const [section, setSection] = useState<SettingsSection>('general');
  const [appearanceFilter, setAppearanceFilter] = useState<AppearanceFilter>('all');
  const [editName, setEditName] = useState(profile.name);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([]);
  const [newWeight, setNewWeight] = useState('');
  const [newBodyFat, setNewBodyFat] = useState('');

  // Tools
  const [plateWeight, setPlateWeight] = useState('100');
  const [orm1Weight, setOrm1Weight] = useState('100');
  const [orm1Reps, setOrm1Reps] = useState('5');
  const [waterGlasses, setWaterGlasses] = useState(0);

  // Confirm modals & feedback
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [exportStatus, setExportStatus] = useState<string>('');
  const [workoutCount, setWorkoutCount] = useState(0);
  const [prCount, setPrCount] = useState(0);

  const loadMetrics = useCallback(async () => {
    const m = await db.bodyMetrics.orderBy('recordedAt').reverse().limit(30).toArray();
    setBodyMetrics(m.reverse());
    const wc = await db.workoutSessions.count();
    const pc = await db.personalRecords.count();
    setWorkoutCount(wc);
    setPrCount(pc);
  }, []);

  useEffect(() => {
    loadMetrics();
    const saved = localStorage.getItem(`ironforge-water-${new Date().toISOString().split('T')[0]}`);
    if (saved) setWaterGlasses(Number(saved));
  }, [loadMetrics]);

  // Apply appearance settings live to document
  useEffect(() => {
    const root = document.documentElement;
    const accent = ACCENT_COLORS.find((a) => a.id === profile.accentColor) || ACCENT_COLORS[0];
    root.style.setProperty('--accent-primary', accent.color);
    root.style.setProperty('--accent-secondary', accent.secondary);
    root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${accent.color} 0%, ${accent.secondary} 100%)`);

    const scales: Record<FontScale, string> = { sm: '14px', md: '16px', lg: '17.5px', xl: '19px' };
    root.style.fontSize = scales[profile.fontScale || 'md'];

    if (profile.themeMode === 'amoled') {
      root.style.setProperty('--bg-primary', '#000000');
      root.style.setProperty('--bg-secondary', '#07070c');
      root.style.setProperty('--bg-card', '#0a0a12');
    } else if (profile.themeMode === 'midnight') {
      root.style.setProperty('--bg-primary', '#070b16');
      root.style.setProperty('--bg-secondary', '#0d1324');
      root.style.setProperty('--bg-card', '#11192e');
    } else if (profile.themeMode === 'slate') {
      root.style.setProperty('--bg-primary', '#0f111a');
      root.style.setProperty('--bg-secondary', '#161926');
      root.style.setProperty('--bg-card', '#1c2030');
    } else {
      root.style.setProperty('--bg-primary', '#09090f');
      root.style.setProperty('--bg-secondary', '#111119');
      root.style.setProperty('--bg-card', '#151520');
    }
  }, [profile.accentColor, profile.fontScale, profile.themeMode]);

  const handleSaveName = () => {
    if (editName.trim()) setName(editName.trim());
  };

  const handleAddMetric = async () => {
    if (!newWeight && !newBodyFat) return;
    await db.bodyMetrics.add({
      weight: newWeight ? Number(newWeight) : undefined,
      bodyFat: newBodyFat ? Number(newBodyFat) : undefined,
      recordedAt: new Date(),
    });
    setNewWeight('');
    setNewBodyFat('');
    loadMetrics();
  };

  const handleWater = (delta: number) => {
    const next = Math.max(0, Math.min(20, waterGlasses + delta));
    setWaterGlasses(next);
    localStorage.setItem(`ironforge-water-${new Date().toISOString().split('T')[0]}`, String(next));
  };

  // Plate calculator
  const calculatePlates = () => {
    const target = Number(plateWeight) || 0;
    const barWeight = profile.weightUnit === 'kg' ? 20 : 45;
    let remaining = (target - barWeight) / 2;
    if (remaining <= 0) return [];
    const available = profile.weightUnit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5];
    const result: { plate: number; count: number }[] = [];
    for (const p of available) {
      const count = Math.floor(remaining / p);
      if (count > 0) {
        result.push({ plate: p, count });
        remaining -= count * p;
      }
    }
    return result;
  };

  // 1RM Epley & Brzycki
  const w1rm = Number(orm1Weight) || 0;
  const r1rm = Number(orm1Reps) || 1;
  const epley1RM = r1rm === 1 ? w1rm : Math.round(w1rm * (1 + r1rm / 30));
  const brzycki1RM = r1rm === 1 ? w1rm : Math.round(w1rm * (36 / (37 - Math.min(36, r1rm))));
  const avg1RM = Math.round((epley1RM + brzycki1RM) / 2);

  // Data export with Android Native Bridge + Web Share + Download fallback
  const exportData = async () => {
    try {
      const data = {
        version: '5.2.0',
        exportedAt: new Date().toISOString(),
        profile,
        sessions: await db.workoutSessions.toArray(),
        plans: await db.workoutPlans.toArray(),
        days: await db.workoutDays.toArray(),
        prs: await db.personalRecords.toArray(),
        metrics: await db.bodyMetrics.toArray(),
      };
      const filename = `ironforge-backup-${new Date().toISOString().split('T')[0]}.json`;
      const jsonStr = JSON.stringify(data, null, 2);

      // 1. Try Android Native Bridge first (reliable inside Android WebView APK)
      const w = window as unknown as {
        IronForgeNative?: { exportBackupJson?: (name: string, content: string) => boolean };
      };
      if (w.IronForgeNative?.exportBackupJson) {
        const ok = w.IronForgeNative.exportBackupJson(filename, jsonStr);
        if (ok) {
          setExportStatus(`✓ Ready to share or save ${filename}`);
          setTimeout(() => setExportStatus(''), 4000);
          return;
        }
      }

      // 2. Standard browser Blob download fallback
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setExportStatus(`✓ Backup exported (${filename})`);
      setTimeout(() => setExportStatus(''), 4000);
    } catch {
      setExportStatus('✗ Export failed. Please try again.');
      setTimeout(() => setExportStatus(''), 4000);
    }
  };

  // Data import
  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.sessions) { await db.workoutSessions.clear(); await db.workoutSessions.bulkAdd(data.sessions); }
        if (data.prs) { await db.personalRecords.clear(); await db.personalRecords.bulkAdd(data.prs); }
        if (data.metrics) { await db.bodyMetrics.clear(); await db.bodyMetrics.bulkAdd(data.metrics); }
        if (data.plans) { await db.workoutPlans.clear(); await db.workoutPlans.bulkAdd(data.plans); }
        if (data.days) { await db.workoutDays.clear(); await db.workoutDays.bulkAdd(data.days); }
        setImportStatus('✓ Backup restored successfully!');
        loadMetrics();
        setTimeout(() => setImportStatus(''), 3500);
      } catch {
        setImportStatus('✗ Invalid backup file');
        setTimeout(() => setImportStatus(''), 3500);
      }
    };
    input.click();
  };

  // Clear workout history only
  const clearWorkoutHistory = async () => {
    await db.workoutSessions.clear();
    await db.personalRecords.clear();
    await db.bodyMetrics.clear();
    setConfirmClear(false);
    loadMetrics();
  };

  // Full factory reset
  const factoryReset = async () => {
    await db.delete();
    localStorage.clear();
    window.location.reload();
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) => (
    <button
      onClick={() => onChange(!checked)}
      aria-label={label || 'Toggle setting'}
      style={{
        width: 44, height: 24, borderRadius: 12, padding: 2, cursor: 'pointer',
        background: checked ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.08)',
        border: checked ? 'none' : '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', flexShrink: 0,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: 'white',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );

  const SettingRow = ({
    icon: Icon, iconColor = 'var(--accent-primary)', title, desc, children, stacked = false,
  }: {
    icon: React.ElementType; iconColor?: string; title: string; desc?: string; children: React.ReactNode; stacked?: boolean;
  }) => (
    <div style={{
      display: 'flex',
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      justifyContent: 'space-between',
      gap: stacked ? 10 : 12,
      padding: '13px 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 'var(--radius-md)',
          background: `${iconColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={16} color={iconColor} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{title}</div>
          {desc && <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: 1, lineHeight: 1.35 }}>{desc}</div>}
        </div>
      </div>
      <div style={{ flexShrink: 0, width: stacked ? '100%' : 'auto' }}>
        {children}
      </div>
    </div>
  );

  const showThemeSection = appearanceFilter === 'all' || appearanceFilter === 'theme';
  const showTypographySection = appearanceFilter === 'all' || appearanceFilter === 'typography';
  const showCardsSection = appearanceFilter === 'all' || appearanceFilter === 'cards';
  const showWidgetsSection = appearanceFilter === 'all' || appearanceFilter === 'widgets';

  return (
    <div className="page-container">
      {/* Header Summary Card */}
      <div className="card-Featured animate-in" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 'var(--radius-lg)',
            background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)', flexShrink: 0,
          }}>
            <User size={24} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>{profile.name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'capitalize', marginTop: 2 }}>
              {profile.experienceLevel} • {profile.weeklyGoal}d/week goal • {profile.weightUnit.toUpperCase()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="num" style={{ fontSize: '1.1rem', color: 'var(--accent-secondary)' }}>{workoutCount}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Sessions</div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="chip-scroll" style={{ marginBottom: 18 }}>
        {([
          { id: 'general', label: 'General', icon: User },
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'workout', label: 'Workout', icon: Sliders },
          { id: 'tools', label: 'Tools', icon: Calculator },
          { id: 'data', label: 'Data', icon: Shield },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`chip ${section === tab.id ? 'active' : ''}`}
              onClick={() => setSection(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Icon size={12} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════ GENERAL SETTINGS ═══════════════ */}
      {section === 'general' && (
        <div className="animate-in">
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Athlete Profile
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your Name"
              />
              <button className="btn-primary" onClick={handleSaveName} style={{ padding: '10px 16px', flexShrink: 0, fontSize: '0.78rem' }}>
                Save
              </button>
            </div>

            <SettingRow icon={Scale} title="Weight Unit" desc="Used across all exercises, logs & calculators">
              <div style={{ display: 'flex', gap: 4 }}>
                {(['kg', 'lbs'] as const).map((u) => (
                  <button key={u} className={`chip ${profile.weightUnit === u ? 'active' : ''}`}
                    onClick={() => setWeightUnit(u)} style={{ padding: '5px 12px' }}>
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow icon={Sparkles} iconColor="#a855f7" title="Experience Level" desc="Tailors plan recommendations">
              <div style={{ display: 'flex', gap: 4 }}>
                {(['beginner', 'intermediate', 'expert'] as const).map((lvl) => (
                  <button key={lvl} className={`chip ${profile.experienceLevel === lvl ? 'active' : ''}`}
                    onClick={() => setExperienceLevel(lvl)}
                    style={{ textTransform: 'capitalize', padding: '5px 9px', fontSize: '0.68rem' }}>
                    {lvl === 'intermediate' ? 'Interm.' : lvl}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow icon={Bell} iconColor="#f59e0b" title="Weekly Goal" desc="Target training days per week">
              <div style={{ display: 'flex', gap: 4 }}>
                {[2, 3, 4, 5, 6].map((g) => (
                  <button key={g} className={`chip ${profile.weeklyGoal === g ? 'active' : ''}`}
                    onClick={() => setWeeklyGoal(g)} style={{ padding: '5px 9px', fontSize: '0.72rem' }}>
                    {g}d
                  </button>
                ))}
              </div>
            </SettingRow>
          </div>

          {/* Body Metrics Tracker */}
          <div className="card">
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Scale size={14} color="var(--accent-primary)" /> Body Metrics Log
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 14 }}>
              <input className="input" type="number" placeholder={`Weight (${profile.weightUnit})`} value={newWeight} onChange={(e) => setNewWeight(e.target.value)} style={{ minWidth: 0 }} />
              <input className="input" type="number" placeholder="Body Fat %" value={newBodyFat} onChange={(e) => setNewBodyFat(e.target.value)} style={{ minWidth: 0 }} />
              <button className="btn-primary" onClick={handleAddMetric} style={{ padding: '10px 14px', flexShrink: 0, fontSize: '0.78rem' }}>Log</button>
            </div>
            {bodyMetrics.length > 1 && (
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={bodyMetrics.map((m) => ({
                  date: new Date(m.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  weight: m.weight,
                }))}>
                  <defs>
                    <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#55556a', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#55556a', fontSize: 9 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={{ background: '#161622', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: '0.75rem' }} />
                  <Area type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} fill="url(#wGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ APPEARANCE SETTINGS (22 OPTIONS + CATEGORY FILTER) ═══════════════ */}
      {section === 'appearance' && (
        <div className="animate-in">
          {/* Pinned Live Preview Card with Solid Safe-Area Backdrop so Content Never Bleeds Behind Status Bar */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            background: 'var(--bg-primary)',
            paddingTop: 'calc(max(env(safe-area-inset-top, 18px), 18px) + 4px)',
            paddingBottom: 10,
            marginTop: -6,
            marginBottom: 10,
          }}>
            <div
              className="card"
              style={{
                padding: 13,
                border: '1px solid var(--accent-primary)',
                background: 'var(--bg-secondary)',
                boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Eye size={12} color="var(--accent-primary)" /> Live Preview (Pinned)
                </span>
                <button
                  onClick={resetAppearance}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-full)', padding: '3px 9px', fontSize: '0.64rem',
                    color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <RotateCcw size={10} /> Reset All 22
                </button>
              </div>
              <div style={{
                padding: 11, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
                border: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>Incline Barbell Press</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>4 sets × 8–10 reps • 90s rest</div>
                </div>
                <span className="badge badge-accent">Active</span>
              </div>
            </div>

            {/* Category Jump Filter to Eliminate 22-Card Scroll Fatigue */}
            <div className="chip-scroll" style={{ marginTop: 8 }}>
              {([
                { id: 'all', label: 'All (22)' },
                { id: 'theme', label: 'Theme & Color' },
                { id: 'typography', label: 'Text & Layout' },
                { id: 'cards', label: 'Cards & Nav' },
                { id: 'widgets', label: 'Widgets & A11y' },
              ] as const).map((f) => (
                <button
                  key={f.id}
                  className={`chip ${appearanceFilter === f.id ? 'active' : ''}`}
                  onClick={() => setAppearanceFilter(f.id)}
                  style={{ padding: '5px 11px', fontSize: '0.68rem' }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {showThemeSection && (
            <>
              {/* 1. Theme Surface Mode (12 themes) */}
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Moon size={14} color="var(--accent-primary)" /> 1. Surface Theme ({THEME_MODES.length} Presets)
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 12 }}>
                  Choose your dark, pitch-black OLED, tinted, or daylight surface palette
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {THEME_MODES.map((t) => {
                    const active = profile.themeMode === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setThemeMode(t.id)}
                        style={{
                          padding: 10, borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                          background: active ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)',
                          border: active ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                          display: 'flex', alignItems: 'center', gap: 9,
                        }}
                      >
                        <div style={{
                          width: 24, height: 24, borderRadius: 6, background: t.preview,
                          border: '1px solid rgba(255,255,255,0.18)', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {active && <Check size={12} color="var(--accent-primary)" />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.74rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Accent Color Palette (16 accents) */}
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Palette size={14} color="var(--accent-primary)" /> 2. Primary Accent Color ({ACCENT_COLORS.length} Swatches)
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 12 }}>
                  Highlights buttons, badges, charts & active indicators
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {ACCENT_COLORS.map((c) => {
                    const active = profile.accentColor === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setAccentColor(c.id)}
                        style={{
                          padding: '9px 6px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                          background: active ? `${c.color}20` : 'rgba(255,255,255,0.02)',
                          border: active ? `1.5px solid ${c.color}` : '1px solid var(--border-subtle)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        }}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${c.color}, ${c.secondary})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: active ? `0 0 12px ${c.color}80` : 'none',
                        }}>
                          {active && <Check size={12} color="white" />}
                        </div>
                        <span style={{ fontSize: '0.63rem', fontWeight: 600, color: active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {c.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Secondary Gradient End Color */}
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color="var(--accent-secondary)" /> 3. Secondary Gradient Accent
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                  Blend a second color into buttons, rings, and featured banners (or keep Auto)
                </p>
                <div className="chip-scroll">
                  <button
                    className={`chip ${(profile.secondaryAccentColor || 'auto') === 'auto' ? 'active' : ''}`}
                    onClick={() => setAppearance({ secondaryAccentColor: 'auto' })}
                  >
                    Auto Match
                  </button>
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      className={`chip ${profile.secondaryAccentColor === c.id ? 'active' : ''}`}
                      onClick={() => setAppearance({ secondaryAccentColor: c.id })}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {showTypographySection && (
            <div className="card" style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Type size={14} color="#06b6d4" /> 4–9. Typography & Layout Spacing
              </h3>

              <SettingRow icon={Type} iconColor="#06b6d4" title="4. Font Family" desc="Primary interface typeface">
                <select
                  className="input"
                  style={{ width: 155, padding: '6px 10px', fontSize: '0.74rem' }}
                  value={profile.fontFamily || DEFAULT_APPEARANCE.fontFamily}
                  onChange={(e) => setAppearance({ fontFamily: e.target.value as typeof profile.fontFamily })}
                >
                  {FONT_FAMILY_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label} — {f.desc}</option>
                  ))}
                </select>
              </SettingRow>

              <SettingRow icon={Type} iconColor="#38bdf8" title="5. Text Scale" desc="Global interface font size">
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['sm', 'md', 'lg', 'xl'] as FontScale[]).map((sz) => (
                    <button key={sz} className={`chip ${(profile.fontScale || 'md') === sz ? 'active' : ''}`}
                      onClick={() => setFontScale(sz)} style={{ padding: '4px 9px', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                      {sz}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow icon={Type} iconColor="#818cf8" title="6. Heading Weight" desc="Title & stat boldness">
                <div style={{ display: 'flex', gap: 4 }}>
                  {([
                    { id: 'semibold', label: '600' },
                    { id: 'bold', label: '700' },
                    { id: 'extrabold', label: '800' },
                    { id: 'black', label: '900' },
                  ] as const).map((w) => (
                    <button key={w.id} className={`chip ${(profile.headingWeight || 'extrabold') === w.id ? 'active' : ''}`}
                      onClick={() => setAppearance({ headingWeight: w.id })} style={{ padding: '4px 8px', fontSize: '0.68rem' }}>
                      {w.label}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow icon={Gauge} iconColor="#22d3ee" title="7. Monospace Numbers" desc="Tabular alignment for weights, timers & reps">
                <Toggle checked={profile.tabularNumbers ?? true} onChange={(v) => setAppearance({ tabularNumbers: v })} label="Monospace numbers" />
              </SettingRow>

              <SettingRow icon={Layout} iconColor="#10b981" title="8. Layout Density" desc="Spacing between cards and lists">
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['compact', 'comfortable', 'spacious'] as LayoutDensity[]).map((d) => (
                    <button key={d} className={`chip ${(profile.layoutDensity || 'comfortable') === d ? 'active' : ''}`}
                      onClick={() => setLayoutDensity(d)} style={{ padding: '4px 8px', fontSize: '0.66rem', textTransform: 'capitalize' }}>
                      {d === 'comfortable' ? 'Default' : d}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow icon={Smartphone} iconColor="#f59e0b" title="9. Compact Cards" desc="Tighter padding on exercise & plan cards">
                <Toggle checked={profile.compactCards ?? false} onChange={setCompactCards} label="Compact cards" />
              </SettingRow>
            </div>
          )}

          {showCardsSection && (
            <>
              {/* 10–15. Card Surface, Glass, Borders & Shadows */}
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layout size={14} color="#a855f7" /> 10–15. Card Architecture & Glassmorphism
                </h3>

                <SettingRow icon={Layout} iconColor="#a855f7" title="10. Card Surface Material" desc="Visual finish of cards & modals">
                  <select
                    className="input"
                    style={{ width: 150, padding: '6px 10px', fontSize: '0.74rem' }}
                    value={profile.cardStyle || 'glass'}
                    onChange={(e) => setAppearance({ cardStyle: e.target.value as typeof profile.cardStyle })}
                  >
                    {CARD_STYLE_OPTIONS.map((cs) => (
                      <option key={cs.id} value={cs.id}>{cs.label}</option>
                    ))}
                  </select>
                </SettingRow>

                <SettingRow icon={Compass} iconColor="#ec4899" title="11. Corner Radius" desc="Roundness of cards, inputs & buttons">
                  <div style={{ display: 'flex', gap: 4 }}>
                    {BORDER_RADIUS_OPTIONS.map((br) => (
                      <button key={br.id} className={`chip ${(profile.borderRadiusScale || 'rounded') === br.id ? 'active' : ''}`}
                        onClick={() => setAppearance({ borderRadiusScale: br.id })} style={{ padding: '4px 8px', fontSize: '0.66rem' }}>
                        {br.label}
                      </button>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow icon={Sun} iconColor="#38bdf8" title="12. Glass Blur Intensity" desc="Backdrop frost depth on panels">
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['off', 'subtle', 'medium', 'heavy'] as const).map((b) => (
                      <button key={b} className={`chip ${(profile.glassBlur || 'medium') === b ? 'active' : ''}`}
                        onClick={() => setAppearance({ glassBlur: b })} style={{ padding: '4px 8px', fontSize: '0.66rem', textTransform: 'capitalize' }}>
                        {b}
                      </button>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow icon={Sliders} iconColor="#f97316" title="13. Border Contrast" desc="Card & input outline strength">
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['minimal', 'normal', 'high', 'neon'] as const).map((bc) => (
                      <button key={bc} className={`chip ${(profile.borderContrast || 'normal') === bc ? 'active' : ''}`}
                        onClick={() => setAppearance({ borderContrast: bc })} style={{ padding: '4px 8px', fontSize: '0.66rem', textTransform: 'capitalize' }}>
                        {bc}
                      </button>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow icon={Moon} iconColor="#64748b" title="14. Card Elevation Shadow" desc="Drop shadow depth under cards">
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['flat', 'soft', 'deep', 'dramatic'] as const).map((sh) => (
                      <button key={sh} className={`chip ${(profile.shadowDepth || 'soft') === sh ? 'active' : ''}`}
                        onClick={() => setAppearance({ shadowDepth: sh })} style={{ padding: '4px 8px', fontSize: '0.66rem', textTransform: 'capitalize' }}>
                        {sh}
                      </button>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow icon={Sparkles} iconColor="#c084fc" title="15. Ambient Background Glow" desc="Top radial accent aura behind pages">
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['off', 'subtle', 'vibrant', 'aurora'] as const).map((g) => (
                      <button key={g} className={`chip ${(profile.ambientGlow || 'subtle') === g ? 'active' : ''}`}
                        onClick={() => setAppearance({ ambientGlow: g })} style={{ padding: '4px 8px', fontSize: '0.66rem', textTransform: 'capitalize' }}>
                        {g}
                      </button>
                    ))}
                  </div>
                </SettingRow>
              </div>

              {/* 16–18. Navigation & Motion */}
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Compass size={14} color="#10b981" /> 16–18. Navigation Dock & Motion
                </h3>

                <SettingRow icon={Compass} iconColor="#10b981" title="16. Bottom Navigation Style" desc="Dock shape and layout">
                  <select
                    className="input"
                    style={{ width: 150, padding: '6px 10px', fontSize: '0.74rem' }}
                    value={profile.navStyle || 'floating'}
                    onChange={(e) => setAppearance({ navStyle: e.target.value as typeof profile.navStyle })}
                  >
                    {NAV_STYLE_OPTIONS.map((ns) => (
                      <option key={ns.id} value={ns.id}>{ns.label}</option>
                    ))}
                  </select>
                </SettingRow>

                <SettingRow icon={Eye} iconColor="#14b8a6" title="17. Navigation Labels" desc="Show text labels below dock icons">
                  <Toggle checked={profile.showNavLabels ?? true} onChange={(v) => setAppearance({ showNavLabels: v })} label="Navigation labels" />
                </SettingRow>

                <SettingRow icon={Sparkles} iconColor="#a855f7" title="18. Animation Speed" desc="Page transitions & micro-interactions">
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['off', 'snappy', 'normal', 'relaxed'] as const).map((sp) => (
                      <button
                        key={sp}
                        className={`chip ${(profile.animationSpeed || (profile.animationsEnabled === false ? 'off' : 'normal')) === sp ? 'active' : ''}`}
                        onClick={() => {
                          setAppearance({ animationSpeed: sp });
                          setAnimationsEnabled(sp !== 'off');
                        }}
                        style={{ padding: '4px 8px', fontSize: '0.66rem', textTransform: 'capitalize' }}
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                </SettingRow>
              </div>
            </>
          )}

          {showWidgetsSection && (
            <div className="card">
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Accessibility size={14} color="#f59e0b" /> 19–22. Widgets, Media & Accessibility
              </h3>

              <SettingRow icon={Sun} iconColor="#f59e0b" title="19. Progress Bar Style" desc="Workout & muscle progress fill look">
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['solid', 'gradient', 'striped', 'glow'] as const).map((pb) => (
                    <button key={pb} className={`chip ${(profile.progressBarStyle || 'gradient') === pb ? 'active' : ''}`}
                      onClick={() => setAppearance({ progressBarStyle: pb })} style={{ padding: '4px 8px', fontSize: '0.66rem', textTransform: 'capitalize' }}>
                      {pb}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow icon={Gauge} iconColor="#ec4899" title="20. Set Row Density" desc="Height of weight/rep rows during workouts">
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['compact', 'regular', 'tall'] as const).map((sr) => (
                    <button key={sr} className={`chip ${(profile.setRowStyle || 'regular') === sr ? 'active' : ''}`}
                      onClick={() => setAppearance({ setRowStyle: sr })} style={{ padding: '4px 8px', fontSize: '0.66rem', textTransform: 'capitalize' }}>
                      {sr}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow icon={Smartphone} iconColor="#6366f1" title="21. Exercise Media Preview Size" desc="Height of GIF & frame demonstrations">
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['compact', 'standard', 'large', 'hidden'] as const).map((ms) => (
                    <button key={ms} className={`chip ${(profile.exerciseMediaSize || 'standard') === ms ? 'active' : ''}`}
                      onClick={() => setAppearance({ exerciseMediaSize: ms })} style={{ padding: '4px 8px', fontSize: '0.66rem', textTransform: 'capitalize' }}>
                      {ms}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow icon={Accessibility} iconColor="#10b981" title="22. High Contrast Text" desc="Boost secondary text legibility in bright gyms">
                <Toggle checked={profile.highContrastText ?? false} onChange={(v) => setAppearance({ highContrastText: v })} label="High contrast text" />
              </SettingRow>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ WORKOUT PREFERENCES ═══════════════ */}
      {section === 'workout' && (
        <div className="animate-in">
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>
              Active Workout Behavior
            </h3>

            <SettingRow
              icon={Sparkles}
              iconColor="#a855f7"
              title="Exercise Variety"
              desc="Keep exercises consistent week-to-week or rotate balanced alternatives"
              stacked
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {([
                  { id: 'consistent', label: 'Consistent' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'high', label: 'Rotate' },
                ] as const).map((v) => (
                  <button
                    key={v.id}
                    className={`chip ${(profile.exerciseVariety || 'balanced') === v.id ? 'active' : ''}`}
                    onClick={() => setAppearance({ exerciseVariety: v.id })}
                    style={{ padding: '7px 8px', fontSize: '0.72rem', justifyContent: 'center' }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow
              icon={Bell}
              iconColor="var(--accent-primary)"
              title="Default Rest Duration"
              desc="Auto-start rest timer duration after completing a set"
              stacked
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {[30, 60, 90, 120, 180, 300].map((t) => (
                  <button
                    key={t}
                    className={`chip ${profile.restTimerDefault === t ? 'active' : ''}`}
                    onClick={() => setRestTimer(t)}
                    style={{ padding: '7px 4px', fontSize: '0.72rem', justifyContent: 'center' }}
                  >
                    {t < 60 ? `${t}s` : `${t / 60}m`}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow icon={Sliders} iconColor="#10b981" title="Auto-Start Rest Timer" desc="Start countdown immediately when a set is checked">
              <Toggle checked={profile.autoRestTimer ?? true} onChange={setAutoRestTimer} label="Auto-start rest timer" />
            </SettingRow>

            <SettingRow icon={Volume2} iconColor="#06b6d4" title="Rest Timer Sound" desc="Play audio chime when rest period ends">
              <Toggle checked={profile.restTimerSound ?? true} onChange={setRestTimerSound} label="Rest timer sound" />
            </SettingRow>

            <SettingRow icon={Vibrate} iconColor="#f59e0b" title="Haptic Vibration" desc="Vibrate on set completion & timer finish">
              <Toggle checked={profile.restTimerVibrate ?? true} onChange={setRestTimerVibrate} label="Haptic vibration" />
            </SettingRow>

            <SettingRow icon={Sun} iconColor="#eab308" title="Keep Screen Awake" desc="Prevent phone screen from dimming mid-workout">
              <Toggle checked={profile.keepScreenAwake ?? true} onChange={setKeepScreenAwake} label="Keep screen awake" />
            </SettingRow>

            <SettingRow icon={Sparkles} iconColor="#ec4899" title="Show Warmup Sets" desc="Include warmup set suggestions on compound lifts">
              <Toggle checked={profile.showWarmupSets ?? false} onChange={setShowWarmupSets} label="Show warmup sets" />
            </SettingRow>

            <SettingRow
              icon={Scale}
              iconColor="#8b5cf6"
              title={`Weight Increment (${profile.weightUnit})`}
              desc="Step size when tapping +/- weight buttons"
              stacked
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {[0.5, 1, 1.25, 2.5, 5, 10].map((inc) => (
                  <button
                    key={inc}
                    className={`chip ${(profile.defaultWeightIncrement || 2.5) === inc ? 'active' : ''}`}
                    onClick={() => setDefaultWeightIncrement(inc)}
                    style={{ padding: '7px 4px', fontSize: '0.72rem', justifyContent: 'center' }}
                  >
                    {inc}
                  </button>
                ))}
              </div>
            </SettingRow>
          </div>
        </div>
      )}

      {/* ═══════════════ GYM TOOLS ═══════════════ */}
      {section === 'tools' && (
        <div className="animate-in">
          {/* 1RM Calculator (Responsive 2-Column Grid so Reps Never Clips Off-Screen) */}
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calculator size={15} color="var(--accent-primary)" /> One-Rep Max (1RM) Estimator
            </h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 12 }}>
              Uses averaged Epley & Brzycki strength formulas
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Weight Lifted ({profile.weightUnit})
                </label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  placeholder={`Weight (${profile.weightUnit})`}
                  value={orm1Weight}
                  onChange={(e) => setOrm1Weight(e.target.value)}
                  style={{ width: '100%', minWidth: 0 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Reps Completed
                </label>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  placeholder="Reps"
                  value={orm1Reps}
                  onChange={(e) => setOrm1Reps(e.target.value)}
                  style={{ width: '100%', minWidth: 0 }}
                />
              </div>
            </div>
            {avg1RM > 0 && (
              <>
                <div style={{
                  padding: 12, borderRadius: 'var(--radius-md)',
                  background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
                }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Estimated 1RM</span>
                  <span className="num" style={{ fontSize: '1.35rem', color: 'var(--accent-secondary)' }}>
                    {avg1RM} {profile.weightUnit}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[90, 85, 75, 65].map((pct) => (
                    <div key={pct} style={{
                      padding: '8px 6px', borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.03)', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{pct}%</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, marginTop: 2 }}>{Math.round(avg1RM * (pct / 100))}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Plate Calculator */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calculator size={15} color="#a855f7" /> Barbell Plate Loader
              </h3>
              <span className="badge" style={{ background: 'rgba(168,85,247,0.14)', color: '#c084fc', fontSize: '0.62rem' }}>
                Bar: {profile.weightUnit === 'kg' ? '20 kg' : '45 lbs'}
              </span>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginBottom: 10 }}>
              Calculates exact plates needed per side of a standard Olympic bar
            </p>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder={`Target weight (${profile.weightUnit})`}
              value={plateWeight}
              onChange={(e) => setPlateWeight(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div className="chip-scroll" style={{ marginBottom: 10 }}>
              {(profile.weightUnit === 'kg' ? [60, 80, 100, 120, 140, 180] : [135, 185, 225, 275, 315, 405]).map((preset) => (
                <button
                  key={preset}
                  className={`chip ${Number(plateWeight) === preset ? 'active' : ''}`}
                  onClick={() => setPlateWeight(String(preset))}
                  style={{ padding: '4px 10px', fontSize: '0.68rem' }}
                >
                  {preset} {profile.weightUnit}
                </button>
              ))}
            </div>
            {Number(plateWeight) > 0 && (
              <div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Per side (excluding {profile.weightUnit === 'kg' ? '20kg' : '45lb'} bar):
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {calculatePlates().length === 0 ? (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Just the empty bar!</span>
                  ) : (
                    calculatePlates().map((p, i) => (
                      <span key={i} className="badge badge-accent" style={{ fontSize: '0.75rem', padding: '5px 11px' }}>
                        {p.count}× {p.plate}{profile.weightUnit}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Hydration Tracker */}
          <div className="card">
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Droplets size={15} color="#06b6d4" /> Daily Hydration ({waterGlasses} / 8 glasses)
            </h3>
            <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  onClick={() => handleWater(i < waterGlasses ? -1 : 1)}
                  style={{
                    width: 30, height: 36, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    background: i < waterGlasses ? 'linear-gradient(180deg, #06b6d4, #0284c7)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.2s',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={() => handleWater(1)} style={{ flex: 1, padding: 9, fontSize: '0.78rem' }}>+ 1 Glass (250ml)</button>
              <button className="btn-secondary" onClick={() => handleWater(-1)} style={{ padding: '9px 14px', fontSize: '0.78rem' }}>−</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DATA & PRIVACY ═══════════════ */}
      {section === 'data' && (
        <div className="animate-in">
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>Local Database Summary</h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 12 }}>
              100% offline-first storage on your device — no cloud account required.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{workoutCount}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>Sessions</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{prCount}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>Records</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{bodyMetrics.length}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>Metrics</div>
              </div>
            </div>
          </div>

          {exportStatus && (
            <div className="card" style={{ marginBottom: 12, padding: 12, borderColor: 'var(--accent-primary)', color: 'var(--accent-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
              {exportStatus}
            </div>
          )}

          {importStatus && (
            <div className="card" style={{ marginBottom: 12, padding: 12, borderColor: 'var(--success)', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
              {importStatus}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="card" onClick={exportData} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Download size={16} color="var(--accent-primary)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>Export Full Backup</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Save or share all workouts, plans & PRs as JSON</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="badge badge-accent" style={{ fontSize: '0.64rem' }}>Export</span>
                <ChevronRight size={15} color="var(--text-tertiary)" />
              </div>
            </button>

            <button className="card" onClick={importData} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={16} color="var(--success)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>Restore from Backup</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Import a previously exported IronForge JSON file</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="badge badge-success" style={{ fontSize: '0.64rem' }}>Restore</span>
                <ChevronRight size={15} color="var(--text-tertiary)" />
              </div>
            </button>

            <button className="card" onClick={() => setConfirmClear(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={16} color="var(--warning)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--warning)' }}>Clear Workout History</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Reset logged sessions & PRs while keeping plans</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="badge badge-warning" style={{ fontSize: '0.64rem' }}>Clear</span>
                <ChevronRight size={15} color="var(--text-tertiary)" />
              </div>
            </button>

            <button className="card" onClick={() => setConfirmReset(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, width: '100%', textAlign: 'left', borderColor: 'rgba(239,68,68,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={16} color="var(--danger)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--danger)' }}>Factory Reset App</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Erase all data and re-seed default database</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="badge badge-danger" style={{ fontSize: '0.64rem' }}>Reset</span>
                <ChevronRight size={15} color="var(--text-tertiary)" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Clear History Confirmation Modal */}
      {confirmClear && (
        <div className="modal-overlay" onClick={() => setConfirmClear(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: 24 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>Clear Workout History?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 20 }}>
              This will delete your logged workouts, personal records, and body metrics. Your workout plans and settings will be kept.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" onClick={() => setConfirmClear(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-danger" onClick={clearWorkoutHistory} style={{ flex: 1 }}>Clear History</button>
            </div>
          </div>
        </div>
      )}

      {/* Factory Reset Confirmation Modal */}
      {confirmReset && (
        <div className="modal-overlay" onClick={() => setConfirmReset(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: 24 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>Factory Reset IronForge?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 20 }}>
              This will permanently erase all custom plans, workout history, PRs, and preferences.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" onClick={() => setConfirmReset(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-danger" onClick={factoryReset} style={{ flex: 1 }}>Erase Everything</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '24px 0 8px', color: 'var(--text-tertiary)', fontSize: '0.68rem' }}>
        IronForge Workout Tracker v5.2.0 • Precision Engineered
      </div>
    </div>
  );
}
