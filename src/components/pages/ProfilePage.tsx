'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, Dumbbell, Scale, Calculator, Trash2, Download, ChevronRight, Check, X, Plus, TrendingUp, Moon, Volume2, Type, Maximize, Minimize, RotateCcw, Vibrate, Smartphone, Timer, ArrowUp, BarChart3, Shield, Database, Zap } from 'lucide-react';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import type { BodyWeight } from '@/lib/types';

const ALL_EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'body weight', 'machine', 'leverage machine',
  'band', 'kettlebell', 'medicine ball', 'smith machine', 'ez barbell',
  'olympic barbell', 'trap bar', 'stability ball',
];

const FONT_OPTIONS = [
  { id: 'inter', label: 'Inter', preview: 'Clean & Modern' },
  { id: 'outfit', label: 'Outfit', preview: 'Geometric & Bold' },
  { id: 'dm-sans', label: 'DM Sans', preview: 'Friendly & Warm' },
  { id: 'nunito', label: 'Nunito', preview: 'Rounded & Soft' },
  { id: 'sora', label: 'Sora', preview: 'Minimalist & Sleek' },
  { id: 'poppins', label: 'Poppins', preview: 'Versatile & Popular' },
  { id: 'raleway', label: 'Raleway', preview: 'Elegant & Thin' },
];

const FONT_SIZE_OPTIONS = [
  { id: 'small', label: 'Small', size: 'A' },
  { id: 'normal', label: 'Normal', size: 'A' },
  { id: 'large', label: 'Large', size: 'A' },
  { id: 'xlarge', label: 'X-Large', size: 'A' },
];

