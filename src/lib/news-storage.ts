import { NewsResponse } from './api';

const ARCHIVED_NEWS_KEY = 'freedomRadio_archivedNews';
const ARCHIVED_NEWS_LIMIT = 20;

export interface ArchivedNews extends NewsResponse {
  archivedAt: string;
  archivedReason: 'swipe' | 'manual';
}

export const newsStorage = {
  // Archive a news item
  archiveNews: (newsItem: NewsResponse, reason: 'swipe' | 'manual' = 'swipe'): void => {
    try {
      const archivedNews: ArchivedNews = {
        ...newsItem,
        archivedAt: new Date().toISOString(),
        archivedReason: reason,
      };

      const existingArchived = newsStorage.getArchivedNews();
      const filtered = existingArchived.filter(item => item.documentId !== newsItem.documentId);
      const updated = [archivedNews, ...filtered].slice(0, ARCHIVED_NEWS_LIMIT);

      localStorage.setItem(ARCHIVED_NEWS_KEY, JSON.stringify(updated));
      console.log(`News item "${newsItem.title}" archived`);
    } catch (error) {
      console.error('Error archiving news:', error);
    }
  },

  // Get all archived news
  getArchivedNews: (): ArchivedNews[] => {
    try {
      const stored = localStorage.getItem(ARCHIVED_NEWS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error retrieving archived news:', error);
      return [];
    }
  },

  // Remove a news item from archive
  unarchiveNews: (documentId: string): void => {
    try {
      const existingArchived = newsStorage.getArchivedNews();
      const filtered = existingArchived.filter(item => item.documentId !== documentId);
      localStorage.setItem(ARCHIVED_NEWS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error unarchiving news:', error);
    }
  },

  // Clear all archived news
  clearArchivedNews: (): void => {
    try {
      localStorage.removeItem(ARCHIVED_NEWS_KEY);
      console.log('All archived news cleared');
    } catch (error) {
      console.error('Error clearing archived news:', error);
    }
  },

  // Check if a news item is archived
  isArchived: (documentId: string): boolean => {
    const archived = newsStorage.getArchivedNews();
    return archived.some(item => item.documentId === documentId);
  },

  // Get archived news count
  getArchivedCount: (): number => {
    return newsStorage.getArchivedNews().length;
  },
};