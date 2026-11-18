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
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
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
    } catch {}
  },

  toggleReminder: async (id) => {
    const r = get().reminders.find(rem => rem.id === id);
    if (r) {
      await get().updateReminder(id, { isEnabled: !r.isEnabled });
    }
  },

  requestPermission: async () => {
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

    const checkAndFire = async () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();
      const minute = now.getMinutes();

      const reminders = get().reminders.filter(r => r.isEnabled);
      for (const r of reminders) {
        if (r.dayOfWeek !== dayOfWeek || r.timeHour !== hour || r.timeMinute !== minute) continue;
        if (r.lastFiredAt) {
          const lastFired = new Date(r.lastFiredAt);
          if (
            lastFired.getFullYear() === now.getFullYear() &&
            lastFired.getMonth() === now.getMonth() &&
            lastFired.getDate() === now.getDate() &&
            lastFired.getHours() === now.getHours() &&
            lastFired.getMinutes() === now.getMinutes()
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
