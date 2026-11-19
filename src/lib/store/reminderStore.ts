import { create } from 'zustand';
import { db } from '@/lib/db/schema';
import type { WorkoutReminder } from '@/lib/types';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface InAppNotificationBanner {
  id: string;
  title: string;
  body: string;
  channel: 'reminder' | 'rest' | 'test';
  createdAt: number;
}

interface NativeBridge {
  showNotification?: (title: string, body: string) => boolean;
  showNotificationWithTag?: (title: string, body: string, channelId: string, tag: string) => boolean;
  hasNotificationPermission?: () => boolean;
  requestNotificationPermission?: () => void;
  openNotificationSettings?: () => void;
}

function getNativeBridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { IronForgeNative?: NativeBridge };
  return w.IronForgeNative || null;
}

export function detectNotificationPermissionStatus(): NotificationPermissionStatus {
  if (typeof window === 'undefined') return 'default';
  const native = getNativeBridge();
  if (native) {
    if (typeof native.hasNotificationPermission === 'function') {
      try {
        return native.hasNotificationPermission() ? 'granted' : 'default';
      } catch {
        return 'default';
      }
    }
    if (typeof native.showNotification === 'function') {
      return 'granted';
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'default';
}

export async function dispatchAppNotification(params: {
  title: string;
  body: string;
  tag: string;
  channel?: 'reminder' | 'rest' | 'test';
  showInAppFallback?: boolean;
}): Promise<{ delivered: boolean; channel: 'android' | 'web' | 'service-worker' | 'in-app' | 'none' }> {
  const { title, body, tag, channel = 'reminder', showInAppFallback = true } = params;
  if (typeof window === 'undefined') return { delivered: false, channel: 'none' };

  const androidChannelId = channel === 'rest' ? 'ironforge_rest_timer' : 'ironforge_reminders';

  // 1. Android Native Bridge (Capacitor WebView)
  const native = getNativeBridge();
  if (native) {
    try {
      const ok = typeof native.showNotificationWithTag === 'function'
        ? native.showNotificationWithTag(title, body, androidChannelId, tag)
        : typeof native.showNotification === 'function'
          ? native.showNotification(title, body)
          : false;
      if (ok) {
        if (showInAppFallback && document.visibilityState === 'visible') {
          useReminderStore.getState().pushInAppBanner({ title, body, channel });
        }
        return { delivered: true, channel: 'android' };
      }
    } catch {}
  }

  // 2. Service Worker Registration (best support on Android Chrome / PWA)
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag,
            silent: false,
          });
          if (showInAppFallback && document.visibilityState === 'visible') {
            useReminderStore.getState().pushInAppBanner({ title, body, channel });
          }
          return { delivered: true, channel: 'service-worker' };
        }
      }
    } catch {}

    // 3. Standard Web Notification API
    try {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag,
      });
      if (showInAppFallback && document.visibilityState === 'visible') {
        useReminderStore.getState().pushInAppBanner({ title, body, channel });
      }
      return { delivered: true, channel: 'web' };
    } catch {}
  }

  // 4. Guaranteed In-App Banner Fallback so alerts are never silently lost while app is active
  if (showInAppFallback) {
    useReminderStore.getState().pushInAppBanner({ title, body, channel });
    return { delivered: true, channel: 'in-app' };
  }

  return { delivered: false, channel: 'none' };
}

export async function notifyRestComplete(exerciseName?: string): Promise<void> {
  await dispatchAppNotification({
    title: 'Rest Complete — Next Set Ready',
    body: exerciseName ? `Time to hit your next set of ${exerciseName}.` : 'Your rest timer finished. Time for your next set!',
    tag: 'ironforge-rest-complete',
    channel: 'rest',
    showInAppFallback: false,
  });
}

interface ReminderState {
  reminders: WorkoutReminder[];
  permissionGranted: boolean;
  permissionStatus: NotificationPermissionStatus;
  intervalId: ReturnType<typeof setInterval> | null;
  activeBanner: InAppNotificationBanner | null;

  refreshPermissionStatus: () => NotificationPermissionStatus;
  loadReminders: () => Promise<void>;
  addReminder: (reminder: Omit<WorkoutReminder, 'id' | 'createdAt'>) => Promise<void>;
  updateReminder: (id: number, updates: Partial<WorkoutReminder>) => Promise<void>;
  deleteReminder: (id: number) => Promise<void>;
  toggleReminder: (id: number) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  openDeviceNotificationSettings: () => void;
  sendTestNotification: () => Promise<{ ok: boolean; channel: string; message: string }>;
  pushInAppBanner: (banner: Omit<InAppNotificationBanner, 'id' | 'createdAt'>) => void;
  dismissInAppBanner: () => void;
  checkDueRemindersNow: () => Promise<void>;
  startBackgroundCheck: () => void;
  stopBackgroundCheck: () => void;
}

