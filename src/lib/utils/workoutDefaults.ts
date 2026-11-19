interface WorkoutWeightDefaults {
  equipment?: string | null;
  plannedWeight?: number | null;
  barWeight: number;
  dumbbellWeight: number;
}

export function getWorkoutStartingWeight({
  equipment,
  plannedWeight,
  barWeight,
  dumbbellWeight,
}: WorkoutWeightDefaults): number {
  if (typeof plannedWeight === 'number' && plannedWeight > 0) {
    return plannedWeight;
  }

  const normalizedEquipment = (equipment || '').toLowerCase();

  if (normalizedEquipment.includes('dumbbell')) {
    return dumbbellWeight;
  }

  if (
    normalizedEquipment.includes('barbell') ||
    normalizedEquipment.includes('smith') ||
    normalizedEquipment.includes('trap bar') ||
    normalizedEquipment.includes('ez bar')
  ) {
    return barWeight;
  }

  return 0;
}

// Minimal valid base64 WebM silent video clip for NoSleep fallback
const TINY_SILENT_WEBM =
  'data:video/webm;base64,GkXfowEAAAAAAAAfQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aGFtbXlXQUAGd2hhbW15RIlACECPQAAAAAAAFlSua0AxrkAu14EBY8WBAZyBACK1nEADdW5khkAFVl9WUDglhohAA1ZQOIOBAeBABrCBCLqBCB9DtnVAIueBAKNAHIEAAIAwAQCdASoIAAgAAUAmJaQAA3AA/vz0AAA=';

interface WakeLockSentinelLike {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

/**
 * Multi-layered Screen Wake Lock controller for active workouts.
 * Combines:
 * 1. Native Android Capacitor JavascriptInterface (`window.IronForgeNative.setKeepScreenOn`)
 * 2. W3C Screen Wake Lock API (`navigator.wakeLock.request('screen')`) with automatic
 *    re-acquisition on visibilitychange, window focus, and user touch/pointer interactions
 * 3. NoSleep HTML5 muted inline looping video fallback for mobile WebViews/browsers
 *    that do not expose or silently drop `navigator.wakeLock`.
 */
export function createKeepScreenAwakeController(onStatusChange?: (locked: boolean) => void) {
  let active = false;
  let sentinel: WakeLockSentinelLike | null = null;
  let fallbackVideo: HTMLVideoElement | null = null;
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;

  const notify = (locked: boolean) => {
    onStatusChange?.(locked);
  };

  const setNativeKeepScreenOn = (enabled: boolean) => {
    if (typeof window === 'undefined') return false;
    try {
      const nativeBridge = (window as any).IronForgeNative;
      if (nativeBridge && typeof nativeBridge.setKeepScreenOn === 'function') {
        nativeBridge.setKeepScreenOn(enabled);
        return true;
      }
    } catch {}
    return false;
  };

  const ensureFallbackVideo = () => {
    if (typeof document === 'undefined') return;
    try {
      if (!fallbackVideo) {
        const v = document.createElement('video');
        v.setAttribute('playsinline', 'true');
        v.setAttribute('webkit-playsinline', 'true');
        v.setAttribute('muted', 'true');
        v.muted = true;
        v.loop = true;
        v.src = TINY_SILENT_WEBM;
        v.style.position = 'fixed';
        v.style.width = '1px';
        v.style.height = '1px';
        v.style.opacity = '0.001';
        v.style.pointerEvents = 'none';
        v.style.bottom = '0';
        v.style.right = '0';
        v.style.zIndex = '-1';
        document.body.appendChild(v);
        fallbackVideo = v;
      }
      if (fallbackVideo.paused) {
        const playPromise = fallbackVideo.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      }
    } catch {}
  };

  const stopFallbackVideo = () => {
    if (!fallbackVideo) return;
    try {
      fallbackVideo.pause();
      fallbackVideo.removeAttribute('src');
      fallbackVideo.load();
      fallbackVideo.remove();
    } catch {}
    fallbackVideo = null;
  };

  const requestWakeLock = async () => {
    if (!active || typeof window === 'undefined' || typeof document === 'undefined') return;

    const nativeOk = setNativeKeepScreenOn(true);

    if (document.visibilityState && document.visibilityState !== 'visible') {
      return;
    }

    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
        if (!sentinel || sentinel.released) {
          sentinel = await (navigator as any).wakeLock.request('screen');
          sentinel?.addEventListener?.('release', () => {
            if (active && document.visibilityState === 'visible') {
              void requestWakeLock();
            }
          });
        }
        notify(true);
      } else {
        notify(nativeOk);
      }
    } catch {
      notify(nativeOk);
    }

