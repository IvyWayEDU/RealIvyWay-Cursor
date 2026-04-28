import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    '/',
    '/faq',
    '/contact',
    '/ivyway-ai',
    '/privacy',
    '/terms',
    '/refund-policy',
    '/cancellation-policy',
  ];

  return routes.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/ivyway-ai' ? 0.8 : 0.6,
  }));
}

