'use client';

import Image from 'next/image';

const logos = [
  // Keep this list restricted to real files in `public/logos/` and exclude banned logos.
  '/logos/stanford.avif',
  '/logos/princeton.png',
  '/logos/columbia.png',
  '/logos/cornell.png',
  '/logos/dartmouth.png',
  '/logos/upenn.png',
  '/logos/ucla.png',
  '/logos/brown.png',
  '/logos/unc.png',
  '/logos/pennstate.png',
  '/logos/michiganstate.png',
  '/logos/temple.png',
];

type SchoolCarouselProps = {
  className?: string;
};

export default function SchoolCarousel({ className }: SchoolCarouselProps) {
  const duplicated = [...logos, ...logos];

  return (
    <div className={['ivyway-school-carousel relative z-30 w-full', className ?? ''].filter(Boolean).join(' ')}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="ivyway-school-carousel-viewport" aria-hidden="true">
          <div className="ivyway-school-carousel-track">
            {duplicated.map((src, index) => (
              <Image
                key={`${src}-${index}`}
                src={src}
                alt=""
                width={180}
                height={42}
                sizes="180px"
                loading="lazy"
                className="hero-logos-logo"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


