'use client';

import { BadgeType } from '@/lib/providers/badges';

interface ProviderBadgesProps {
  badges: BadgeType[];
  className?: string;
}

/**
 * Badge configuration with icons and tooltips
 */
const BADGE_CONFIG: Record<BadgeType, { label: string; description: string; color: string }> = {
  'top-rated': {
    label: 'Top Rated',
    description: 'Rating ≥ 4.7, at least 10 completed sessions, and no-show rate < 5%',
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  },
  'fast-responder': {
    label: 'Fast Responder',
    description: 'Median message response time < 30 minutes over last 10 sessions',
    color: 'text-green-600 bg-green-50 border-green-200',
  },
  'verified-college-student': {
    label: 'Verified College Student',
    description: 'College field filled and school email verified',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  'ivyway-recommended': {
    label: 'IvyWay Recommended',
    description: 'Recommended by IvyWay team',
    color: 'text-purple-600 bg-purple-50 border-purple-200',
  },
};

/**
 * Icon components for each badge
 */
function TopRatedIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function FastResponderIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function VerifiedCollegeStudentIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function IvyWayRecommendedIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function getBadgeIcon(badgeType: BadgeType) {
  switch (badgeType) {
    case 'top-rated':
      return <TopRatedIcon />;
    case 'fast-responder':
      return <FastResponderIcon />;
    case 'verified-college-student':
      return <VerifiedCollegeStudentIcon />;
    case 'ivyway-recommended':
      return <IvyWayRecommendedIcon />;
  }
}

export default function ProviderBadges({ badges, className = '' }: ProviderBadgesProps) {
  if (badges.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badges.map((badgeType) => {
        const config = BADGE_CONFIG[badgeType];
        return (
          <div
            key={badgeType}
            className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${config.color}`}
          >
            {getBadgeIcon(badgeType)}
            <span>{config.label}</span>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
              <div className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 whitespace-nowrap shadow-lg">
                {config.description}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}






