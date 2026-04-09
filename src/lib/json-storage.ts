export const jsonStorage = {
  get: <T = any>(key: string, fallback: T): T => {
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : fallback;
    } catch (error) {
      console.error(`Failed to read local JSON storage key=${key}:`, error);
      return fallback;
    }
  },

  set: (key: string, value: any): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to write local JSON storage key=${key}:`, error);
    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove local JSON storage key=${key}:`, error);
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear local JSON storage:', error);
    }
  },
};