    if (!nativeOk && (!sentinel || sentinel.released)) {
      ensureFallbackVideo();
    } else {
      stopFallbackVideo();
    }
  };

  const handleVisibilityOrFocus = () => {
    if (!active) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void requestWakeLock();
    }
  };

  const handleUserInteraction = () => {
    if (!active) return;
    if (!sentinel || sentinel.released) {
      void requestWakeLock();
    }
  };

  const start = () => {
    if (active || typeof window === 'undefined') return;
    active = true;
    void requestWakeLock();

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);
    document.addEventListener('touchstart', handleUserInteraction, { passive: true });
    document.addEventListener('click', handleUserInteraction, { passive: true });

    watchdogTimer = setInterval(() => {
      if (!active) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const nativeOk = setNativeKeepScreenOn(true);
        if (!sentinel || sentinel.released) {
          void requestWakeLock();
        }
        if (!nativeOk && (!sentinel || sentinel.released)) {
          ensureFallbackVideo();
        } else {
          stopFallbackVideo();
        }
      }
    }, 10000);
  };

  const stop = () => {
    active = false;
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('click', handleUserInteraction);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('pageshow', handleVisibilityOrFocus);
    }
    if (sentinel) {
      try {
        void sentinel.release();
      } catch {}
      sentinel = null;
    }
    stopFallbackVideo();
    setNativeKeepScreenOn(false);
    notify(false);
  };

  return { start, stop };
}


export type WorkoutHapticMode = 'light' | 'medium' | 'success' | 'warning';
export type WorkoutSoundMode = 'set' | 'finish' | 'rest' | 'tick' | 'pr';

let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

/**
 * Unlocks Web Audio on the first user touch/click so Android WebView & iOS Safari
 * play workout chimes reliably even from timer callbacks (e.g. rest countdown finish).
 */
export function unlockAudioContext(): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {}
}

function scheduleWebAudioTones(ctx: AudioContext, mode: WorkoutSoundMode): void {
  const now = ctx.currentTime + 0.005;
  const sequence: Array<{ freq: number; dur: number; gap: number; vol: number; type?: OscillatorType }> =
    mode === 'finish' || mode === 'pr'
      ? [
          { freq: 587.33, dur: 0.09, gap: 0.085, vol: 0.16, type: 'triangle' },
          { freq: 739.99, dur: 0.09, gap: 0.085, vol: 0.16, type: 'triangle' },
          { freq: 880.0, dur: 0.1, gap: 0.09, vol: 0.17, type: 'triangle' },
          { freq: 1174.66, dur: 0.18, gap: 0.1, vol: 0.19, type: 'sine' },
        ]
      : mode === 'rest'
        ? [
            { freq: 880.0, dur: 0.11, gap: 0.11, vol: 0.18, type: 'triangle' },
            { freq: 1174.66, dur: 0.11, gap: 0.11, vol: 0.18, type: 'triangle' },
            { freq: 1318.51, dur: 0.16, gap: 0.12, vol: 0.2, type: 'sine' },
          ]
        : mode === 'tick'
          ? [{ freq: 620.0, dur: 0.055, gap: 0.06, vol: 0.11, type: 'sine' }]
          : [
              { freq: 660.0, dur: 0.065, gap: 0.06, vol: 0.14, type: 'triangle' },
              { freq: 880.0, dur: 0.095, gap: 0.07, vol: 0.16, type: 'sine' },
            ];

  let offset = 0;
  for (const step of sequence) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + offset;
    const stop = start + step.dur;
    osc.type = step.type || 'sine';
    osc.frequency.setValueAtTime(step.freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(step.vol, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(stop + 0.01);
    offset += step.gap;
  }
}

export function playWorkoutSound(mode: WorkoutSoundMode, enabled = true): void {
  if (!enabled || typeof window === 'undefined') return;
  const triggerNativeFallback = () => {
    try {
      const nativeBridge = (window as any).IronForgeNative;
      if (nativeBridge && typeof nativeBridge.playTone === 'function') {
        nativeBridge.playTone(mode);
      }
    } catch {}
  };

  try {
    const ctx = getSharedAudioContext();
    if (!ctx) {
      triggerNativeFallback();
      return;
    }
    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') {
            scheduleWebAudioTones(ctx, mode);
          } else {
            triggerNativeFallback();
          }
        })
        .catch(() => {
          triggerNativeFallback();
        });
      return;
    }
    scheduleWebAudioTones(ctx, mode);
  } catch {
    triggerNativeFallback();
  }
}

