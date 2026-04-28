export const GA4_MEASUREMENT_ID = 'G-RC6J9YHEY2';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: any[]) => void;
  }
}

export function ga4Pageview(pagePath: string) {
  if (typeof window === 'undefined') return;
  const gtag =
    typeof window.gtag === 'function'
      ? window.gtag
      : (...args: any[]) => {
          window.dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
          window.dataLayer.push(args);
        };
  gtag('config', GA4_MEASUREMENT_ID, { page_path: pagePath });
}

export function ga4Event(name: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  const gtag =
    typeof window.gtag === 'function'
      ? window.gtag
      : (...args: any[]) => {
          window.dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
          window.dataLayer.push(args);
        };
  gtag('event', name, params ?? {});
}