export default function ProfilePage() {
  const {
    name, setName, unitSystem, setUnitSystem, barWeight, setBarWeight,
    equipment, setEquipment, defaultRestTime, setDefaultRestTime,
    soundEnabled, toggleSound, hapticEnabled, toggleHaptic,
  } = useUserStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'workout' | 'tools' | 'data'>('profile');
  const [bodyWeights, setBodyWeights] = useState<BodyWeight[]>([]);
  const [newWeight, setNewWeight] = useState('');
  const [oneRMWeight, setOneRMWeight] = useState('');
  const [oneRMReps, setOneRMReps] = useState('');
  
  // Appearance
  const [currentFont, setCurrentFont] = useState('inter');
  const [currentFontSize, setCurrentFontSize] = useState('normal');
  const [compactMode, setCompactMode] = useState(false);
  const [buttonStyle, setButtonStyle] = useState('default');
  const [cardStyle, setCardStyle] = useState('glass');
  const [borderRadius, setBorderRadius] = useState('default');
  const [animLevel, setAnimLevel] = useState('normal');
  const [navStyle, setNavStyle] = useState('default');
  
  // Workout settings
  const [weightIncrement, setWeightIncrement] = useState(2.5);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [autoStartRest, setAutoStartRest] = useState(true);
  const [showTimer, setShowTimer] = useState(true);
  const [countdownSound, setCountdownSound] = useState(true);
  const [keepScreenOn, setKeepScreenOn] = useState(true);

  // DB stats
  const [dbStats, setDbStats] = useState({ exercises: 0, sessions: 0, plans: 0, size: '' });

  useEffect(() => {
    loadBodyWeights();
    loadAppearanceSettings();
    loadDBStats();
  }, []);

  const loadBodyWeights = async () => {
    try {
      const weights = await db.bodyWeight.orderBy('date').reverse().limit(30).toArray();
      setBodyWeights(weights);
    } catch {}
  };

  const loadAppearanceSettings = async () => {
    try {
      const profiles = await db.userProfile.toArray();
      if (profiles[0]) {
        const p = profiles[0] as any;
        if (p.font) { setCurrentFont(p.font); document.documentElement.setAttribute('data-font', p.font); }
        if (p.fontSize) { setCurrentFontSize(p.fontSize); document.documentElement.setAttribute('data-fontsize', p.fontSize); }
        if (p.compactMode) { setCompactMode(true); document.documentElement.setAttribute('data-compact', 'true'); }
        if (p.buttonStyle && p.buttonStyle !== 'default') { setButtonStyle(p.buttonStyle); document.documentElement.setAttribute('data-buttons', p.buttonStyle); }
        if (p.cardStyle && p.cardStyle !== 'glass') { setCardStyle(p.cardStyle); document.documentElement.setAttribute('data-cards', p.cardStyle); }
        if (p.borderRadius && p.borderRadius !== 'default') { setBorderRadius(p.borderRadius); document.documentElement.setAttribute('data-radius', p.borderRadius); }
        if (p.animationLevel && p.animationLevel !== 'normal') { setAnimLevel(p.animationLevel); document.documentElement.setAttribute('data-anim', p.animationLevel); }
        if (p.navStyle && p.navStyle !== 'default') { setNavStyle(p.navStyle); document.documentElement.setAttribute('data-nav', p.navStyle); }
        if (p.weightIncrement) setWeightIncrement(p.weightIncrement);
        if (p.autoAdvance !== undefined) setAutoAdvance(p.autoAdvance);
        if (p.autoStartRest !== undefined) setAutoStartRest(p.autoStartRest);
        if (p.keepScreenOn !== undefined) setKeepScreenOn(p.keepScreenOn);
      }
    } catch {}
  };

  const loadDBStats = async () => {
    try {
      const [exercises, sessions, plans] = await Promise.all([
        db.exercises.count(),
        db.workoutSessions.count(),
        db.workoutPlans.count(),
      ]);
      // Estimate DB size
      const estimate = await navigator?.storage?.estimate?.();
      const usageKB = estimate?.usage ? Math.round(estimate.usage / 1024) : 0;
      const sizeStr = usageKB > 1024 ? `${(usageKB / 1024).toFixed(1)} MB` : `${usageKB} KB`;
      setDbStats({ exercises, sessions, plans, size: sizeStr });
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
    if (!confirm('This will delete ALL data including workouts, body weight, and preferences. Continue?')) return;
    if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
    await db.delete();
    window.location.reload();
  };

  const saveProfileField = async (field: string, value: any) => {
    try {
      const profiles = await db.userProfile.toArray();
      if (profiles[0]?.id) await db.userProfile.update(profiles[0].id, { [field]: value });
    } catch {}
  };

  const applyFont = (fontId: string) => {
    setCurrentFont(fontId);
    document.documentElement.setAttribute('data-font', fontId);
    saveProfileField('font', fontId);
  };

  const applyFontSize = (sizeId: string) => {
    setCurrentFontSize(sizeId);
    document.documentElement.setAttribute('data-fontsize', sizeId);
    saveProfileField('fontSize', sizeId);
  };

  const toggleCompact = () => {
    const newVal = !compactMode;
    setCompactMode(newVal);
    if (newVal) document.documentElement.setAttribute('data-compact', 'true');
    else document.documentElement.removeAttribute('data-compact');
    saveProfileField('compactMode', newVal);
  };

  const exportData = async () => {
    try {
      const data = {
        sessions: await db.workoutSessions.toArray(),
        bodyWeight: await db.bodyWeight.toArray(),
        profile: await db.userProfile.toArray(),
        prs: await db.personalRecords.toArray(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ironforge-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch {}
  };

  // Body weight chart
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

  // Toggle switch component
  const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button onClick={onToggle}
      style={{ width: 48, height: 26, borderRadius: 13, border: 'none', background: enabled ? 'var(--accent-green)' : 'var(--bg-input)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: enabled ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );

  // Setting row component
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
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Customize your experience</p>
      </motion.div>

      {/* Tab Bar */}
      <div className="chip-scroll" style={{ marginBottom: 20, paddingBottom: 4 }}>
        {([
          { id: 'profile' as const, label: '👤 Profile' },
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
            <input value={name} onChange={e => { setName(e.target.value); saveProfileField('name', e.target.value); }}
              style={{ width: 140, background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, outline: 'none', fontFamily: 'inherit', padding: 0, textAlign: 'right' }} />
          </SettingRow>

          <SettingRow icon={Scale} iconColor="var(--accent-green)" label="Units" description="Weight & measurement system">
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 10, padding: 3 }}>
              {(['metric', 'imperial'] as const).map(sys => (
                <button key={sys} onClick={() => { setUnitSystem(sys); saveProfileField('unitSystem', sys); }}
                  style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: unitSystem === sys ? 'var(--gradient-fire)' : 'transparent', color: unitSystem === sys ? 'white' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {sys}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon={Dumbbell} iconColor="var(--accent-orange)" label="Bar Weight" description="Standard barbell weight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {[15, 20, 25].map(w => (
                <button key={w} onClick={() => { setBarWeight(w); saveProfileField('barWeight', w); }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: barWeight === w ? 'none' : '1px solid var(--border)', background: barWeight === w ? 'var(--gradient-ocean)' : 'transparent', color: barWeight === w ? 'white' : 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {w}kg
                </button>
              ))}
            </div>
          </SettingRow>

          {/* Equipment */}
          <div className="section-label" style={{ marginTop: 8 }}>My Equipment</div>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Theme Selector */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Theme</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {[
                { id: 'dark', label: 'Forge', colors: ['#FF3D5A', '#8B5CF6', '#070710'] },
                { id: 'ocean', label: 'Ocean', colors: ['#0EA5E9', '#6366F1', '#050c1a'] },
                { id: 'forest', label: 'Forest', colors: ['#10B981', '#D97706', '#051208'] },
                { id: 'steel', label: 'Steel', colors: ['#EF4444', '#9CA3AF', '#121214'] },
                { id: 'sunset', label: 'Sunset', colors: ['#FB923C', '#FBBF24', '#120c08'] },
                { id: 'cyberpunk', label: 'Cyber', colors: ['#FF00FF', '#00FFFF', '#0a0014'] },
                { id: 'arctic', label: 'Arctic', colors: ['#7DD3FC', '#2DD4BF', '#061222'] },
                { id: 'magma', label: 'Magma', colors: ['#FF4500', '#FF6347', '#0d0404'] },
                { id: 'lavender', label: 'Lavender', colors: ['#C084FC', '#F9A8D4', '#100818'] },
                { id: 'rose', label: 'Rose', colors: ['#BE123C', '#D4A574', '#0c0508'] },
              ].map(theme => {
                const isActive = (typeof window !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'dark' : 'dark') === theme.id;
                return (
                  <button key={theme.id} onClick={() => {
                    if (theme.id === 'dark') document.documentElement.removeAttribute('data-theme');
                    else document.documentElement.setAttribute('data-theme', theme.id);
                    saveProfileField('theme', theme.id);
                  }} style={{
                    padding: '10px 4px', borderRadius: 'var(--r-md)', border: isActive ? `2px solid ${theme.colors[0]}` : '1px solid var(--border)',
                    background: theme.colors[2], cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
                    boxShadow: isActive ? `0 0 12px ${theme.colors[0]}30` : 'none', minHeight: 60,
                  }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: theme.colors[0] }} />
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: theme.colors[1] }} />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? theme.colors[0] : '#888', letterSpacing: 0.5 }}>{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Selector */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Font</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FONT_OPTIONS.map(font => (
                <button key={font.id} onClick={() => applyFont(font.id)} className="card"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                    width: '100%', textAlign: 'left',
                    border: currentFont === font.id ? '2px solid var(--accent-red)' : '1px solid var(--border-subtle)',
                    boxShadow: currentFont === font.id ? '0 0 12px var(--glow-red)' : 'none',
                    padding: '14px 16px',
                  }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: font.id === 'dm-sans' ? 'DM Sans' : font.label }}>{font.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: font.id === 'dm-sans' ? 'DM Sans' : font.label }}>{font.preview}</div>
                  </div>
                  {currentFont === font.id && (
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--gradient-fire)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12} color="white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Font Size</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {FONT_SIZE_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => applyFontSize(opt.id)}
                  style={{
                    padding: '14px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    background: currentFontSize === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                    border: currentFontSize === opt.id ? 'none' : '1px solid var(--border)',
                    color: currentFontSize === opt.id ? 'white' : 'var(--text-secondary)',
                  }}>
                  <div style={{ fontSize: opt.id === 'small' ? 12 : opt.id === 'normal' ? 14 : opt.id === 'large' ? 18 : 22, fontWeight: 800, marginBottom: 4 }}>A</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Compact Mode */}
          <SettingRow icon={Minimize} iconColor="var(--accent-cyan)" label="Compact Mode" description="Reduce padding for more content">
            <Toggle enabled={compactMode} onToggle={toggleCompact} />
          </SettingRow>

          {/* Button Style */}
          <div>
            <div className="section-label" style={{ marginBottom: 10, marginTop: 8 }}>Button Style</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {[
                { id: 'default', label: 'Default', preview: '⬛' },
                { id: 'pill', label: 'Pill', preview: '💊' },
                { id: 'sharp', label: 'Sharp', preview: '🔲' },
                { id: 'outline', label: 'Outline', preview: '⬜' },
                { id: 'neon', label: 'Neon', preview: '✨' },
              ].map(opt => (
                <button key={opt.id} onClick={() => {
                  setButtonStyle(opt.id);
                  if (opt.id === 'default') document.documentElement.removeAttribute('data-buttons');
                  else document.documentElement.setAttribute('data-buttons', opt.id);
                  saveProfileField('buttonStyle', opt.id);
                }} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: buttonStyle === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                  border: buttonStyle === opt.id ? 'none' : '1px solid var(--border)',
                  color: buttonStyle === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.preview}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Card Style */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Card Style</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {[
                { id: 'glass', label: 'Glass', preview: '🪟' },
                { id: 'solid', label: 'Solid', preview: '🧱' },
                { id: 'outline', label: 'Outline', preview: '📐' },
                { id: 'flat', label: 'Flat', preview: '📄' },
                { id: 'neon', label: 'Neon', preview: '💡' },
              ].map(opt => (
                <button key={opt.id} onClick={() => {
                  setCardStyle(opt.id);
                  if (opt.id === 'glass') document.documentElement.removeAttribute('data-cards');
                  else document.documentElement.setAttribute('data-cards', opt.id);
                  saveProfileField('cardStyle', opt.id);
                }} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: cardStyle === opt.id ? 'var(--gradient-ocean)' : 'var(--bg-glass)',
                  border: cardStyle === opt.id ? 'none' : '1px solid var(--border)',
                  color: cardStyle === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.preview}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Border Radius */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Corner Radius</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { id: 'none', label: 'Square', icon: '⬜' },
                { id: 'small', label: 'Subtle', icon: '🔳' },
                { id: 'default', label: 'Default', icon: '⬛' },
                { id: 'large', label: 'Round', icon: '🔵' },
              ].map(opt => (
                <button key={opt.id} onClick={() => {
                  setBorderRadius(opt.id);
                  if (opt.id === 'default') document.documentElement.removeAttribute('data-radius');
                  else document.documentElement.setAttribute('data-radius', opt.id);
                  saveProfileField('borderRadius', opt.id);
                }} style={{
                  padding: '14px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: borderRadius === opt.id ? 'var(--gradient-mint)' : 'var(--bg-glass)',
                  border: borderRadius === opt.id ? 'none' : '1px solid var(--border)',
                  color: borderRadius === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Animation Level */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Animations</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { id: 'none', label: 'None', icon: '⏹️' },
                { id: 'subtle', label: 'Subtle', icon: '🌊' },
                { id: 'normal', label: 'Normal', icon: '💨' },
                { id: 'full', label: 'Max', icon: '🚀' },
              ].map(opt => (
                <button key={opt.id} onClick={() => {
                  setAnimLevel(opt.id);
                  if (opt.id === 'normal') document.documentElement.removeAttribute('data-anim');
                  else document.documentElement.setAttribute('data-anim', opt.id);
                  saveProfileField('animationLevel', opt.id);
                }} style={{
                  padding: '14px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: animLevel === opt.id ? 'var(--gradient-sunset)' : 'var(--bg-glass)',
                  border: animLevel === opt.id ? 'none' : '1px solid var(--border)',
                  color: animLevel === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Nav Style */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Navigation Bar</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { id: 'default', label: 'Blur', icon: '🫧' },
                { id: 'floating', label: 'Float', icon: '🛸' },
                { id: 'minimal', label: 'Mini', icon: '➖' },
                { id: 'solid', label: 'Solid', icon: '🧱' },
              ].map(opt => (
                <button key={opt.id} onClick={() => {
                  setNavStyle(opt.id);
                  if (opt.id === 'default') document.documentElement.removeAttribute('data-nav');
                  else document.documentElement.setAttribute('data-nav', opt.id);
                  saveProfileField('navStyle', opt.id);
                }} style={{
                  padding: '14px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: navStyle === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                  border: navStyle === opt.id ? 'none' : '1px solid var(--border)',
                  color: navStyle === opt.id ? 'white' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ======== WORKOUT TAB ======== */}
      {activeTab === 'workout' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <SettingRow icon={Timer} iconColor="var(--accent-cyan)" label="Default Rest" description="Auto-start rest timer duration">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[60, 90, 120, 180, 300].map(t => (
                <button key={t} onClick={() => { setDefaultRestTime(t); saveProfileField('defaultRestTime', t); }}
                  style={{ padding: '6px 10px', borderRadius: 8, border: defaultRestTime === t ? 'none' : '1px solid var(--border)', background: defaultRestTime === t ? 'var(--gradient-fire)' : 'transparent', color: defaultRestTime === t ? 'white' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {t >= 60 ? `${t / 60}m` : `${t}s`}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon={ArrowUp} iconColor="var(--accent-orange)" label="Weight Increment" description="Default +/- step for weight buttons">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[1, 1.25, 2.5, 5, 10].map(inc => (
                <button key={inc} onClick={() => { setWeightIncrement(inc); saveProfileField('weightIncrement', inc); }}
                  style={{ padding: '6px 10px', borderRadius: 8, border: weightIncrement === inc ? 'none' : '1px solid var(--border)', background: weightIncrement === inc ? 'var(--gradient-ocean)' : 'transparent', color: weightIncrement === inc ? 'white' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {inc}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon={Volume2} iconColor="var(--accent-yellow)" label="Sound Effects" description="Rest timer completion sound">
            <Toggle enabled={soundEnabled} onToggle={() => { toggleSound(); saveProfileField('soundEnabled', !soundEnabled); }} />
          </SettingRow>

          <SettingRow icon={Vibrate} iconColor="var(--accent-pink)" label="Haptic Feedback" description="Vibrate on set completion">
            <Toggle enabled={hapticEnabled} onToggle={() => { toggleHaptic(); saveProfileField('hapticEnabled', !hapticEnabled); }} />
          </SettingRow>

          <SettingRow icon={Zap} iconColor="var(--accent-green)" label="Auto-advance Sets" description="Jump to next exercise when all sets done">
            <Toggle enabled={autoAdvance} onToggle={() => { setAutoAdvance(!autoAdvance); saveProfileField('autoAdvance', !autoAdvance); }} />
          </SettingRow>

          <SettingRow icon={Timer} iconColor="var(--accent-blue)" label="Auto-start Rest" description="Start rest timer after completing a set">
            <Toggle enabled={autoStartRest} onToggle={() => { setAutoStartRest(!autoStartRest); saveProfileField('autoStartRest', !autoStartRest); }} />
          </SettingRow>

          <SettingRow icon={Smartphone} iconColor="var(--accent-purple)" label="Keep Screen On" description="Prevent screen sleep during workouts">
            <Toggle enabled={keepScreenOn} onToggle={() => { setKeepScreenOn(!keepScreenOn); saveProfileField('keepScreenOn', !keepScreenOn); }} />
          </SettingRow>
        </motion.div>
      )}

      {/* ======== TOOLS TAB ======== */}
      {activeTab === 'tools' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Body Weight Tracker */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={16} color="var(--accent-green)" /> Body Weight
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder={`Weight (${unitSystem === 'metric' ? 'kg' : 'lbs'})`} type="number" step="0.1"
                style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', minHeight: 46 }} />
              <button onClick={addBodyWeight} style={{ padding: '12px 18px', background: 'var(--gradient-mint)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, cursor: 'pointer', minHeight: 46 }}>
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
              <div key={bw.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
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
                style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', minHeight: 46 }} />
              <input value={oneRMReps} onChange={e => setOneRMReps(e.target.value)} placeholder="Reps" type="number"
                style={{ width: 80, padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', minHeight: 46 }} />
            </div>
            {calcOneRM && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { label: 'Epley', value: calcOneRM.epley, color: 'var(--accent-red)' },
                  { label: 'Brzycki', value: calcOneRM.brzycki, color: 'var(--accent-purple)' },
                  { label: 'Lombardi', value: calcOneRM.lombardi, color: 'var(--accent-green)' },
                ].map(est => (
                  <div key={est.label} style={{ padding: 12, borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: est.color }}>{est.value}</div>
                    <div className="section-label" style={{ marginTop: 2 }}>{est.label}</div>
                  </div>
                ))}
              </div>
            )}

            {calcOneRM && (
              <div style={{ marginTop: 12 }}>
                <div className="section-label" style={{ marginBottom: 6 }}>Training Percentages (Epley)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {[95, 90, 85, 80, 75, 70, 65, 60].map(pct => (
                    <div key={pct} style={{ padding: '8px 4px', borderRadius: 8, background: 'var(--bg-glass)', border: '1px solid var(--border)', textAlign: 'center' }}>
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

      {/* ======== DATA TAB ======== */}
      {activeTab === 'data' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* DB Stats */}
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
                <div key={stat.label} style={{ padding: 12, borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div className="font-mono" style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div className="section-label" style={{ marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Export */}
          <button className="card" onClick={exportData} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid rgba(16,232,154,0.15)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,232,154,0.1)', border: '1px solid rgba(16,232,154,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={16} color="var(--accent-green)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>Export Data</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Download workout history as JSON backup</div>
            </div>
          </button>

          {/* Clear workout history */}
          <button className="card" onClick={async () => {
            if (!confirm('Delete all workout sessions? Exercise library will be kept.')) return;
            await db.workoutSessions.clear();
            await db.sets.clear();
            await db.sessionExercises.clear();
            await db.personalRecords.clear();
            loadDBStats();
          }} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid rgba(251,191,36,0.15)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw size={16} color="var(--accent-yellow)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-yellow)' }}>Clear Workout History</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Remove all sessions but keep exercises & plans</div>
            </div>
          </button>

          {/* Factory Reset */}
          <button className="card" onClick={handleFactoryReset} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid rgba(255,61,90,0.15)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,61,90,0.1)', border: '1px solid rgba(255,61,90,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={16} color="var(--accent-red)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>Factory Reset</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Delete ALL data and start fresh. This cannot be undone.</div>
            </div>
          </button>

          {/* App info */}
          <div style={{ textAlign: 'center', marginTop: 16, padding: 16 }}>
            <div className="font-display gradient-text" style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>IRONFORGE</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>v2.0.0 • Built with ❤️</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>870+ Exercises • 12 Programs • 10 Themes</div>
          </div>
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
        style={{ width: '100%', padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 12, minHeight: 46 }} />
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
