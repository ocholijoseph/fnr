const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || 'http://localhost:1337';
const API_TOKEN = import.meta.env.VITE_STRAPI_API_TOKEN;
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true' || false;

export interface StrapiResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface NewsItem {
  id: number;
  documentId: string;
  title: string;
  body: string;
  publishedAt: string;
  featured_image?: {
    url: string;
    alternativeText?: string;
  };
  category?: {
    name: string;
  };
  author?: {
    name: string;
  };
}

export interface NewsResponse {
  id: number;
  documentId: string;
  title: string;
  body: string;
  publishedAt: string;
  featured_image?: {
    url: string;
    alternativeText?: string;
  };
  category?: {
    name: string;
  };
  author?: {
    name: string;
  };
}

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }

  return headers;
};

// Mock data for fallback
const mockNewsData: NewsResponse[] = [
  {
    id: 1,
    documentId: "mock-1",
    title: "Freedom Naija Radio Launches New Mobile App",
    body: "<p>We're excited to announce the launch of our brand new mobile application, available on iOS and Android. Stream your favorite shows anywhere, anytime.</p>",
    publishedAt: "2025-01-15T10:00:00Z",
  },
  {
    id: 2,
    documentId: "mock-2",
    title: "Special Interview with Local Artist Coming This Weekend",
    body: "<p>Tune in this Saturday at 3 PM for an exclusive interview with rising star Maria Rodriguez. She'll be discussing her latest album and performing live.</p>",
    publishedAt: "2025-01-14T15:30:00Z",
  },
  {
    id: 3,
    documentId: "mock-3",
    title: "Community Fundraiser Event: Big Success",
    body: "<p>Thanks to our amazing listeners, we raised over $50,000 for local charities last weekend. Your support makes a real difference in our community.</p>",
    publishedAt: "2025-01-13T09:00:00Z",
  },
];

export const newsApi = {
  async getNews(limit: number = 10): Promise<NewsResponse[]> {
    if (USE_MOCK_DATA) {
      console.log('Using mock news data');
      return mockNewsData.slice(0, limit);
    }

    try {
      const response = await fetch(
        `${STRAPI_URL}/api/news?sort=publishedAt:desc&pagination[limit]=${limit}&populate=featured_image,category,author`,
        {
          headers: getHeaders(),
        }
      );

      if (!response.ok) {
        console.warn(`Strapi API not available (${response.status}), falling back to mock data`);
        return mockNewsData.slice(0, limit);
      }

      const data: StrapiResponse<NewsResponse> = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching news, falling back to mock data:', error);
      return mockNewsData.slice(0, limit);
    }
  },

  async getNewsBySlug(slug: string): Promise<NewsResponse | null> {
    if (USE_MOCK_DATA) {
      return mockNewsData.find(item => item.documentId === slug) || null;
    }

    try {
      const response = await fetch(
        `${STRAPI_URL}/api/news?filters[slug][$eq]=${slug}&populate=featured_image,category,author`,
        {
          headers: getHeaders(),
        }
      );

      if (!response.ok) {
        console.warn(`Strapi API not available (${response.status}), falling back to mock data`);
        return mockNewsData.find(item => item.documentId === slug) || null;
      }

      const data: StrapiResponse<NewsResponse> = await response.json();
      return data.data[0] || null;
    } catch (error) {
      console.error('Error fetching news by slug, falling back to mock data:', error);
      return mockNewsData.find(item => item.documentId === slug) || null;
    }
  }
};