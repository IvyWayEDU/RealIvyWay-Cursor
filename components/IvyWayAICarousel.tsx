'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

export type IvyWayAISlide = {
  key: string;
  label: string;
  caption: string;
  src: string;
  alt: string;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

export default function IvyWayAICarousel({
  slides,
  autoRotateMs = 5200,
}: {
  slides: IvyWayAISlide[];
  autoRotateMs?: number;
}) {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [errored, setErrored] = useState<Record<string, boolean>>({});
  const userInteractedRef = useRef(false);

  const availableSlides = useMemo(() => {
    const filtered = slides.filter((s) => !errored[s.key]);
    return filtered.length > 0 ? filtered : slides;
  }, [slides, errored]);

  const clampedActive = Math.min(active, Math.max(availableSlides.length - 1, 0));

  useEffect(() => {
    if (active !== clampedActive) setActive(clampedActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedActive]);

  const canAutoRotate = availableSlides.length > 1 && !prefersReducedMotion();

  useEffect(() => {
    if (!canAutoRotate) return;

    const t = window.setInterval(() => {
      if (userInteractedRef.current) return;
      setActive((i) => (i + 1) % availableSlides.length);
    }, autoRotateMs);

    return () => window.clearInterval(t);
  }, [autoRotateMs, availableSlides.length, canAutoRotate]);

  const goTo = (idx: number) => {
    userInteractedRef.current = true;
    setActive(((idx % availableSlides.length) + availableSlides.length) % availableSlides.length);
    window.setTimeout(() => {
      userInteractedRef.current = false;
    }, 9000);
  };

  const prev = () => goTo(clampedActive - 1);
  const next = () => goTo(clampedActive + 1);

  const activeSlide = availableSlides[clampedActive];

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0088CB]/15 bg-white/70 px-3 py-1 text-xs font-semibold text-[#06233A] shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0088CB]" />
            {activeSlide?.label ?? 'IvyWay AI'}
          </div>
          {activeSlide?.caption ? (
            <div className="truncate text-sm font-medium text-gray-700">{activeSlide.caption}</div>
          ) : null}
        </div>
      </div>

      <div className="group/ai mt-6 relative overflow-hidden rounded-[28px] border border-black/10 bg-white/70 shadow-[0_26px_70px_rgba(2,10,23,0.10)] ring-1 ring-black/5">
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_50%_-20%,rgba(0,136,203,0.18),rgba(255,255,255,0))]" />

        <div className="relative aspect-[16/10] w-full">
          {availableSlides.length > 1 ? (
            <>
              <button
                type="button"
                onClick={prev}
                className={[
                  'absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full',
                  'border border-white/40 bg-white/65 text-gray-900 shadow-[0_10px_30px_rgba(2,10,23,0.12)] backdrop-blur',
                  '-translate-x-1 opacity-0 transition-all duration-200',
                  'group-hover/ai:opacity-100 group-hover/ai:translate-x-0',
                  'hover:bg-white hover:shadow-[0_14px_36px_rgba(2,10,23,0.14)]',
                  'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088CB]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                  'sm:flex',
                ].join(' ')}
                aria-label="Previous slide"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                </svg>
              </button>

              <button
                type="button"
                onClick={next}
                className={[
                  'absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full',
                  'border border-white/40 bg-white/65 text-gray-900 shadow-[0_10px_30px_rgba(2,10,23,0.12)] backdrop-blur',
                  'translate-x-1 opacity-0 transition-all duration-200',
                  'group-hover/ai:opacity-100 group-hover/ai:translate-x-0',
                  'hover:bg-white hover:shadow-[0_14px_36px_rgba(2,10,23,0.14)]',
                  'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088CB]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                  'sm:flex',
                ].join(' ')}
                aria-label="Next slide"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </>
          ) : null}

          {availableSlides.map((s, idx) => {
            const isActive = idx === clampedActive;
            const isLoaded = loaded[s.key];

            // Keep the DOM stable and premium: no broken-image icons; fade in only after load.
            return (
              <div
                key={s.key}
                className={[
                  'absolute inset-0 transition-all duration-700 ease-out',
                  isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2',
                ].join(' ')}
                aria-hidden={!isActive}
              >
                <div className="absolute inset-0 p-4 sm:p-6">
                  <div className="relative h-full w-full overflow-hidden rounded-2xl bg-white shadow-[0_18px_55px_rgba(2,10,23,0.12)] ring-1 ring-black/5">
                    <Image
                      src={s.src}
                      alt={s.alt}
                      fill
                      priority={idx === 0}
                      sizes="(min-width: 1024px) 980px, 92vw"
                      className={[
                        'object-contain',
                        isLoaded ? 'opacity-100' : 'opacity-0',
                        'transition-opacity duration-500',
                      ].join(' ')}
                      onLoadingComplete={() => setLoaded((m) => ({ ...m, [s.key]: true }))}
                      onError={() => setErrored((m) => ({ ...m, [s.key]: true }))}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {availableSlides.length > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          {availableSlides.map((s, idx) => {
            const isActive = idx === clampedActive;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => goTo(idx)}
                className={[
                  'h-2.5 w-2.5 rounded-full transition-all',
                  isActive ? 'bg-[#0088CB] shadow-[0_10px_24px_rgba(0,136,203,0.25)]' : 'bg-gray-300 hover:bg-gray-400',
                ].join(' ')}
                aria-label={`Go to ${s.label}`}
                aria-current={isActive ? 'true' : 'false'}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