let lifecycleListenersAttached = false;
let bannerAutoDismissTimer: ReturnType<typeof setTimeout> | null = null;

function attachLifecycleListeners() {
  if (lifecycleListenersAttached || typeof window === 'undefined') return;
  lifecycleListenersAttached = true;

  const onVisibleOrFocus = () => {
    if (document.visibilityState === 'visible') {
      useReminderStore.getState().refreshPermissionStatus();
      void useReminderStore.getState().checkDueRemindersNow();
    }
  };

  window.addEventListener('focus', onVisibleOrFocus);
  document.addEventListener('visibilitychange', onVisibleOrFocus);
  window.addEventListener('ironforge:notification-permission', (e: Event) => {
    const detail = (e as CustomEvent<{ granted?: boolean }>).detail;
    if (typeof detail?.granted === 'boolean') {
      useReminderStore.setState({
        permissionGranted: detail.granted,
        permissionStatus: detail.granted ? 'granted' : 'denied',
      });
    } else {
      useReminderStore.getState().refreshPermissionStatus();
    }
  });
}

export const useReminderStore = create<ReminderState>((set, get) => ({
  reminders: [],
  permissionGranted: detectNotificationPermissionStatus() === 'granted',
  permissionStatus: detectNotificationPermissionStatus(),
  intervalId: null,
  activeBanner: null,

  refreshPermissionStatus: () => {
    const status = detectNotificationPermissionStatus();
    set({ permissionStatus: status, permissionGranted: status === 'granted' });
    return status;
  },

  loadReminders: async () => {
    attachLifecycleListeners();
    try {
      const all = await db.workoutReminders.toArray();
      const status = detectNotificationPermissionStatus();
      set({
        reminders: all,
        permissionStatus: status,
        permissionGranted: status === 'granted',
      });
    } catch {
      set({ reminders: [] });
    }
  },

  addReminder: async (reminder) => {
    try {
      await db.workoutReminders.add({ ...reminder, createdAt: new Date() });
      await get().loadReminders();
      if (reminder.isEnabled && !get().intervalId) {
        get().startBackgroundCheck();
      }
    } catch {}
  },

  updateReminder: async (id, updates) => {
    try {
      await db.workoutReminders.update(id, updates);
      await get().loadReminders();
    } catch {}
  },

  deleteReminder: async (id) => {
    try {
      await db.workoutReminders.delete(id);
      await get().loadReminders();
      if (!get().reminders.some(r => r.isEnabled)) {
        const intervalId = get().intervalId;
        if (intervalId) {
          clearInterval(intervalId);
          set({ intervalId: null });
        }
      }
    } catch {}
  },

  toggleReminder: async (id) => {
    const r = get().reminders.find(rem => rem.id === id);
    if (r) {
      await get().updateReminder(id, { isEnabled: !r.isEnabled });
      if (!get().reminders.some(rem => rem.isEnabled)) {
        const intervalId = get().intervalId;
        if (intervalId) {
          clearInterval(intervalId);
          set({ intervalId: null });
        }
      } else if (!get().intervalId) {
        get().startBackgroundCheck();
      }
    }
  },

  requestPermission: async () => {
    attachLifecycleListeners();
    const native = getNativeBridge();
    if (native) {
      if (typeof native.hasNotificationPermission === 'function' && native.hasNotificationPermission()) {
        set({ permissionGranted: true, permissionStatus: 'granted' });
        return true;
      }
      if (typeof native.requestNotificationPermission === 'function') {
        return new Promise<boolean>((resolve) => {
          let settled = false;
          const finish = (granted: boolean) => {
            if (settled) return;
            settled = true;
            window.removeEventListener('ironforge:notification-permission', onResult);
            set({ permissionGranted: granted, permissionStatus: granted ? 'granted' : 'denied' });
            resolve(granted);
          };
          const onResult = (e: Event) => {
            const granted = Boolean((e as CustomEvent<{ granted?: boolean }>).detail?.granted);
            finish(granted);
          };
          window.addEventListener('ironforge:notification-permission', onResult);
          try {
            native.requestNotificationPermission?.();
          } catch {
            finish(false);
          }
          setTimeout(() => {
            const current = detectNotificationPermissionStatus() === 'granted';
            finish(current);
          }, 8000);
        });
      }
      if (typeof native.showNotification === 'function') {
        set({ permissionGranted: true, permissionStatus: 'granted' });
        return true;
      }
    }

    if (typeof Notification === 'undefined') {
      set({ permissionGranted: false, permissionStatus: 'unsupported' });
      return false;
    }
    if (Notification.permission === 'granted') {
      set({ permissionGranted: true, permissionStatus: 'granted' });
      return true;
    }
    try {
      const result = await Notification.requestPermission();
      const granted = result === 'granted';
      set({
        permissionGranted: granted,
        permissionStatus: granted ? 'granted' : result === 'denied' ? 'denied' : 'default',
      });
      return granted;
    } catch {
      return false;
    }
  },

  openDeviceNotificationSettings: () => {
    const native = getNativeBridge();
    if (typeof native?.openNotificationSettings === 'function') {
      try {
        native.openNotificationSettings();
      } catch {}
    }
  },

  sendTestNotification: async () => {
    let status = get().refreshPermissionStatus();
    if (status === 'default') {
      const granted = await get().requestPermission();
      status = granted ? 'granted' : get().refreshPermissionStatus();
    }

    const res = await dispatchAppNotification({
      title: 'IronForge Test Alert',
      body: 'Notifications are active! Workout reminders and rest timer alerts will arrive here.',
      tag: 'ironforge-test-alert',
      channel: 'test',
      showInAppFallback: true,
    });

    if (res.channel === 'android') {
      return { ok: true, channel: 'android', message: 'Test alert sent via Android notifications.' };
    }
    if (res.channel === 'service-worker' || res.channel === 'web') {
      return { ok: true, channel: res.channel, message: 'Test alert sent via browser notifications.' };
    }
    if (res.channel === 'in-app') {
      return {
        ok: true,
        channel: 'in-app',
        message: status === 'denied'
          ? 'Shown in-app (OS notifications blocked in device settings).'
          : 'Shown as an in-app alert banner.',
      };
    }
    return { ok: false, channel: 'none', message: 'Could not send notification.' };
  },

  pushInAppBanner: (banner) => {
    if (bannerAutoDismissTimer) {
      clearTimeout(bannerAutoDismissTimer);
      bannerAutoDismissTimer = null;
    }
    const next: InAppNotificationBanner = {
      ...banner,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    };
    set({ activeBanner: next });
    bannerAutoDismissTimer = setTimeout(() => {
      set((state) => (state.activeBanner?.id === next.id ? { activeBanner: null } : state));
      bannerAutoDismissTimer = null;
    }, 6000);
  },

  dismissInAppBanner: () => {
    if (bannerAutoDismissTimer) {
      clearTimeout(bannerAutoDismissTimer);
      bannerAutoDismissTimer = null;
    }
    set({ activeBanner: null });
  },

  checkDueRemindersNow: async () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const reminders = get().reminders.filter(r => r.isEnabled);
    for (const r of reminders) {
      const remMins = r.timeHour * 60 + r.timeMinute;
      if (r.dayOfWeek !== dayOfWeek || nowMins < remMins || nowMins >= remMins + 15) continue;
      if (r.lastFiredAt) {
        const lastFired = new Date(r.lastFiredAt);
        const lastFiredMins = lastFired.getHours() * 60 + lastFired.getMinutes();
        if (
          lastFired.getFullYear() === now.getFullYear() &&
          lastFired.getMonth() === now.getMonth() &&
          lastFired.getDate() === now.getDate() &&
          lastFiredMins >= remMins &&
          lastFiredMins < remMins + 15
        ) {
          continue;
        }
      }
      try {
        await dispatchAppNotification({
          title: 'IronForge Workout Reminder',
          body: r.label || 'Time for your scheduled workout!',
          tag: `reminder-${r.id}`,
          channel: 'reminder',
          showInAppFallback: true,
        });
        if (r.id) {
          await db.workoutReminders.update(r.id, { lastFiredAt: now });
          await get().loadReminders();
        }
      } catch {}
    }
  },

  startBackgroundCheck: () => {
    attachLifecycleListeners();
    const existing = get().intervalId;
    if (existing) return;
    if (!get().reminders.some(r => r.isEnabled)) return;

    const id = setInterval(() => {
      void get().checkDueRemindersNow();
    }, 20000);
    set({ intervalId: id });
    void get().checkDueRemindersNow();
  },

  stopBackgroundCheck: () => {
    const id = get().intervalId;
    if (id) {
      clearInterval(id);
      set({ intervalId: null });
    }
  },
}));
