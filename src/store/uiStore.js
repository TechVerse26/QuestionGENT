import { create } from 'zustand';

const initial = () => {
  try { return localStorage.getItem('em-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) { return 'light'; }
};

export const useUi = create((set, get) => ({
  theme: initial(),
  sidebar: false,
  setTheme(theme) {
    try { localStorage.setItem('em-theme', theme); } catch (e) { /* ignore */ }
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },
  toggleTheme() { get().setTheme(get().theme === 'dark' ? 'light' : 'dark'); },
  setSidebar(v) { set({ sidebar: v }); },
}));
