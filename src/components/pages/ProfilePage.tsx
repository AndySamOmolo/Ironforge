'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  User, Dumbbell, Scale, Calculator, Trash2, Download, Check, X, Plus,
  Volume2, Type, Minimize, RotateCcw, Vibrate, Smartphone, Timer,
  ArrowUp, Database, Zap, Bell, BellRing, Sparkles, Eye, LayoutGrid, Sliders, Shuffle, Clock,
  Settings, Palette, Wrench, Droplets, Ruler, ShieldCheck, Sun, Moon, Send, ExternalLink, Copy, Upload, Pipette,
} from 'lucide-react';
import { useReminderStore } from '@/lib/store/reminderStore';
import { db } from '@/lib/db/schema';
import { useUserStore } from '@/lib/store/userStore';
import { useWorkoutStore } from '@/lib/store/workoutStore';
import type { BodyWeight, BodyMeasurement, WaterLog } from '@/lib/types';
import { ALL_EQUIPMENT, EQUIPMENT_PRESETS } from '@/lib/utils/exerciseResolver';
import { calculatePlates } from '@/lib/utils/plateCalculator';
import CustomSelect, { ChipScrollBar } from '@/components/ui/CustomSelect';
import {
  THEME_OPTIONS,
  CUSTOM_ACCENT_OPTIONS,
  FONT_OPTIONS,
  DEFAULT_APPEARANCE,
  applyAppearanceToDOM,
  serializeAppearancePreset,
  parseAppearancePreset,
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

export default function ProfilePage() {
  const store = useUserStore();
  const {
    name, setName, unitSystem, setUnitSystem, barWeight, setBarWeight,
    dumbbellWeight, setDumbbellWeight,
    equipment, setEquipment, defaultRestTime, setDefaultRestTime,
    restTimerEnabled, toggleRestTimer,
    soundEnabled, toggleSound, hapticEnabled, toggleHaptic, notificationsEnabled, toggleNotifications,
    theme, customAccent, customAccentHex, customSecondaryHex, customBgHex, font, fontSize, fontWeightScale, numberFont, headerStyle,
    density, gridColumns, buttonStyle, cardStyle, cardBlur, surfaceTint, borderRadius,
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
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [presetStatus, setPresetStatus] = useState<string | null>(null);

  useEffect(() => {
    loadBodyWeights();
    loadMeasurements();
    loadTodayWater();
    loadDBStats();
  }, []);

  const loadMeasurements = async () => {
    try {
      const list = await db.measurements.orderBy('date').reverse().limit(15).toArray();
      setMeasurements(list);
    } catch {}
  };

  const addMeasurement = async () => {
    const clampVal = (v: number, min: number, max: number) =>
      !isNaN(v) && v > 0 ? Math.min(max, Math.max(min, v)) : undefined;
    const bf = clampVal(parseFloat(measForm.bodyFat), 1, 75);
    const waist = clampVal(parseFloat(measForm.waist), 1, 300);
    const chest = clampVal(parseFloat(measForm.chest), 1, 300);
    const arms = clampVal(parseFloat(measForm.arms), 1, 300);
    const thighs = clampVal(parseFloat(measForm.thighs), 1, 300);
    if ([bf, waist, chest, arms, thighs].every(v => v === undefined)) return;
    await db.measurements.add({
      date: new Date(),
      bodyFat: bf,
      waist,
      chest,
      arms,
      thighs,
    });
    setMeasForm({ bodyFat: '', waist: '', chest: '', arms: '', thighs: '' });
    loadMeasurements();
  };

  const getLocalTodayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
    await db.transaction('rw', db.waterLogs, async () => {
      const existing = await db.waterLogs.where('date').equals(todayKey).first();
      const nextGlasses = Math.max(0, (existing?.glasses ?? 0) + delta);
      const targetGlasses = existing?.targetGlasses || todayWater?.targetGlasses || 8;
      if (existing?.id) {
        await db.waterLogs.update(existing.id, { glasses: nextGlasses });
        setTodayWater({ ...existing, glasses: nextGlasses });
      } else {
        const id = await db.waterLogs.add({ date: todayKey, glasses: nextGlasses, targetGlasses });
        setTodayWater({ id, date: todayKey, glasses: nextGlasses, targetGlasses });
      }
    });
  };

  const loadBodyWeights = async () => {
    try {
      const weights = await db.bodyWeight.orderBy('date').reverse().limit(30).toArray();
      setBodyWeights(weights);
    } catch {}
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
      customAccentHex,
      customSecondaryHex,
      customBgHex,
      font,
      fontSize,
      fontWeightScale,
      numberFont,
      headerStyle,
      density,
      compactMode: (updates.density ?? density) === 'compact',
      gridColumns,
      buttonStyle,
      cardStyle,
      cardBlur,
      surfaceTint,
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
    saveProfileFields(nextAppearance);
  };

  const resetAppearance = () => {
    if (!confirm('Reset all appearance settings to default?')) return;
    loadFromProfile(DEFAULT_APPEARANCE);
    applyAppearanceToDOM(DEFAULT_APPEARANCE);
    saveProfileFields(DEFAULT_APPEARANCE);
  };

  const copyThemePreset = async () => {
    const json = serializeAppearancePreset({
      theme, customAccent, customAccentHex, customSecondaryHex, customBgHex,
      font, fontSize, fontWeightScale, numberFont, headerStyle, density,
      compactMode: density === 'compact', gridColumns, buttonStyle, cardStyle,
      cardBlur, surfaceTint, borderRadius, animationLevel, navStyle, bgStyle,
      accentIntensity, glowIntensity, borderThickness, glassOpacity, contrastMode,
      colorMode, textShadow,
    });
    try {
      await navigator.clipboard.writeText(json);
      setPresetStatus('Theme preset copied to clipboard');
      setTimeout(() => setPresetStatus(null), 3000);
    } catch {
      window.prompt('Copy your theme preset JSON:', json);
    }
  };

  const importThemePreset = () => {
    const raw = window.prompt('Paste an IronForge theme preset JSON:');
    if (!raw) return;
    const parsed = parseAppearancePreset(raw);
    if (!parsed) {
      setPresetStatus('Invalid theme preset JSON');
      setTimeout(() => setPresetStatus(null), 3500);
      return;
    }
    updateAppearance(parsed);
    setPresetStatus('Theme preset applied!');
    setTimeout(() => setPresetStatus(null), 3000);
  };

  const updateWorkoutSetting = <K extends keyof typeof store>(key: K, value: (typeof store)[K]) => {
    setField(key, value);
    saveProfileFields({ [key]: value });
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
      brzycki: Math.round(w * (36 / (37 - Math.min(15, r)))),
      lombardi: Math.round(w * Math.pow(r, 0.1)),
    };
  }, [oneRMWeight, oneRMReps]);

  const toggleEquipment = (eq: string) => {
    const next = equipment.includes(eq) ? equipment.filter(e => e !== eq) : [...equipment, eq];
    const safeNext = next.length > 0 ? next : ['body weight'];
    setEquipment(safeNext);
    saveProfileFields({ equipment: safeNext });
  };

  const applyEquipmentPreset = (items: string[]) => {
    setEquipment(items);
    saveProfileFields({ equipment: items });
  };

  const handleFactoryReset = async () => {
    if (!confirm('This will delete ALL data including workouts, body weight, and preferences. Continue?')) return;
    if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
    try {
      window.localStorage.removeItem('ironforge_active_workout_v1');
      window.localStorage.removeItem('ironforge_appearance_v1');
      window.localStorage.clear();
      (window as any).IronForgeNative?.clearCachedBackups?.();
    } catch {}
    await db.delete();
    window.location.reload();
  };

  const exportData = async () => {
    try {
      const [
        allPlans,
        allDays,
        sessions,
        sessionExercises,
        sets,
        bodyWeight,
        measurements,
        waterLogs,
        nutritionLogs,
        workoutReminders,
        profile,
        prs,
        swaps,
      ] = await Promise.all([
        db.workoutPlans.toArray(),
        db.workoutDays.toArray(),
        db.workoutSessions.toArray(),
        db.sessionExercises.toArray(),
        db.sets.toArray(),
        db.bodyWeight.toArray(),
        db.measurements.toArray(),
        db.waterLogs.toArray(),
        db.nutritionLogs.toArray(),
        db.workoutReminders.toArray(),
        db.userProfile.toArray(),
        db.personalRecords.toArray(),
        db.exerciseSwaps.toArray(),
      ]);
      const customPlans = allPlans.filter(p => p.isCustom);
      const customPlanIds = new Set(customPlans.map(p => p.id).filter(Boolean));
      const data = {
        version: 3,
        exportedAt: new Date().toISOString(),
        sessions,
        sessionExercises,
        sets,
        bodyWeight,
        measurements,
        waterLogs,
        nutritionLogs,
        workoutReminders,
        profile,
        prs,
        customPlans,
        workoutDays: allDays.filter(d => customPlanIds.has(d.planId)),
        swaps,
      };
      const filename = `ironforge-backup-${new Date().toISOString().split('T')[0]}.json`;
      const jsonStr = JSON.stringify(data, null, 2);
      const w = window as unknown as {
        IronForgeNative?: { exportBackupJson?: (name: string, content: string) => boolean };
      };
      if (w.IronForgeNative?.exportBackupJson) {
        const ok = w.IronForgeNative.exportBackupJson(filename, jsonStr);
        if (ok) {
          setExportStatus(`✅ Ready to share or save ${filename}`);
          setTimeout(() => setExportStatus(null), 4000);
          return;
        }
      }
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setExportStatus(`✅ Backup exported (${filename})`);
      setTimeout(() => setExportStatus(null), 4000);
    } catch {
      setExportStatus('❌ Export failed. Please try again.');
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('Backup file exceeds 25MB limit');
      }
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON structure');
      }
      const safeDate = (val: any): Date => {
        const d = val ? new Date(val) : new Date();
        return Number.isNaN(d.getTime()) ? new Date() : d;
      };
      const safeNum = (val: any, fallback = 0, max = 1000000): number => {
        const n = Number(val);
        return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : fallback;
      };

      let mergedProfileToApply: any = null;

      await db.transaction('rw', db.tables, async () => {
        if (Array.isArray(data.sessions) && data.sessions.length > 0) {
          const normalized = data.sessions.map((s: any) => ({
            ...s,
            planName: String(s.planName || 'Workout').slice(0, 120),
            dayName: String(s.dayName || 'Session').slice(0, 120),
            startedAt: safeDate(s.startedAt || s.startTime),
            completedAt: (s.completedAt || s.endTime) ? safeDate(s.completedAt || s.endTime) : undefined,
            duration: safeNum(s.duration, 0, 86400),
            totalVolume: safeNum(s.totalVolume, 0, 10000000),
            totalSets: safeNum(s.totalSets, 0, 1000),
            totalReps: safeNum(s.totalReps, 0, 50000),
            isComplete: Boolean(s.isComplete ?? true),
          }));
          await db.workoutSessions.bulkPut(normalized);
        }
        if (Array.isArray(data.sessionExercises) && data.sessionExercises.length > 0) {
          await db.sessionExercises.bulkPut(data.sessionExercises);
        }
        if (Array.isArray(data.sets) && data.sets.length > 0) {
          const normalizedSets = data.sets.map((s: any) => ({
            ...s,
            weight: safeNum(s.weight, 0, 1500),
            reps: safeNum(s.reps, 0, 999),
            completedAt: s.completedAt ? safeDate(s.completedAt) : undefined,
          }));
          await db.sets.bulkPut(normalizedSets);
        }
        if (Array.isArray(data.bodyWeight) && data.bodyWeight.length > 0) {
          await db.bodyWeight.bulkPut(
            data.bodyWeight.map((b: any) => ({
              ...b,
              weight: safeNum(b.weight, 70, 500),
              date: safeDate(b.date),
            }))
          );
        }
        if (Array.isArray(data.measurements) && data.measurements.length > 0) {
          await db.measurements.bulkPut(
            data.measurements.map((m: any) => ({
              ...m,
              date: safeDate(m.date),
              bodyFat: m.bodyFat != null ? Math.min(75, Math.max(1, safeNum(m.bodyFat, 15, 75))) : undefined,
              waist: m.waist != null ? Math.min(300, Math.max(1, safeNum(m.waist, 80, 300))) : undefined,
              chest: m.chest != null ? Math.min(300, Math.max(1, safeNum(m.chest, 100, 300))) : undefined,
              arms: m.arms != null ? Math.min(300, Math.max(1, safeNum(m.arms, 35, 300))) : undefined,
              thighs: m.thighs != null ? Math.min(300, Math.max(1, safeNum(m.thighs, 55, 300))) : undefined,
            }))
          );
        }
        if (Array.isArray(data.waterLogs) && data.waterLogs.length > 0) {
          await db.waterLogs.bulkPut(
            data.waterLogs.map((w: any) => {
              const dObj = safeDate(w.date);
              const dateStr =
                typeof w.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.date)
                  ? w.date
                  : `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
              return {
                ...w,
                date: dateStr,
                glasses: safeNum(w.glasses, 0, 100),
                targetGlasses: safeNum(w.targetGlasses, 8, 100),
              };
            })
          );
        }
        if (Array.isArray(data.nutritionLogs) && data.nutritionLogs.length > 0) {
          await db.nutritionLogs.bulkPut(
            data.nutritionLogs.map((n: any) => ({
              ...n,
              date: safeDate(n.date),
            }))
          );
        }
        if (Array.isArray(data.workoutReminders) && data.workoutReminders.length > 0) {
          await db.workoutReminders.bulkPut(
            data.workoutReminders.map((r: any) => ({
              ...r,
              createdAt: safeDate(r.createdAt),
              lastFiredAt: r.lastFiredAt ? safeDate(r.lastFiredAt) : undefined,
            }))
          );
        }
        if (Array.isArray(data.prs) && data.prs.length > 0) {
          await db.personalRecords.bulkPut(
            data.prs.map((p: any) => ({
              ...p,
              weight: safeNum(p.weight, 0, 1500),
              reps: safeNum(p.reps, 0, 999),
              estimated1RM: safeNum(p.estimated1RM, 0, 2500),
              date: safeDate(p.date || p.achievedAt),
            }))
          );
        }
        if (Array.isArray(data.customPlans) && data.customPlans.length > 0) {
          const daysList = Array.isArray(data.workoutDays) ? data.workoutDays : [];
          for (const cp of data.customPlans) {
            const oldPlanId = cp.id;
            const existing = await db.workoutPlans.where('name').equals(String(cp.name || 'Custom Plan')).first();
            const newPlanId = existing?.id
              ? existing.id
              : await db.workoutPlans.add({
                  ...cp,
                  id: undefined,
                  isCustom: true,
                  isActive: false,
                  createdAt: safeDate(cp.createdAt),
                  updatedAt: safeDate(cp.updatedAt),
                });
            const planDaysForCustom = daysList.filter((d: any) => d.planId === oldPlanId);
            if (planDaysForCustom.length > 0) {
              await db.workoutDays.where('planId').equals(newPlanId).delete();
              for (const day of planDaysForCustom) {
                await db.workoutDays.add({
                  ...day,
                  id: undefined,
                  planId: newPlanId,
                });
              }
            }
          }
        }
        if (Array.isArray(data.swaps) && data.swaps.length > 0) {
          await db.exerciseSwaps.bulkPut(
            data.swaps.map((sw: any) => ({
              ...sw,
              newGifUrl:
                typeof sw.newGifUrl === 'string' &&
                (sw.newGifUrl.startsWith('/exercises/') || sw.newGifUrl.startsWith('/exercise-images/'))
                  ? sw.newGifUrl
                  : undefined,
              swappedAt: safeDate(sw.swappedAt),
            }))
          );
        }
        if (Array.isArray(data.profile) && data.profile[0]) {
          const importedProfile = data.profile[0];
          const existingProfiles = await db.userProfile.toArray();
          const targetId = existingProfiles[0]?.id;
          mergedProfileToApply = {
            ...importedProfile,
            ...(targetId ? { id: targetId } : {}),
            isSeeded: true,
          };
          await db.userProfile.put(mergedProfileToApply);
        }
      });

      if (mergedProfileToApply) {
        loadFromProfile(mergedProfileToApply);
        applyAppearanceToDOM(mergedProfileToApply);
      }
      if (Array.isArray(data.workoutReminders) && data.workoutReminders.length > 0) {
        void useReminderStore.getState().loadReminders();
      }
      loadBodyWeights();
      loadMeasurements();
      loadTodayWater();
      loadDBStats();
      setImportStatus('✅ Backup restored successfully!');
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
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label || 'Toggle setting'}
      onClick={onToggle}
      style={{
        width: 46,
        height: 26,
        borderRadius: 999,
        border: enabled ? '1px solid color-mix(in srgb, var(--accent-green) 45%, transparent)' : '1px solid var(--border-bright)',
        background: enabled ? 'var(--gradient-mint)' : 'var(--bg-input)',
        boxShadow: enabled ? '0 0 12px color-mix(in srgb, var(--accent-green) 25%, transparent)' : 'inset 0 1px 3px rgba(0,0,0,0.35)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.22s ease',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#ffffff',
          position: 'absolute',
          top: 2,
          left: enabled ? 22 : 2,
          transition: 'left 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.35)',
        }}
      />
    </button>
  );

  const SettingRow = ({ icon: Icon, iconColor, label, description, children, stacked = false }: { icon: any; iconColor: string; label: string; description?: string; children: React.ReactNode; stacked?: boolean }) => (
    <div className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'stretch' : 'center', justifyContent: 'space-between', gap: stacked ? 10 : 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `color-mix(in srgb, ${iconColor} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${iconColor} 26%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} color={iconColor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25 }}>{label}</div>
          {description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>{description}</div>}
        </div>
      </div>
      <div style={{ width: stacked ? '100%' : 'auto', flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="icon-badge" style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-purple) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-purple) 28%, transparent)' }}>
            <Settings size={18} color="var(--accent-purple)" />
          </div>
          <div>
            <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              <span className="gradient-text">Settings</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>Customize your equipment, appearance &amp; workout engine</p>
          </div>
        </div>
      </motion.div>

      {/* Tab Bar */}
      <ChipScrollBar
        dropdownTitle="Settings Sections"
        ariaLabel="Settings tabs"
        items={[
          { id: 'profile', label: 'Profile & Gear', icon: <User size={12} />, isActive: activeTab === 'profile', onClick: () => setActiveTab('profile') },
          { id: 'appearance', label: 'Appearance', icon: <Palette size={12} />, isActive: activeTab === 'appearance', onClick: () => setActiveTab('appearance') },
          { id: 'workout', label: 'Workout', icon: <Dumbbell size={12} />, isActive: activeTab === 'workout', onClick: () => setActiveTab('workout') },
          { id: 'tools', label: 'Tools', icon: <Wrench size={12} />, isActive: activeTab === 'tools', onClick: () => setActiveTab('tools') },
          { id: 'data', label: 'Data', icon: <Database size={12} />, isActive: activeTab === 'data', onClick: () => setActiveTab('data') },
        ]}
      />

      {/* ======== PROFILE TAB ======== */}
      {activeTab === 'profile' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SettingRow icon={User} iconColor="var(--accent-purple)" label="Name">
            <input value={name} onChange={e => { setName(e.target.value); saveProfileFields({ name: e.target.value }); }}
              style={{ width: 140, background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, outline: 'none', fontFamily: 'inherit', padding: 0, textAlign: 'right' }} />
          </SettingRow>

          <SettingRow icon={Scale} iconColor="var(--accent-green)" label="Units" description="Weight & measurement system">
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 10, padding: 3 }}>
              {(['metric', 'imperial'] as const).map(sys => (
                <button key={sys} onClick={() => {
                  setUnitSystem(sys);
                  const nextState = useUserStore.getState();
                  saveProfileFields({
                    unitSystem: sys,
                    barWeight: nextState.barWeight,
                    dumbbellWeight: nextState.dumbbellWeight,
                    weightIncrement: nextState.weightIncrement,
                  });
                }}
                  style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: unitSystem === sys ? 'var(--gradient-fire)' : 'transparent', color: unitSystem === sys ? 'var(--text-on-accent)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
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
                    saveProfileFields({ barWeight: normalized });
                  }
                }}
                style={{ width: 86, textAlign: 'right', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-bright)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 26 }}>{unitSystem === 'metric' ? 'kg' : 'lbs'}</span>
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
                    saveProfileFields({ dumbbellWeight: normalized });
                  }
                }}
                style={{ width: 86, textAlign: 'right', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-bright)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 26 }}>{unitSystem === 'metric' ? 'kg' : 'lbs'}</span>
            </div>
          </SettingRow>

          {/* Equipment Presets */}
          <div className="section-label" style={{ marginTop: 10 }}>Quick Equipment Presets</div>
          <ChipScrollBar
            dropdownTitle="Equipment Presets"
            ariaLabel="Quick equipment presets"
            style={{ marginBottom: 4 }}
            chipStyle={{ fontSize: 11, padding: '6px 11px', minHeight: 32 }}
            items={EQUIPMENT_PRESETS.map(preset => ({
              id: preset.id,
              label: preset.label,
              icon: <span>{preset.icon}</span>,
              onClick: () => applyEquipmentPreset(preset.items),
            }))}
          />

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
                <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', textAlign: 'left', flex: 1, minWidth: 0, lineHeight: 1.25 }}>{eq}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ======== APPEARANCE TAB ======== */}
      {activeTab === 'appearance' && (
        <>
          {/* Sticky Live Preview Banner — stays pinned at top while scrolling all appearance controls */}
          <div className="card hero-gradient live-preview-sticky" style={{ padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent-green) 14%, transparent)', color: 'var(--accent-green)', border: '1px solid color-mix(in srgb, var(--accent-green) 32%, transparent)', fontSize: 9.5, fontWeight: 800, padding: '2px 8px' }}>
                <Sparkles size={10} /> Live Studio
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button type="button" onClick={copyThemePreset} className="btn-ghost" title="Copy theme JSON" style={{ fontSize: 10.5, padding: '4px 7px', minHeight: 26, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Copy size={11} /> Copy
                </button>
                <button type="button" onClick={importThemePreset} className="btn-ghost" title="Import theme JSON" style={{ fontSize: 10.5, padding: '4px 7px', minHeight: 26, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Upload size={11} /> Import
                </button>
                <button type="button" onClick={resetAppearance} className="btn-ghost" title="Reset appearance defaults" style={{ fontSize: 10.5, padding: '4px 7px', minHeight: 26, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <RotateCcw size={11} /> Reset
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <div className="day-badge day-badge--next" style={{ width: 38, height: 38, minWidth: 38, minHeight: 38 }}>
                  <span className="day-badge__eyebrow">DAY</span>
                  <span className="day-badge__num" style={{ fontSize: 14 }}>01</span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 className="font-display" style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.2 }}>
                    <span className="gradient-text">IronForge Studio</span>
                  </h3>
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{theme}</strong> • {cardStyle} • {buttonStyle} • {font}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span className="btn-primary" style={{ width: 'auto', minHeight: 28, padding: '4px 10px', fontSize: 10, borderRadius: 8, pointerEvents: 'none', textTransform: 'none' }}>
                  Start
                </span>
                <div className="font-mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-green)' }}>
                  {unitSystem === 'metric' ? '100kg' : '225lb'}
                </div>
              </div>
            </div>
            {presetStatus && (
              <div style={{ marginTop: 7, fontSize: 10.5, fontWeight: 700, color: 'var(--accent-green)' }}>
                {presetStatus}
              </div>
            )}
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Theme Selector — Grouped into Light Mode & Dark/OLED */}
          <div>
            <div className="section-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Sun size={11} color="var(--accent-yellow)" /> Light Mode Themes ({THEME_OPTIONS.filter(t => t.isLight).length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 8, marginBottom: 16 }}>
              {THEME_OPTIONS.filter(t => t.isLight).map(t => {
                const isActive = theme === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => updateAppearance({ theme: t.id })} style={{
                    padding: '10px 4px', borderRadius: 'var(--r-md)',
                    border: isActive ? `2px solid ${t.colors[0]}` : '1px solid rgba(15, 23, 42, 0.14)',
                    background: t.colors[2], cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
                    boxShadow: isActive ? `0 0 12px ${t.colors[0]}38` : '0 1px 3px rgba(15,23,42,0.06)', minHeight: 62, transition: 'all 0.2s',
                  }} title={`${t.label} (Light)`}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.colors[0], border: '1px solid rgba(0,0,0,0.14)' }} />
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.colors[1], border: '1px solid rgba(0,0,0,0.14)' }} />
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: isActive ? t.colors[0] : '#334155', letterSpacing: 0.3 }}>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="section-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Moon size={11} color="var(--accent-purple)" /> Dark &amp; OLED Themes ({THEME_OPTIONS.filter(t => !t.isLight).length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 8 }}>
              {THEME_OPTIONS.filter(t => !t.isLight).map(t => {
                const isActive = theme === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => updateAppearance({ theme: t.id })} style={{
                    padding: '10px 4px', borderRadius: 'var(--r-md)',
                    border: isActive ? `2px solid ${t.colors[0]}` : '1px solid rgba(255, 255, 255, 0.1)',
                    background: t.colors[2], cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
                    boxShadow: isActive ? `0 0 12px ${t.colors[0]}45` : 'none', minHeight: 62, transition: 'all 0.2s',
                  }} title={`${t.label} (Dark)`}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.colors[0], border: '1px solid rgba(255,255,255,0.2)' }} />
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.colors[1], border: '1px solid rgba(255,255,255,0.2)' }} />
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: isActive ? t.colors[0] : '#cbd5e1', letterSpacing: 0.3 }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Primary Accent Override */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Primary Accent Color Override</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {CUSTOM_ACCENT_OPTIONS.map(acc => {
                const isActive = customAccent === acc.id;
                return (
                  <button key={acc.id} onClick={() => updateAppearance({ customAccent: acc.id, customAccentHex: '', customSecondaryHex: '' })} style={{
                    padding: '10px 4px', borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    background: isActive ? 'var(--bg-elevated)' : 'var(--bg-glass)',
                    border: isActive ? `2px solid ${acc.color || 'var(--accent-red)'}` : '1px solid var(--border)',
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

          {/* Custom Hex Color Studio (Unlimited Colors) */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Pipette size={11} color="var(--accent-purple)" /> Custom Hex Color Studio
              </div>
              {(customAccentHex || customSecondaryHex || customBgHex) && (
                <button
                  type="button"
                  onClick={() => updateAppearance({ customAccentHex: '', customSecondaryHex: '', customBgHex: '' })}
                  className="btn-ghost"
                  style={{ fontSize: 10.5, padding: '2px 8px', minHeight: 24, color: 'var(--accent-red)' }}
                >
                  Clear Custom Colors
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { key: 'customAccentHex' as const, label: 'Primary', value: customAccentHex || '#FF3D5A', active: Boolean(customAccentHex) },
                { key: 'customSecondaryHex' as const, label: 'Secondary', value: customSecondaryHex || '#8B5CF6', active: Boolean(customSecondaryHex) },
                { key: 'customBgHex' as const, label: 'Canvas BG', value: customBgHex || '#070710', active: Boolean(customBgHex) },
              ].map((item) => (
                <label
                  key={item.key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 6px',
                    borderRadius: 12,
                    background: 'var(--bg-input)',
                    border: item.active ? '1.5px solid var(--accent-red)' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="color"
                    value={item.value}
                    onChange={(e) => updateAppearance({ [item.key]: e.target.value })}
                    aria-label={`Pick ${item.label} color`}
                    style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</span>
                  <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {item.active ? item.value.toUpperCase() : 'Theme'}
                  </span>
                </label>
              ))}
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
                      <Check size={11} color="white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size (5 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Text & UI Scale</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {FONT_SIZE_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ fontSize: opt.id })}
                  style={{
                    padding: '12px 4px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    background: fontSize === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                    border: fontSize === opt.id ? 'none' : '1px solid var(--border)',
                    color: fontSize === opt.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                  }}>
                  <div style={{ fontSize: opt.sample, fontWeight: 800, marginBottom: 4 }}>Aa</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Number / Metrics Font */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Numbers & Metrics Font</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { id: 'mono', label: 'Monospace', sample: unitSystem === 'metric' ? '125.5 kg' : '275.5 lbs', ff: 'var(--font-jetbrains), monospace' },
                { id: 'display', label: 'Athletic', sample: unitSystem === 'metric' ? '125.5 kg' : '275.5 lbs', ff: 'var(--font-space-grotesk), sans-serif' },
                { id: 'sans', label: 'Match UI', sample: unitSystem === 'metric' ? '125.5 kg' : '275.5 lbs', ff: 'inherit' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ numberFont: opt.id })}
                  style={{
                    padding: '12px 6px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                    background: numberFont === opt.id ? 'var(--gradient-ocean)' : 'var(--bg-glass)',
                    border: numberFont === opt.id ? 'none' : '1px solid var(--border)',
                    color: numberFont === opt.id ? 'var(--text-on-ocean)' : 'var(--text-secondary)',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
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
                    border: headerStyle === opt.id ? 'none' : '1px solid var(--border)',
                    color: headerStyle === opt.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
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
                    border: density === opt.id ? 'none' : '1px solid var(--border)',
                    color: density === opt.id ? 'var(--text-on-mint)' : 'var(--text-secondary)',
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
                    border: gridColumns === opt.id ? 'none' : '1px solid var(--border)',
                    color: gridColumns === opt.id ? 'var(--text-on-ocean)' : 'var(--text-secondary)',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
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
                  border: buttonStyle === opt.id ? 'none' : '1px solid var(--border)',
                  color: buttonStyle === opt.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
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
                  border: cardStyle === opt.id ? 'none' : '1px solid var(--border)',
                  color: cardStyle === opt.id ? 'var(--text-on-ocean)' : 'var(--text-secondary)',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
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
                  border: borderRadius === opt.id ? 'none' : '1px solid var(--border)',
                  color: borderRadius === opt.id ? 'var(--text-on-mint)' : 'var(--text-secondary)',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
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
                  border: bgStyle === opt.id ? 'none' : '1px solid var(--border)',
                  color: bgStyle === opt.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
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
                  border: navStyle === opt.id ? 'none' : '1px solid var(--border)',
                  color: navStyle === opt.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Animation Level */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Animations & Transitions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { id: 'none', label: 'None', icon: '⏹️' },
                { id: 'subtle', label: 'Subtle', icon: '🌊' },
                { id: 'normal', label: 'Normal', icon: '💨' },
                { id: 'full', label: 'Max', icon: '🚀' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ animationLevel: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: animationLevel === opt.id ? 'var(--gradient-sunset)' : 'var(--bg-glass)',
                  border: animationLevel === opt.id ? 'none' : '1px solid var(--border)',
                  color: animationLevel === opt.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
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
                  border: accentIntensity === opt.id ? 'none' : '1px solid var(--border)',
                  color: accentIntensity === opt.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { id: 'none', label: 'Off', icon: '🌑' },
                { id: 'low', label: 'Subtle', icon: '💫' },
                { id: 'normal', label: 'Normal', icon: '✨' },
                { id: 'high', label: 'Intense', icon: '⚡' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ glowIntensity: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: glowIntensity === opt.id ? 'var(--gradient-mint)' : 'var(--bg-glass)',
                  border: glowIntensity === opt.id ? 'none' : '1px solid var(--border)',
                  color: glowIntensity === opt.id ? 'var(--text-on-mint)' : 'var(--text-secondary)',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { id: 'none', label: 'None', icon: '⭕' },
                { id: 'thin', label: 'Thin', icon: '📏' },
                { id: 'normal', label: 'Normal', icon: '📐' },
                { id: 'thick', label: 'Thick', icon: '📊' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ borderThickness: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: borderThickness === opt.id ? 'var(--gradient-ocean)' : 'var(--bg-glass)',
                  border: borderThickness === opt.id ? 'none' : '1px solid var(--border)',
                  color: borderThickness === opt.id ? 'var(--text-on-ocean)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Glass Opacity (4 Options) */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Surface Opacity & Blur</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { id: 'clear', label: 'Crystal', icon: '💎' },
                { id: 'light', label: 'Light', icon: '☁️' },
                { id: 'medium', label: 'Medium', icon: '🌫️' },
                { id: 'heavy', label: 'Frosted', icon: '🧊' },
              ].map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ glassOpacity: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: glassOpacity === opt.id ? 'var(--gradient-mint)' : 'var(--bg-glass)',
                  border: glassOpacity === opt.id ? 'none' : '1px solid var(--border)',
                  color: glassOpacity === opt.id ? 'var(--text-on-mint)' : 'var(--text-secondary)',
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
                  border: contrastMode === opt.id ? 'none' : '1px solid var(--border)',
                  color: contrastMode === opt.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {COLOR_MODE_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => updateAppearance({ colorMode: opt.id })} style={{
                  padding: '12px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: colorMode === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                  border: colorMode === opt.id ? 'none' : '1px solid var(--border)',
                  color: colorMode === opt.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 16 }}>{opt.icon}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2 }}>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Font Weight Scale */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Typography Weight</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { id: 'light', label: 'Light' },
                { id: 'normal', label: 'Balanced' },
                { id: 'bold', label: 'Heavy' },
              ].map(opt => (
                <button key={opt.id} type="button" onClick={() => updateAppearance({ fontWeightScale: opt.id })} style={{
                  padding: '10px 6px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: fontWeightScale === opt.id ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                  border: fontWeightScale === opt.id ? 'none' : '1px solid var(--border)',
                  color: fontWeightScale === opt.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                  fontSize: 11, fontWeight: opt.id === 'light' ? 500 : opt.id === 'bold' ? 900 : 700,
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Card Backdrop Blur */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Backdrop Blur Intensity</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { id: 'none', label: 'Off' },
                { id: 'low', label: 'Soft' },
                { id: 'normal', label: 'Normal' },
                { id: 'high', label: 'Heavy' },
              ].map(opt => (
                <button key={opt.id} type="button" onClick={() => updateAppearance({ cardBlur: opt.id })} style={{
                  padding: '10px 6px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: cardBlur === opt.id ? 'var(--gradient-ocean)' : 'var(--bg-glass)',
                  border: cardBlur === opt.id ? 'none' : '1px solid var(--border)',
                  color: cardBlur === opt.id ? 'var(--text-on-ocean)' : 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Surface Tinting */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Accent Surface Tint</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { id: 'none', label: 'Neutral' },
                { id: 'subtle', label: 'Subtle Wash' },
                { id: 'vivid', label: 'Vivid Tint' },
              ].map(opt => (
                <button key={opt.id} type="button" onClick={() => updateAppearance({ surfaceTint: opt.id })} style={{
                  padding: '10px 6px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: surfaceTint === opt.id ? 'var(--gradient-mint)' : 'var(--bg-glass)',
                  border: surfaceTint === opt.id ? 'none' : '1px solid var(--border)',
                  color: surfaceTint === opt.id ? 'var(--text-on-mint)' : 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Shadow Toggle */}
          <SettingRow icon={Type} iconColor="var(--accent-pink)" label="Text Shadow" description="Add crisp depth to headings & numbers">
            <Toggle enabled={textShadow} onToggle={() => updateAppearance({ textShadow: !textShadow })} />
          </SettingRow>

          {/* Home Dashboard Widgets Customization */}
          <div className="section-label" style={{ marginTop: 8 }}>Home Dashboard Widgets</div>
          <SettingRow icon={Eye} iconColor="var(--accent-purple)" label="Daily Motivational Quote" description="Show quote card on Home tab">
            <Toggle enabled={showDailyQuote} onToggle={() => updateWorkoutSetting('showDailyQuote', !showDailyQuote)} />
          </SettingRow>
          <SettingRow icon={Clock} iconColor="var(--accent-green)" label="Last Workout Summary" description="Show previous workout stats card">
            <Toggle enabled={showLastWorkout} onToggle={() => updateWorkoutSetting('showLastWorkout', !showLastWorkout)} />
          </SettingRow>
          <SettingRow icon={LayoutGrid} iconColor="var(--accent-cyan)" label="16-Week Activity Heatmap" description="Show consistency grid on Home tab">
            <Toggle enabled={showActivityHeatmap} onToggle={() => updateWorkoutSetting('showActivityHeatmap', !showActivityHeatmap)} />
          </SettingRow>
          <SettingRow icon={Sliders} iconColor="var(--accent-yellow)" label="Quick Navigation Cards" description="Show feature shortcut tiles on Home tab">
            <Toggle enabled={showFeatureCards} onToggle={() => updateWorkoutSetting('showFeatureCards', !showFeatureCards)} />
          </SettingRow>

          </motion.div>
        </>
      )}

      {/* ======== WORKOUT TAB ======== */}
      {activeTab === 'workout' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <SettingRow icon={Shuffle} iconColor="var(--accent-purple)" label="Exercise Variety" description="Rotate exercises across workouts" stacked>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {([
                { id: 'low' as const, label: 'Consistent' },
                { id: 'medium' as const, label: 'Balanced' },
                { id: 'high' as const, label: 'High Variety' },
              ]).map(v => (
                <button key={v.id} onClick={() => updateWorkoutSetting('exerciseVariety', v.id)}
                  style={{ padding: '8px 10px', borderRadius: 9, border: exerciseVariety === v.id ? 'none' : '1px solid var(--border)', background: exerciseVariety === v.id ? 'var(--gradient-fire)' : 'var(--bg-glass)', color: exerciseVariety === v.id ? 'var(--text-on-accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon={Timer} iconColor="var(--accent-cyan)" label="Default Rest" description="Auto-start rest timer duration" stacked>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {[30, 60, 90, 120, 180, 300].map(t => (
                <button key={t} onClick={() => { setDefaultRestTime(t); saveProfileFields({ defaultRestTime: t }); }}
                  style={{ padding: '8px 4px', borderRadius: 9, border: defaultRestTime === t ? 'none' : '1px solid var(--border)', background: defaultRestTime === t ? 'var(--gradient-fire)' : 'var(--bg-glass)', color: defaultRestTime === t ? 'var(--text-on-accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                  {t >= 60 ? `${t / 60}m` : `${t}s`}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon={ArrowUp} iconColor="var(--accent-orange)" label="Weight Increment" description="Step for +/- weight buttons in workout" stacked>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {[0.5, 1, 1.25, 2.5, 5, 10].map(inc => (
                <button key={inc} onClick={() => updateWorkoutSetting('weightIncrement', inc)}
                  style={{ padding: '8px 4px', borderRadius: 9, border: weightIncrement === inc ? 'none' : '1px solid var(--border)', background: weightIncrement === inc ? 'var(--gradient-ocean)' : 'var(--bg-glass)', color: weightIncrement === inc ? 'var(--text-on-ocean)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                  {inc}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow icon={Timer} iconColor="var(--accent-green)" label="Enable Rest Timer" description="Master toggle for rest timer overlay">
            <Toggle enabled={restTimerEnabled} onToggle={() => { toggleRestTimer(); saveProfileFields({ restTimerEnabled: !restTimerEnabled }); }} />
          </SettingRow>

          <SettingRow icon={Timer} iconColor="var(--accent-blue)" label="Auto-start Rest" description="Start rest timer after completing a set">
            <Toggle enabled={autoStartRest} onToggle={() => updateWorkoutSetting('autoStartRest', !autoStartRest)} />
          </SettingRow>

          <SettingRow icon={Zap} iconColor="var(--accent-green)" label="Auto-advance Exercises" description="Jump to next exercise when all sets done">
            <Toggle enabled={autoAdvance} onToggle={() => updateWorkoutSetting('autoAdvance', !autoAdvance)} />
          </SettingRow>

          <SettingRow icon={Clock} iconColor="var(--accent-orange)" label="Show Workout Stopwatch" description="Display elapsed time in workout header">
            <Toggle enabled={showTimer} onToggle={() => updateWorkoutSetting('showTimer', !showTimer)} />
          </SettingRow>

          <SettingRow icon={Volume2} iconColor="var(--accent-yellow)" label="Sound Effects" description="Set & rest timer completion sounds">
            <Toggle enabled={soundEnabled} onToggle={() => { toggleSound(); saveProfileFields({ soundEnabled: !soundEnabled }); }} />
          </SettingRow>

          <SettingRow icon={Bell} iconColor="var(--accent-cyan)" label="Countdown Beeps (3-2-1)" description="Audio ticks on final 3 seconds of rest">
            <Toggle enabled={countdownSound} onToggle={() => updateWorkoutSetting('countdownSound', !countdownSound)} />
          </SettingRow>

          <SettingRow icon={Vibrate} iconColor="var(--accent-pink)" label="Haptic Feedback" description="Vibrate on set & workout completion">
            <Toggle enabled={hapticEnabled} onToggle={() => { toggleHaptic(); saveProfileFields({ hapticEnabled: !hapticEnabled }); }} />
          </SettingRow>

          <SettingRow icon={Smartphone} iconColor="var(--accent-purple)" label="Keep Screen On" description="Prevent screen sleep during workouts">
            <Toggle enabled={keepScreenOn} onToggle={() => updateWorkoutSetting('keepScreenOn', !keepScreenOn)} />
          </SettingRow>

          <SettingRow icon={BellRing} iconColor="var(--accent-green)" label="Rest Timer Alerts" description="Send a notification when rest time ends">
            <Toggle
              enabled={notificationsEnabled}
              onToggle={async () => {
                const next = !notificationsEnabled;
                if (next) {
                  await useReminderStore.getState().requestPermission();
                }
                toggleNotifications();
                saveProfileFields({ notificationsEnabled: next });
              }}
            />
          </SettingRow>

          {/* Workout Reminders */}
          <ReminderSection />
        </motion.div>
      )}

      {/* ======== TOOLS TAB ======== */}
      {activeTab === 'tools' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-green) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 26%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Scale size={15} color="var(--accent-green)" />
              </div>
              <div>
                <h3 style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.2 }}>Body Weight</h3>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Track weight trend over time</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: bodyWeights.length > 0 ? 12 : 0 }}>
              <input className="tool-input" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder={`Weight (${unitSystem === 'metric' ? 'kg' : 'lbs'})`} type="number" step="0.1" style={{ flex: 1 }} />
              <button type="button" onClick={addBodyWeight} className="btn-primary" aria-label="Log body weight" style={{ width: 40, height: 38, minHeight: 38, padding: 0, borderRadius: 10, flexShrink: 0, textTransform: 'none' }}>
                <Plus size={16} />
              </button>
            </div>
            {bodyWeights.length > 1 && (
              <svg width="100%" viewBox="0 0 300 80" style={{ marginBottom: 8 }}>
                <polyline fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={weightChartPoints} />
                <polyline fill="url(#weightGrad)" stroke="none" points={`10,70 ${weightChartPoints} 290,70`} />
                <defs><linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="color-mix(in srgb, var(--accent-green) 18%, transparent)" /><stop offset="100%" stopColor="color-mix(in srgb, var(--accent-green) 1%, transparent)" /></linearGradient></defs>
              </svg>
            )}
            {bodyWeights.slice(0, 5).map(bw => (
              <div key={bw.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{new Date(bw.date).toLocaleDateString()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="font-mono" style={{ fontWeight: 700 }}>{bw.weight} {bw.unit}</span>
                  <button
                    type="button"
                    aria-label="Delete entry"
                    onClick={async () => { if (bw.id) { await db.bodyWeight.delete(bw.id); loadBodyWeights(); } }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-purple) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-purple) 26%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calculator size={15} color="var(--accent-purple)" />
              </div>
              <div>
                <h3 style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.2 }}>1RM Calculator</h3>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estimate one-rep max &amp; load percentages</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 8, marginBottom: calcOneRM ? 12 : 0 }}>
              <input className="tool-input" value={oneRMWeight} onChange={e => setOneRMWeight(e.target.value)} placeholder={`Weight (${unitSystem === 'metric' ? 'kg' : 'lbs'})`} type="number" />
              <input className="tool-input" value={oneRMReps} onChange={e => setOneRMReps(e.target.value)} placeholder="Reps" type="number" />
            </div>
            {calcOneRM && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { label: 'Epley', value: calcOneRM.epley, color: 'var(--accent-red)' },
                  { label: 'Brzycki', value: calcOneRM.brzycki, color: 'var(--accent-purple)' },
                  { label: 'Lombardi', value: calcOneRM.lombardi, color: 'var(--accent-green)' },
                ].map(est => (
                  <div key={est.label} style={{ padding: 12, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <div className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: est.color }}>{est.value}</div>
                    <div className="section-label" style={{ marginTop: 2 }}>{est.label}</div>
                  </div>
                ))}
              </div>
            )}

            {calcOneRM && (
              <div style={{ marginTop: 12 }}>
                <div className="section-label" style={{ marginBottom: 6 }}>Training Percentages (Epley)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[95, 90, 85, 80, 75, 70, 65, 60].map(pct => (
                    <div key={pct} style={{ padding: '8px 4px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
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
          <div className="card" style={{ padding: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-cyan) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-cyan) 26%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Droplets size={15} color="var(--accent-cyan)" />
                </div>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.2 }}>Daily Hydration</h3>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Daily water intake goal</div>
                </div>
              </div>
              <span className="font-mono" style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-cyan)', textAlign: 'right' }}>
                {todayWater?.glasses || 0}/{todayWater?.targetGlasses || 8} ({unitSystem === 'metric' ? `${((todayWater?.glasses || 0) * 0.25).toFixed(2)}L` : `${(todayWater?.glasses || 0) * 8}oz`})
              </span>
            </div>
            <div className="progress-bar" style={{ height: 8, marginBottom: 12 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min(100, ((todayWater?.glasses || 0) / (todayWater?.targetGlasses || 8)) * 100)}%`,
                  background: 'var(--gradient-fire)',
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => updateWater(-1)}
                className="btn-secondary"
                style={{ width: '100%', minHeight: 38, borderRadius: 10, fontSize: 12, fontWeight: 700, padding: '8px 10px' }}
              >
                − 1 Glass
              </button>
              <button
                type="button"
                onClick={() => updateWater(1)}
                className="btn-primary"
                style={{ width: '100%', minHeight: 38, borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'none', letterSpacing: 0, padding: '8px 10px' }}
              >
                + 1 Glass ({unitSystem === 'metric' ? '250ml' : '8 oz'})
              </button>
            </div>
          </div>

          {/* Body Measurements Tracker */}
          <div className="card" style={{ padding: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-orange) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-orange) 26%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ruler size={15} color="var(--accent-orange)" />
              </div>
              <div>
                <h3 style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.2 }}>Body Measurements ({unitSystem === 'metric' ? 'cm' : 'in'})</h3>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Log body fat &amp; tape measurements</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: measurements.length > 0 ? 10 : 0 }}>
              <input className="tool-input" value={measForm.bodyFat} onChange={e => setMeasForm({ ...measForm, bodyFat: e.target.value })} placeholder="Body Fat %" type="number" step="0.1" />
              <input className="tool-input" value={measForm.chest} onChange={e => setMeasForm({ ...measForm, chest: e.target.value })} placeholder="Chest" type="number" step="0.1" />
              <input className="tool-input" value={measForm.waist} onChange={e => setMeasForm({ ...measForm, waist: e.target.value })} placeholder="Waist" type="number" step="0.1" />
              <input className="tool-input" value={measForm.arms} onChange={e => setMeasForm({ ...measForm, arms: e.target.value })} placeholder="Arms" type="number" step="0.1" />
              <input className="tool-input" value={measForm.thighs} onChange={e => setMeasForm({ ...measForm, thighs: e.target.value })} placeholder="Thighs" type="number" step="0.1" />
              <button type="button" onClick={addMeasurement} className="btn-primary" style={{ width: '100%', height: 38, minHeight: 38, borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'none', letterSpacing: 0, padding: '8px 10px' }}>
                <Plus size={14} /> Log
              </button>
            </div>
            {measurements.slice(0, 5).map((m, idx) => {
              const measUnit = unitSystem === 'metric' ? 'cm' : 'in';
              return (
                <div key={m.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(m.date).toLocaleDateString()}</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {m.bodyFat && <span className="font-mono" style={{ color: 'var(--accent-yellow)' }}>{m.bodyFat}% BF</span>}
                    {m.chest && <span className="font-mono">C: {m.chest}{measUnit}</span>}
                    {m.waist && <span className="font-mono">W: {m.waist}{measUnit}</span>}
                    {m.arms && <span className="font-mono">A: {m.arms}{measUnit}</span>}
                    {m.thighs && <span className="font-mono">T: {m.thighs}{measUnit}</span>}
                    <button
                      aria-label="Delete entry"
                      onClick={async () => { if (m.id) { await db.measurements.delete(m.id); loadMeasurements(); } }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
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
                <div key={stat.label} style={{ padding: 12, borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div className="font-mono" style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div className="section-label" style={{ marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 16, border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <ShieldCheck size={15} /> Privacy &amp; Data Policy
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              All workout sessions, sets, personal records, body weight, measurements, hydration logs, and appearance preferences are stored <strong>100% locally on your device</strong> inside <code>IronForgeDB</code> (IndexedDB) and <code>localStorage</code>. Zero analytics, telemetry, or personal data is ever transmitted to external servers. External YouTube tutorial links only open when explicitly clicked. You can export a full JSON backup or permanently erase all stored data at any time below.
            </p>
          </div>

          <button className="card" onClick={exportData} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid color-mix(in srgb, var(--accent-green) 15%, transparent)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={16} color="var(--accent-green)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>Export Full Backup</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{exportStatus || 'Download or share sessions, sets, PRs, measurements & custom plans as JSON'}</div>
            </div>
          </button>

          <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid rgba(56,189,248,0.15)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUp size={16} color="var(--accent-cyan)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-cyan)' }}>Import Backup (Restore JSON)</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{importStatus || 'Restore workouts, PRs & measurements from a backup file'}</div>
            </div>
            <input type="file" accept=".json,application/json" onChange={handleImportData} style={{ display: 'none' }} />
          </label>

          <button className="card" onClick={async () => {
            if (!confirm('Delete all workout sessions? Exercise library will be kept.')) return;
            await db.transaction('rw', [db.workoutSessions, db.sets, db.sessionExercises, db.personalRecords], async () => {
              await db.workoutSessions.clear();
              await db.sets.clear();
              await db.sessionExercises.clear();
              await db.personalRecords.clear();
            });
            useWorkoutStore.getState().endWorkout();
            loadDBStats();
          }} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid color-mix(in srgb, var(--accent-yellow) 15%, transparent)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-yellow) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-yellow) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw size={16} color="var(--accent-yellow)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-yellow)' }}>Clear Workout History</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Remove all sessions but keep exercises & plans</div>
            </div>
          </button>

          <button className="card" onClick={handleFactoryReset} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', border: '1px solid color-mix(in srgb, var(--accent-red) 15%, transparent)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={16} color="var(--accent-red)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>Factory Reset</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Delete ALL data and start fresh. This cannot be undone.</div>
            </div>
          </button>

          <div style={{ textAlign: 'center', marginTop: 16, padding: 16 }}>
            <div className="font-display gradient-text" style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>IRONFORGE</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>v5.2.0 • Precision Engineered</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
              {(dbStats.exercises || 2243).toLocaleString()} Exercises • {dbStats.plans || 25} Programs • {THEME_OPTIONS.length} Themes
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ===== REMINDER SECTION ===== */
function ReminderSection() {
  const {
    reminders,
    permissionGranted,
    permissionStatus,
    loadReminders,
    addReminder,
    deleteReminder,
    toggleReminder,
    requestPermission,
    openDeviceNotificationSettings,
    sendTestNotification,
    startBackgroundCheck,
  } = useReminderStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newDay, setNewDay] = useState(new Date().getDay());
  const [newHour, setNewHour] = useState(18);
  const [newMinute, setNewMinute] = useState(0);
  const [newLabel, setNewLabel] = useState('Workout time!');
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const isNativeAndroid = typeof window !== 'undefined' && Boolean((window as unknown as { IronForgeNative?: unknown }).IronForgeNative);

  useEffect(() => { loadReminders(); }, [loadReminders]);
  useEffect(() => { if (reminders.some(r => r.isEnabled)) startBackgroundCheck(); }, [reminders, startBackgroundCheck]);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await sendTestNotification();
      setTestFeedback({ ok: res.ok, message: res.message });
      setTimeout(() => setTestFeedback(null), 5000);
    } finally {
      setIsTesting(false);
    }
  };

  const handleAdd = async () => {
    if (!permissionGranted && permissionStatus === 'default') {
      await requestPermission();
    }
    await addReminder({ dayOfWeek: newDay, timeHour: newHour, timeMinute: newMinute, isEnabled: true, label: newLabel.trim() || 'Workout time!' });
    setShowAdd(false);
    startBackgroundCheck();
  };

  const handleQuickPreset = async (hour: number, minute: number, label: string) => {
    if (!permissionGranted && permissionStatus === 'default') {
      await requestPermission();
    }
    const todayDow = new Date().getDay();
    await addReminder({ dayOfWeek: todayDow, timeHour: hour, timeMinute: minute, isEnabled: true, label });
    startBackgroundCheck();
  };

  return (
    <div className="card" style={{ padding: '14px 15px', marginTop: 4, overflow: 'visible', border: '1px solid var(--border-subtle)' }}>
      {/* Unified Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--accent-yellow) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-yellow) 28%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bell size={16} color="var(--accent-yellow)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>Workout Reminders</span>
              {permissionGranted && (
                <span className="badge" style={{ fontSize: 9, padding: '2px 7px', background: 'color-mix(in srgb, var(--accent-green) 14%, transparent)', color: 'var(--accent-green)', border: '1px solid color-mix(in srgb, var(--accent-green) 32%, transparent)' }}>
                  Active
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {reminders.length > 0
                ? `${reminders.filter((r) => r.isEnabled).length} active training alert${reminders.filter((r) => r.isEnabled).length !== 1 ? 's' : ''}`
                : 'Schedule recurring training alerts'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="btn-secondary"
            title="Send a test notification right now"
            style={{
              padding: '7px 10px',
              minHeight: 34,
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              border: '1px solid var(--border-bright)',
            }}
          >
            <Send size={12} color="var(--accent-green)" /> {isTesting ? '...' : 'Test'}
          </button>
          {!showAdd && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="btn-secondary"
              style={{
                padding: '7px 10px',
                minHeight: 34,
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                border: '1px solid var(--border-bright)',
              }}
            >
              <Plus size={13} color="var(--accent-purple)" /> Add
            </button>
          )}
        </div>
      </div>

      {/* Test Feedback Pill */}
      {testFeedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '8px 11px',
            marginBottom: 10,
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            background: testFeedback.ok ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'color-mix(in srgb, var(--accent-red) 12%, transparent)',
            border: `1px solid ${testFeedback.ok ? 'color-mix(in srgb, var(--accent-green) 35%, transparent)' : 'color-mix(in srgb, var(--accent-red) 35%, transparent)'}`,
            color: testFeedback.ok ? 'var(--accent-green)' : 'var(--accent-red)',
          }}
        >
          {testFeedback.message}
        </div>
      )}

      {/* Sleek Horizontal Permission Banner */}
      {!permissionGranted && (
        <div
          style={{
            padding: '10px 12px',
            marginBottom: 12,
            borderRadius: 12,
            background: 'color-mix(in srgb, var(--accent-yellow) 10%, var(--bg-input))',
            border: '1px solid color-mix(in srgb, var(--accent-yellow) 32%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--accent-yellow)', fontWeight: 800 }}>
              {permissionStatus === 'denied'
                ? 'OS Notifications Blocked'
                : permissionStatus === 'unsupported'
                  ? 'In-App Alerts Only'
                  : 'Notifications Paused'}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 1 }}>
              {permissionStatus === 'denied'
                ? 'Enable notifications in device settings for background alerts'
                : permissionStatus === 'unsupported'
                  ? 'This browser does not support OS alerts; in-app banners will still show'
                  : 'Allow device alerts so reminders & rest timers fire on time'}
            </div>
          </div>
          {permissionStatus === 'denied' && isNativeAndroid ? (
            <button
              type="button"
              onClick={openDeviceNotificationSettings}
              className="btn-primary"
              style={{ width: 'auto', minHeight: 34, padding: '6px 12px', borderRadius: 9, fontSize: 11, fontWeight: 800, flexShrink: 0, textTransform: 'none' }}
            >
              <ExternalLink size={12} /> Settings
            </button>
          ) : permissionStatus !== 'unsupported' ? (
            <button
              type="button"
              onClick={requestPermission}
              className="btn-primary"
              style={{ width: 'auto', minHeight: 34, padding: '6px 12px', borderRadius: 9, fontSize: 11, fontWeight: 800, flexShrink: 0, textTransform: 'none' }}
            >
              <Bell size={12} /> Enable
            </button>
          ) : null}
        </div>
      )}

      {/* Quick 1-Tap Presets when empty */}
      {reminders.length === 0 && !showAdd && (
        <div
          style={{
            padding: '12px',
            borderRadius: 12,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>
            No reminders scheduled yet. Tap a preset or create a custom alert:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {[
              { title: 'Morning Session', time: '07:00', h: 7, m: 0 },
              { title: 'Lunch Express', time: '12:30', h: 12, m: 30 },
              { title: 'Evening Lift', time: '18:00', h: 18, m: 0 },
              { title: 'Night Session', time: '20:30', h: 20, m: 30 },
            ].map((p) => (
              <button
                key={p.time}
                type="button"
                onClick={() => handleQuickPreset(p.h, p.m, p.title)}
                style={{
                  padding: '9px 10px',
                  borderRadius: 10,
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-bright)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={11} color="var(--accent-purple)" /> {p.title}
                </span>
                <span className="font-mono" style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-green)' }}>
                  {p.time}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing Reminders List */}
      {reminders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {reminders.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'var(--bg-input)',
                border: r.isEnabled ? '1px solid color-mix(in srgb, var(--accent-green) 35%, transparent)' : '1px solid var(--border-subtle)',
                opacity: r.isEnabled ? 1 : 0.65,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: r.isEnabled ? 'color-mix(in srgb, var(--accent-green) 14%, transparent)' : 'var(--bg-glass)',
                  border: `1px solid ${r.isEnabled ? 'color-mix(in srgb, var(--accent-green) 30%, transparent)' : 'var(--border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Bell size={14} color={r.isEnabled ? 'var(--accent-green)' : 'var(--text-muted)'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  {dayNames[r.dayOfWeek]} •{' '}
                  <span className="font-mono" style={{ color: 'var(--accent-green)' }}>
                    {String(r.timeHour).padStart(2, '0')}:{String(r.timeMinute).padStart(2, '0')}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.label}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={r.isEnabled}
                aria-label={`Toggle reminder ${r.label}`}
                onClick={() => r.id && toggleReminder(r.id)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 999,
                  border: r.isEnabled ? '1px solid color-mix(in srgb, var(--accent-green) 45%, transparent)' : '1px solid var(--border-bright)',
                  background: r.isEnabled ? 'var(--gradient-mint)' : 'var(--bg-glass)',
                  cursor: 'pointer',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: 2,
                    left: r.isEnabled ? 21 : 2,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              </button>
              <button
                type="button"
                aria-label={`Delete reminder ${r.label}`}
                onClick={() => r.id && deleteReminder(r.id)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 4, display: 'flex' }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Custom Reminder Builder with CustomSelect */}
      {showAdd && (
        <div
          style={{
            padding: 13,
            marginTop: reminders.length > 0 ? 10 : 0,
            borderRadius: 12,
            background: 'var(--bg-input)',
            border: '1px solid var(--accent-purple)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>New Custom Reminder</div>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              aria-label="Close reminder form"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
            >
              <X size={15} />
            </button>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Day of Week</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {dayNames.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setNewDay(i)}
                  style={{
                    padding: '8px 2px',
                    borderRadius: 8,
                    border: newDay === i ? 'none' : '1px solid var(--border-bright)',
                    background: newDay === i ? 'var(--gradient-fire)' : 'var(--bg-glass)',
                    color: newDay === i ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div className="section-label" style={{ marginBottom: 4 }}>Hour</div>
              <CustomSelect
                compact
                ariaLabel="Reminder hour"
                value={newHour}
                onChange={(val) => setNewHour(parseInt(val, 10))}
                options={Array.from({ length: 24 }, (_, i) => ({
                  value: i,
                  label: `${String(i).padStart(2, '0')}:00`,
                  badge: i < 12 ? 'AM' : 'PM',
                }))}
              />
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: 4 }}>Minute</div>
              <CustomSelect
                compact
                ariaLabel="Reminder minute"
                value={newMinute}
                onChange={(val) => setNewMinute(parseInt(val, 10))}
                options={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => ({
                  value: m,
                  label: `:${String(m).padStart(2, '0')} min`,
                }))}
              />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Reminder Note</div>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Push Day — Hit the bar!"
              style={{
                width: '100%',
                padding: '9px 12px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-bright)',
                borderRadius: 10,
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleAdd}
              className="btn-primary"
              style={{ flex: 1, minHeight: 40, borderRadius: 10, fontSize: 12, fontWeight: 800, textTransform: 'none' }}
            >
              Save Reminder
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="btn-secondary"
              style={{ flex: 1, minHeight: 40, borderRadius: 10, fontSize: 12 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== PLATE CALCULATOR ===== */
function PlateCalculator({ barWeight, unit }: { barWeight: number; unit: string }) {
  const [targetWeight, setTargetWeight] = useState('');
  const unitSys = unit === 'imperial' ? 'imperial' : 'metric';
  const targetNum = parseFloat(targetWeight);
  const plateResult = useMemo(() => {
    if (isNaN(targetNum) || targetNum < barWeight) return null;
    return calculatePlates(Math.min(1500, targetNum), barWeight, unitSys);
  }, [targetNum, barWeight, unitSys]);

  const expandedVisualPlates = useMemo(() => {
    if (!plateResult) return [];
    const list: { weight: number; color: string }[] = [];
    for (const item of plateResult.perSide) {
      for (let i = 0; i < Math.min(20, item.count); i++) {
        list.push({ weight: item.weight, color: item.color });
      }
    }
    return list;
  }, [plateResult]);

  return (
    <div className="card" style={{ padding: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-red) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 26%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Dumbbell size={15} color="var(--accent-red)" />
        </div>
        <div>
          <h3 style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.2 }}>Plate Calculator</h3>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Per-side barbell plate breakdown</div>
        </div>
      </div>
      <input className="tool-input" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder={`Target weight (${unit === 'metric' ? 'kg' : 'lbs'})`} type="number" max={1500} style={{ marginBottom: plateResult ? 10 : 0 }} />
      {plateResult && targetNum === barWeight && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
          Empty bar (no plates needed)
        </div>
      )}
      {plateResult && plateResult.perSide.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Each side ({((Math.min(1500, targetNum) - barWeight) / 2).toFixed(1)} {unit === 'metric' ? 'kg' : 'lbs'}/side)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '12px 0', overflowX: 'auto' }}>
            <div style={{ height: 8, width: 60, background: '#666', borderRadius: 2, flexShrink: 0 }} />
            {expandedVisualPlates.map((p, i) => (
              <div key={i} style={{ height: Math.max(24, 20 + p.weight * 1.2), width: Math.max(10, 6 + p.weight * 0.3), background: p.color, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800, color: 'white', writingMode: 'vertical-lr', textOrientation: 'mixed', flexShrink: 0 }}>
                {p.weight}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {plateResult.perSide.map((p, i) => (
              <span key={i} className="badge" style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30`, fontSize: 12, fontWeight: 700 }}>
                {p.weight}{unit === 'metric' ? 'kg' : 'lbs'} ×{p.count}
              </span>
            ))}
          </div>
        </div>
      )}
      {plateResult && !plateResult.isExact && (
        <div style={{ fontSize: 11, color: 'var(--accent-yellow)', fontWeight: 600, marginTop: 8 }}>
          Closest loadable weight: {plateResult.totalWeight} {unit === 'metric' ? 'kg' : 'lbs'}
        </div>
      )}
    </div>
  );
}
