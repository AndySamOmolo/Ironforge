import { create } from 'zustand';
import { db } from '@/lib/db/schema';
import type { WorkoutReminder } from '@/lib/types';

interface ReminderState {
  reminders: WorkoutReminder[];
  permissionGranted: boolean;
  intervalId: ReturnType<typeof setInterval> | null;

  loadReminders: () => Promise<void>;
  addReminder: (reminder: Omit<WorkoutReminder, 'id' | 'createdAt'>) => Promise<void>;
  updateReminder: (id: number, updates: Partial<WorkoutReminder>) => Promise<void>;
  deleteReminder: (id: number) => Promise<void>;
  toggleReminder: (id: number) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  startBackgroundCheck: () => void;
  stopBackgroundCheck: () => void;
}

async function showWorkoutNotification(title: string, body: string, tag: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const w = window as unknown as { IronForgeNative?: { showNotification?: (t: string, b: string) => boolean } };
    if (w.IronForgeNative?.showNotification?.(title, body)) return;
  } catch {}
  if (typeof Notification === 'undefined') return;
  try {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag,
    });
    return;
  } catch {
    // Mobile Chrome / Android WebView fallback via ServiceWorkerRegistration
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag,
          });
        }
      }
    } catch {}
  }
}

export const useReminderStore = create<ReminderState>((set, get) => ({
  reminders: [],
  permissionGranted: typeof Notification !== 'undefined' && Notification.permission === 'granted',
  intervalId: null,

  loadReminders: async () => {
    try {
      const all = await db.workoutReminders.toArray();
      set({
        reminders: all,
        permissionGranted: typeof Notification !== 'undefined' && Notification.permission === 'granted',
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
    if (typeof window !== 'undefined') {
      const w = window as unknown as { IronForgeNative?: { showNotification?: (t: string, b: string) => boolean } };
      if (typeof w.IronForgeNative?.showNotification === 'function') {
        set({ permissionGranted: true });
        return true;
      }
    }
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') {
      set({ permissionGranted: true });
      return true;
    }
    try {
      const result = await Notification.requestPermission();
      const granted = result === 'granted';
      set({ permissionGranted: granted });
      return granted;
    } catch {
      return false;
    }
  },

  startBackgroundCheck: () => {
    const existing = get().intervalId;
    if (existing) return;
    if (!get().reminders.some(r => r.isEnabled)) return;

    const checkAndFire = async () => {
      const hasNativeBridge =
        typeof window !== 'undefined' &&
        typeof (window as unknown as { IronForgeNative?: { showNotification?: unknown } }).IronForgeNative?.showNotification === 'function';
      if (!hasNativeBridge && (typeof Notification === 'undefined' || Notification.permission !== 'granted')) return;
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();
      const minute = now.getMinutes();

      const reminders = get().reminders.filter(r => r.isEnabled);
      for (const r of reminders) {
        const nowMins = hour * 60 + minute;
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
          await showWorkoutNotification(
            '🏋️ IronForge',
            r.label || 'Time for your workout!',
            `reminder-${r.id}`
          );
          if (r.id) {
            await db.workoutReminders.update(r.id, { lastFiredAt: now });
            await get().loadReminders();
          }
        } catch {}
      }
    };

    const id = setInterval(checkAndFire, 30000);
    set({ intervalId: id });
    void checkAndFire();
  },

  stopBackgroundCheck: () => {
    const id = get().intervalId;
    if (id) {
      clearInterval(id);
      set({ intervalId: null });
    }
  },
}));
