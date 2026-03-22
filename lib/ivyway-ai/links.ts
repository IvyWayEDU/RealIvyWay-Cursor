export type IvyWayAiEntryPoint = 'student_dashboard' | 'provider_dashboard';

type IvyWayAiCta = 'trial' | 'upgrade' | 'open';

export type IvyWayAiLink = {
  href: string;
  external: boolean;
};

const DEFAULT_IVYWAY_AI_BASE_URL = 'https://ai.ivyway.com';

function getBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_IVYWAY_AI_BASE_URL;
  const base = (raw && raw.trim()) || DEFAULT_IVYWAY_AI_BASE_URL;
  return base.replace(/\/+$/, '');
}

function buildHref(cta: IvyWayAiCta, entryPoint: IvyWayAiEntryPoint): string {
  const url = new URL(getBaseUrl());
  url.searchParams.set('source', 'ivyway-web');
  url.searchParams.set('entry', entryPoint);
  url.searchParams.set('cta', cta);
  return url.toString();
}

export function getIvyWayAiLinks(entryPoint: IvyWayAiEntryPoint): {
  startFreeTrial: IvyWayAiLink;
  upgradeToFullAccess: IvyWayAiLink;
  openIvyWayAi: IvyWayAiLink;
} {
  return {
    startFreeTrial: { href: buildHref('trial', entryPoint), external: true },
    upgradeToFullAccess: { href: buildHref('upgrade', entryPoint), external: true },
    openIvyWayAi: { href: buildHref('open', entryPoint), external: true },
  };
}