export function triggerWorkoutHaptic(mode: WorkoutHapticMode = 'light', enabled = true): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const nativeBridge = (window as any).IronForgeNative;
    if (nativeBridge && typeof nativeBridge.triggerHaptic === 'function') {
      nativeBridge.triggerHaptic(mode);
      return;
    }
  } catch {}

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (mode === 'success') {
        navigator.vibrate([22, 40, 32]);
      } else if (mode === 'warning') {
        navigator.vibrate([32, 36, 32]);
      } else if (mode === 'medium') {
        navigator.vibrate(22);
      } else {
        navigator.vibrate(14);
      }
    }
  } catch {}
}

export interface PlanDayRef {
  id?: number;
  dayNumber: number;
  name: string;
}

export interface SessionDayRef {
  planId?: number;
  dayId?: number;
  planName?: string;
  dayName?: string;
  startedAt: Date | string | number;
  completedAt?: Date | string | number;
  isComplete?: boolean;
}

/**
 * Resolves which day index in the active plan should be scheduled next:
 * - Finds the most recently completed session for the active plan.
 * - Advances to the immediately following day in the plan (wrapping to day 0 after the last day).
 * - If no completed sessions exist for this plan yet, starts from the beginning (index 0).
 */
export function resolveNextPlanDayIndex(
  days: PlanDayRef[],
  sessions: SessionDayRef[],
  activePlanName?: string | null,
  activePlanId?: number | null
): number {
  if (!days || days.length === 0) return 0;
  const normalizedPlanName = (activePlanName || '').trim().toLowerCase();

  const matching = (sessions || []).filter(s => {
    if (!s || !s.isComplete) return false;
    if (activePlanId != null && s.planId != null && s.planId === activePlanId) return true;
    if (normalizedPlanName && (s.planName || '').trim().toLowerCase() === normalizedPlanName) return true;
    return false;
  });

  if (matching.length === 0) return 0;

  matching.sort((a, b) => {
    const timeA = new Date(a.completedAt || a.startedAt).getTime() || 0;
    const timeB = new Date(b.completedAt || b.startedAt).getTime() || 0;
    return timeB - timeA;
  });

  const last = matching[0];
  let lastIdx = -1;

  if (last.dayId != null) {
    lastIdx = days.findIndex(d => d.id === last.dayId);
  }

  if (lastIdx < 0 && last.dayName) {
    const targetName = last.dayName.trim().toLowerCase();
    lastIdx = days.findIndex(d => d.name.trim().toLowerCase() === targetName);
    if (lastIdx < 0) {
      lastIdx = days.findIndex(d => {
        const dn = d.name.trim().toLowerCase();
        return dn.startsWith(targetName) || targetName.startsWith(dn);
      });
    }
  }

  if (lastIdx >= 0) {
    return (lastIdx + 1) % days.length;
  }

  return matching.length % days.length;
}
