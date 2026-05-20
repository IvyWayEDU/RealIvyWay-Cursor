export const SITE_NAME = 'IvyWay';

export function getSiteUrl(): string {
  // Strictness should apply to the real production deployment (Vercel sets this).
  // Keep local `next build` workable without requiring production-only env.
  const isProd = process.env.VERCEL_ENV === 'production';
  const canonical = 'https://ivywayedu.com';

  // In production, never silently fall back; require explicit server-side configuration.
  // (Used by SEO metadata, robots, sitemap.)
  if (isProd) {
    const base = String(process.env.BASE_URL || process.env.SITE_URL || '').trim();
    if (!base) {
      throw new Error(
        'Missing required production URL env var. Set BASE_URL=https://ivywayedu.com so SEO URLs never fall back.'
      );
    }
    const normalized = base.replace(/\/+$/, '');
    if (normalized !== canonical) {
      throw new Error(`Invalid BASE_URL/SITE_URL in production (${normalized}). Expected exactly ${canonical}`);
    }
    return normalized;
  }

  // Non-production: allow NEXT_PUBLIC_SITE_URL override, else canonical.
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || canonical).trim();
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export function absoluteUrl(pathname: string): string {
  const site = getSiteUrl();
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${site}${path}`;
}

