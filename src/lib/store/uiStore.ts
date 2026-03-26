import { create } from 'zustand';

interface UIState {
  activeTab: string;
  bottomSheetOpen: boolean;
  bottomSheetContent: string | null;
  numpadOpen: boolean;
  numpadValue: string;
  numpadCallback: ((value: number) => void) | null;
  seedingProgress: number;
  seedingMessage: string;
  showSeedingScreen: boolean;

  setActiveTab: (tab: string) => void;
  openBottomSheet: (content: string) => void;
  closeBottomSheet: () => void;
  openNumpad: (initialValue: number, callback: (value: number) => void) => void;
  closeNumpad: () => void;
  setNumpadValue: (value: string) => void;
  setSeedingProgress: (progress: number, message: string) => void;
  setShowSeedingScreen: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'home',
  bottomSheetOpen: false,
  bottomSheetContent: null,
  numpadOpen: false,
  numpadValue: '0',
  numpadCallback: null,
  seedingProgress: 0,
  seedingMessage: '',
  showSeedingScreen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  openBottomSheet: (content) => set({ bottomSheetOpen: true, bottomSheetContent: content }),
  closeBottomSheet: () => set({ bottomSheetOpen: false, bottomSheetContent: null }),
  openNumpad: (initialValue, callback) => set({
    numpadOpen: true,
    numpadValue: initialValue.toString(),
    numpadCallback: callback,
  }),
  closeNumpad: () => set({ numpadOpen: false, numpadCallback: null }),
  setNumpadValue: (value) => set({ numpadValue: value }),
  setSeedingProgress: (progress, message) => set({ seedingProgress: progress, seedingMessage: message }),
  setShowSeedingScreen: (show) => set({ showSeedingScreen: show }),
}));
