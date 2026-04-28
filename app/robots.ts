import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/dashboard/', '/admin/', '/checkout/', '/onboarding/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

