import type { Metadata } from 'next';
import PublicLayoutClient from '@/components/PublicLayoutClient';
import { SITE_NAME } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: `${SITE_NAME} | Tutoring, College Counseling & IvyWay AI`,
  description:
    'Premium academic support from real tutors and college mentors—tutoring, college counseling, SAT/ACT test prep, virtual college tours, and IvyWay AI study tools.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${SITE_NAME} | Tutoring, College Counseling & IvyWay AI`,
    description:
      'Premium academic support from real tutors and college mentors—tutoring, college counseling, SAT/ACT test prep, virtual college tours, and IvyWay AI study tools.',
    url: '/',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} preview`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Tutoring, College Counseling & IvyWay AI`,
    description:
      'Premium academic support from real tutors and college mentors—tutoring, college counseling, SAT/ACT test prep, virtual college tours, and IvyWay AI study tools.',
    images: ['/twitter-image'],
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayoutClient>{children}</PublicLayoutClient>;
}

