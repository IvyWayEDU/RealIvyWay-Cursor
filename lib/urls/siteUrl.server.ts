import 'server-only';

const CANONICAL_PROD_SITE_URL = 'https://ivywayedu.com';

function normalizeUrl(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  // If someone sets VERCEL_URL-like values without scheme, add https.
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  const u = new URL(withScheme);
  // Strip trailing slash for consistent concatenation.
  const out = `${u.protocol}//${u.host}${u.pathname === '/' ? '' : u.pathname}`.replace(/\/$/, '');
  return out;
}

function isLocalhostHost(hostname: string): boolean {
  const h = String(hostname || '').trim().toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h.endsWith('.local')
  );
}

function isProductionDeploy(): boolean {
  // Vercel sets VERCEL_ENV=production for the production deployment.
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production';
  // Fallback for non-Vercel production.
  return process.env.NODE_ENV === 'production';
}

/**
 * Resolve the public site origin for absolute URLs.
 *
 * Requirements:
 * - Production must never fall back to localhost.
 * - Production must use the canonical domain: https://ivywayedu.com
 * - Missing production URL env vars must throw (clear server-side error).
 * - Local dev can still default to localhost.
 */
export function getSiteOriginServer(opts?: { requestOrigin?: string | null }): string {
  const prod = isProductionDeploy();

  const baseUrlEnv = String(process.env.BASE_URL || '').trim();
  const siteUrlEnv = String(process.env.SITE_URL || '').trim();
  const publicSiteUrlEnv = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  const publicBaseUrlEnv = String(process.env.NEXT_PUBLIC_BASE_URL || '').trim();

  // Prefer server-only env var for production safety.
  const candidate =
    baseUrlEnv ||
    siteUrlEnv ||
    publicSiteUrlEnv ||
    publicBaseUrlEnv ||
    '';

  if (prod) {
    // In production, be strict: you must set BASE_URL (or SITE_URL) explicitly.
    if (!baseUrlEnv && !siteUrlEnv) {
      throw new Error(
        'Missing required production URL env var. Set BASE_URL=https://ivywayedu.com (server-side) ' +
          'so email links, Stripe redirects, and SEO URLs never fall back to localhost.'
      );
    }

    const normalized = normalizeUrl(baseUrlEnv || siteUrlEnv);
    if (!normalized) {
      throw new Error('Invalid BASE_URL/SITE_URL in production (empty). Expected https://ivywayedu.com');
    }
    const u = new URL(normalized);
    if (u.protocol !== 'https:') {
      throw new Error(`Invalid BASE_URL/SITE_URL protocol in production (${u.protocol}). Expected https://ivywayedu.com`);
    }
    if (isLocalhostHost(u.hostname)) {
      throw new Error(`Invalid BASE_URL/SITE_URL host in production (${u.hostname}). Expected ivywayedu.com`);
    }
    if (normalized !== CANONICAL_PROD_SITE_URL) {
      throw new Error(
        `Invalid BASE_URL/SITE_URL in production (${normalized}). Expected exactly ${CANONICAL_PROD_SITE_URL}`
      );
    }
    return normalized;
  }

  // Non-production (local dev + Vercel preview):
  // Prefer explicit env vars, else Vercel-provided URL, else request origin, else localhost for dev.
  const vercelUrl = String(process.env.VERCEL_URL || '').trim();
  const fromVercel = vercelUrl ? normalizeUrl(vercelUrl) : '';
  const fromRequest = opts?.requestOrigin ? normalizeUrl(opts.requestOrigin) : '';
  const resolved = normalizeUrl(candidate) || fromVercel || fromRequest || 'http://localhost:3000';
  return normalizeUrl(resolved);
}

export function absoluteUrlServer(pathname: string, opts?: { requestOrigin?: string | null }): string {
  const origin = getSiteOriginServer(opts);
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${origin}${path}`;
}

