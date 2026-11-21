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
  customAccentHex: string;
  customSecondaryHex: string;
  customBgHex: string;
  font: string;
  fontSize: string;
  fontWeightScale: string;
  numberFont: string;
  headerStyle: string;
  density: string;
  compactMode: boolean;
  gridColumns: string;
  buttonStyle: string;
  cardStyle: string;
  cardBlur: string;
  surfaceTint: string;
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
  timerStartMode: 'on_enter' | 'on_first_set' | 'manual';
  includeWarmupSets: boolean;
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

export function convertWeightBetweenSystems(
  value: number,
  fromSystem: 'metric' | 'imperial',
  toSystem: 'metric' | 'imperial',
  kind: 'bar' | 'dumbbell' | 'increment'
): number {
  if (fromSystem === toSystem) return value;
  if (kind === 'bar') {
    if (toSystem === 'imperial' && value === 20) return 45;
    if (toSystem === 'metric' && value === 45) return 20;
    const raw = toSystem === 'imperial' ? value * 2.20462 : value / 2.20462;
    return Math.max(0, Math.round(raw / 2.5) * 2.5);
  }
  if (kind === 'dumbbell') {
    if (toSystem === 'imperial' && value === 10) return 25;
    if (toSystem === 'metric' && value === 25) return 10;
    const raw = toSystem === 'imperial' ? value * 2.20462 : value / 2.20462;
    return Math.max(0, Math.round(raw / 2.5) * 2.5);
  }
  if (toSystem === 'imperial' && value === 2.5) return 5;
  if (toSystem === 'metric' && value === 5) return 2.5;
  return value;
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
  customAccentHex: '',
  customSecondaryHex: '',
  customBgHex: '',
  font: 'inter',
  fontSize: 'normal',
  fontWeightScale: 'normal',
  numberFont: 'mono',
  headerStyle: 'gradient',
  density: 'normal',
  compactMode: false,
  gridColumns: '2',
  buttonStyle: 'default',
  cardStyle: 'glass',
  cardBlur: 'normal',
  surfaceTint: 'none',
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
  timerStartMode: 'on_first_set',
  includeWarmupSets: false,
  countdownSound: true,
  exerciseVariety: 'medium',
  showDailyQuote: true,
  showActivityHeatmap: true,
  showFeatureCards: true,
  showLastWorkout: true,
  isSeeded: false,
  isLoading: true,

  setName: (name) => set({ name }),
  setUnitSystem: (unitSystem) =>
    set((state) => {
      if (state.unitSystem === unitSystem) return { unitSystem };
      return {
        unitSystem,
        barWeight: convertWeightBetweenSystems(state.barWeight, state.unitSystem, unitSystem, 'bar'),
        dumbbellWeight: convertWeightBetweenSystems(state.dumbbellWeight, state.unitSystem, unitSystem, 'dumbbell'),
        weightIncrement: convertWeightBetweenSystems(state.weightIncrement, state.unitSystem, unitSystem, 'increment'),
      };
    }),
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
