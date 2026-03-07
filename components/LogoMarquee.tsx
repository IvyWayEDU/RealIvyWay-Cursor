'use client';

import Image from 'next/image';

const logos = [
  '/logos/unc.png',
  '/logos/cambridge.png',
  '/logos/yale.png',
  '/logos/mit.png',
  '/logos/uva.png',
  '/logos/kentucky.png',
  '/logos/pennstate.png',
  '/logos/georgetown.png',
  '/logos/oxford.png',
  '/logos/harvard.png',
  '/logos/nyu.png',
];

type LogoMarqueeProps = {
  tone?: 'light' | 'dark';
  className?: string;
};

export default function LogoMarquee({ tone = 'light', className }: LogoMarqueeProps) {
  return (
    <section
      className={[
        'ivyway-trusted-section',
        tone === 'dark' ? 'ivyway-trusted-section--dark' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="ivyway-trusted-text">Trusted by Top Schools, Students, and Educators</p>

      <div className="ivyway-logo-marquee" aria-hidden="true">
        <div className="ivyway-logo-marquee-track">
          {logos.map((logo, index) => (
            <Image
              key={`logo-${index}`}
              src={logo}
              alt=""
              width={180}
              height={40}
              loading="lazy"
              className="ivyway-logo-marquee-logo object-contain bg-transparent h-12 md:h-14 w-auto transition-transform duration-200 hover:scale-105"
            />
          ))}
          {logos.map((logo, index) => (
            <Image
              key={`logo-duplicate-${index}`}
              src={logo}
              alt=""
              width={180}
              height={40}
              loading="lazy"
              className="ivyway-logo-marquee-logo object-contain bg-transparent h-12 md:h-14 w-auto transition-transform duration-200 hover:scale-105"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
