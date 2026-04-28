export const SITE_NAME = 'IvyWay';

export function getSiteUrl(): string {
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || 'https://ivywayedu.com').trim();
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export function absoluteUrl(pathname: string): string {
  const site = getSiteUrl();
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${site}${path}`;
}

