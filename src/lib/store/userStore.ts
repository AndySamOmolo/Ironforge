import { create } from 'zustand';
import { normalizeEquipmentList } from '@/lib/utils/exerciseResolver';

export interface UserState {
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
  customAccent: string;
  font: string;
  fontSize: string;
  numberFont: string;
  headerStyle: string;
  density: string;
  compactMode: boolean;
  gridColumns: string;
  buttonStyle: string;
  cardStyle: string;
  borderRadius: string;
  animationLevel: string;
  navStyle: string;
  bgStyle: string;
  accentIntensity: string;
  glowIntensity: string;
  borderThickness: string;
  glassOpacity: string;
  contrastMode: string;
  colorMode: string;
  textShadow: boolean;
  weightIncrement: number;
  autoAdvance: boolean;
  autoStartRest: boolean;
  keepScreenOn: boolean;
  showTimer: boolean;
  countdownSound: boolean;
  exerciseVariety: 'low' | 'medium' | 'high';
  showDailyQuote: boolean;
  showActivityHeatmap: boolean;
  showFeatureCards: boolean;
  showLastWorkout: boolean;
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
  setField: <K extends keyof UserState>(key: K, value: UserState[K]) => void;
  setIsSeeded: (seeded: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  loadFromProfile: (profile: Partial<UserState>) => void;
}

export const useUserStore = create<UserState>((set) => ({
  name: 'Athlete',
  unitSystem: 'metric',
  barWeight: 20,
  dumbbellWeight: 10,
  equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'leverage machine', 'body weight'],
  defaultRestTime: 90,
  restTimerEnabled: true,
  soundEnabled: true,
  hapticEnabled: true,
  notificationsEnabled: false,
  theme: 'dark',
  customAccent: 'default',
  font: 'inter',
  fontSize: 'normal',
  numberFont: 'mono',
  headerStyle: 'gradient',
  density: 'normal',
  compactMode: false,
  gridColumns: '2',
  buttonStyle: 'default',
  cardStyle: 'glass',
  borderRadius: 'default',
  animationLevel: 'normal',
  navStyle: 'default',
  bgStyle: 'mesh',
  accentIntensity: 'normal',
  glowIntensity: 'normal',
  borderThickness: 'normal',
  glassOpacity: 'medium',
  contrastMode: 'normal',
  colorMode: 'normal',
  textShadow: false,
  weightIncrement: 2.5,
  autoAdvance: true,
  autoStartRest: true,
  keepScreenOn: true,
  showTimer: true,
  countdownSound: true,
  exerciseVariety: 'medium',
  showDailyQuote: true,
  showActivityHeatmap: true,
  showFeatureCards: true,
  showLastWorkout: true,
  isSeeded: false,
  isLoading: true,

  setName: (name) => set({ name }),
  setUnitSystem: (unitSystem) => set({ unitSystem }),
  setBarWeight: (barWeight) => set({ barWeight }),
  setDumbbellWeight: (dumbbellWeight) => set({ dumbbellWeight }),
  setEquipment: (equipment) => set({ equipment: normalizeEquipmentList(equipment) }),
  setDefaultRestTime: (defaultRestTime) => set({ defaultRestTime }),
  toggleRestTimer: () => set((s) => ({ restTimerEnabled: !s.restTimerEnabled })),
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  toggleHaptic: () => set((s) => ({ hapticEnabled: !s.hapticEnabled })),
  toggleNotifications: () => set((s) => ({ notificationsEnabled: !s.notificationsEnabled })),
  setTheme: (theme) => set({ theme }),
  setField: (key, value) => set({ [key]: value } as Partial<UserState>),
  setIsSeeded: (isSeeded) => set({ isSeeded }),
  setIsLoading: (isLoading) => set({ isLoading }),
  loadFromProfile: (profile) =>
    set((state) => ({
      ...state,
      ...profile,
      equipment: profile.equipment
        ? normalizeEquipmentList(profile.equipment)
        : state.equipment,
    })),
}));
