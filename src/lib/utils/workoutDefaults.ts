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