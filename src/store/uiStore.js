// src/store/uiStore.js
import { create } from 'zustand';

const savedTheme = (() => {
  try { return localStorage.getItem('theme') || 'dark'; } catch { return 'dark'; }
})();
document.documentElement.setAttribute('data-theme', savedTheme);

export const useUiStore = create((set) => ({
  activePanel: 'cal',
  calFilter: 'all',
  selectedGroup: 'A',
  koTab: 'R32',
  sidebarCollapsed: window.innerWidth < 768,
  theme: savedTheme,
  toastMessage: null,
  toastType: 'ok',
  predH: null,
  predA: null,

  setPanel: (panel, teams) => set(
    teams ? { activePanel: panel, predH: teams.h, predA: teams.a } : { activePanel: panel }
  ),
  setCalFilter: (filter) => set({ calFilter: filter }),
  setGroup: (group) => set({ selectedGroup: group }),
  setKoTab: (tab) => set({ koTab: tab }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTheme: () => set(s => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
    return { theme: next };
  }),
  showToast: (message, type = 'ok') => {
    set({ toastMessage: message, toastType: type });
    setTimeout(() => set({ toastMessage: null }), 3500);
  },
}));
