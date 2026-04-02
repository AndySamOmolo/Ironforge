import { create } from 'zustand';

interface UserState {
  name: string;
  unitSystem: 'metric' | 'imperial';
  barWeight: number;
  dumbbellWeight: number;
  equipment: string[];
  defaultRestTime: number;
  restTimerEnabled: boolean;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  notificationsEnabled: boolean;
  theme: string;
  isSeeded: boolean;
  isLoading: boolean;

  setName: (name: string) => void;
  setUnitSystem: (system: 'metric' | 'imperial') => void;
  setBarWeight: (weight: number) => void;
  setDumbbellWeight: (weight: number) => void;
  setEquipment: (equipment: string[]) => void;
  setDefaultRestTime: (time: number) => void;
  toggleRestTimer: () => void;
  toggleSound: () => void;
  toggleHaptic: () => void;
  toggleNotifications: () => void;
  setTheme: (theme: string) => void;
  setIsSeeded: (seeded: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  loadFromProfile: (profile: Partial<UserState>) => void;
}

export const useUserStore = create<UserState>((set) => ({
  name: 'Athlete',
  unitSystem: 'metric',
  barWeight: 20,
  dumbbellWeight: 10,
  equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'body only'],
  defaultRestTime: 90,
  restTimerEnabled: true,
  soundEnabled: true,
  hapticEnabled: true,
  notificationsEnabled: false,
  theme: 'dark',
  isSeeded: false,
  isLoading: true,

  setName: (name) => set({ name }),
  setUnitSystem: (unitSystem) => set({ unitSystem }),
  setBarWeight: (barWeight) => set({ barWeight }),
  setDumbbellWeight: (dumbbellWeight) => set({ dumbbellWeight }),
  setEquipment: (equipment) => set({ equipment }),
  setDefaultRestTime: (defaultRestTime) => set({ defaultRestTime }),
  toggleRestTimer: () => set((s) => ({ restTimerEnabled: !s.restTimerEnabled })),
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  toggleHaptic: () => set((s) => ({ hapticEnabled: !s.hapticEnabled })),
  toggleNotifications: () => set((s) => ({ notificationsEnabled: !s.notificationsEnabled })),
  setTheme: (theme) => set({ theme }),
  setIsSeeded: (isSeeded) => set({ isSeeded }),
  setIsLoading: (isLoading) => set({ isLoading }),
  loadFromProfile: (profile) => set(profile),
}));
