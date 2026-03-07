'use client';

import { useState } from 'react';

interface Booking {
  id: string;
  providerPayoutCents: number;
  payoutStatus: 'available' | 'pending_payout' | 'approved' | 'paid' | 'paid_out';
  serviceLabel: string;
  completedAt?: string;
  bookedAt: string;
  scheduledStartTime: string;
}

interface EarningsGraphProps {
  bookings: Booking[];
}

export default function EarningsGraph({ bookings }: EarningsGraphProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Filter to only show bookings with payoutStatus='available' (or later stages)
  const displayBookings = bookings
    .filter(b => b.payoutStatus === 'available' || b.payoutStatus === 'pending_payout' || b.payoutStatus === 'approved' || b.payoutStatus === 'paid' || b.payoutStatus === 'paid_out')
    .sort((a, b) => {
      const dateA = new Date(a.completedAt || a.bookedAt || a.scheduledStartTime);
      const dateB = new Date(b.completedAt || b.bookedAt || b.scheduledStartTime);
      return dateA.getTime() - dateB.getTime();
    });

  if (displayBookings.length === 0) {
    return null;
  }

  // Calculate cumulative earnings over time
  let cumulativeEarnings = 0;
  const dataPoints = displayBookings.map((booking) => {
    cumulativeEarnings += booking.providerPayoutCents;
    const date = new Date(booking.completedAt || booking.bookedAt || booking.scheduledStartTime);
    return {
      date,
      earnings: cumulativeEarnings,
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
  });

  // Graph dimensions
  const width = 100;
  const height = 60;
  const padding = { top: 12, right: 12, bottom: 8, left: 4 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxEarnings = Math.max(...dataPoints.map(d => d.earnings), 1);
  const minEarnings = 0;
  const earningsRange = maxEarnings - minEarnings || 1;

  // Generate path for line
  const points = dataPoints.map((point, index) => {
    const x = padding.left + (index / (dataPoints.length - 1 || 1)) * graphWidth;
    const y = padding.top + graphHeight - ((point.earnings - minEarnings) / earningsRange) * graphHeight;
    return { 
      x, 
      y, 
      earnings: point.earnings, 
      label: point.label,
      fullDate: point.fullDate,
      index,
    };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const hoveredPointData = hoveredPoint !== null ? points[hoveredPoint] : null;

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Earnings Over Time</h2>
      </div>
      <div className="p-6">
        <div className="w-full relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-48"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + graphHeight - ratio * graphHeight;
              return (
                <line
                  key={ratio}
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="0.5"
                />
              );
            })}

            {/* Y-axis line (minimal) */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={height - padding.bottom}
              stroke="#e5e7eb"
              strokeWidth="0.5"
            />

            {/* Line path */}
            <path
              d={pathData}
              fill="none"
              stroke="#0088CB"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Invisible hover areas */}
            {points.map((point, index) => {
              let hoverX = point.x;
              let hoverWidth = 4;
              
              if (points.length > 1) {
                if (index === 0) {
                  // First point: hover area extends to midpoint with next point
                  const nextX = points[index + 1].x;
                  hoverWidth = Math.max(4, (nextX - point.x) / 2);
                  hoverX = point.x;
                } else if (index === points.length - 1) {
                  // Last point: hover area extends from midpoint with previous point
                  const prevX = points[index - 1].x;
                  hoverWidth = Math.max(4, (point.x - prevX) / 2);
                  hoverX = point.x - hoverWidth;
                } else {
                  // Middle points: hover area extends to midpoints with adjacent points
                  const prevX = points[index - 1].x;
                  const nextX = points[index + 1].x;
                  hoverWidth = Math.max(4, (nextX - prevX) / 2);
                  hoverX = point.x - hoverWidth / 2;
                }
              }
              
              return (
                <rect
                  key={`hover-${index}`}
                  x={hoverX}
                  y={padding.top}
                  width={hoverWidth}
                  height={graphHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredPoint(index)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}

            {/* Data points */}
            {points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={hoveredPoint === index ? "4" : "1"}
                fill="#0088CB"
                className="transition-all"
              />
            ))}

            {/* Hover indicator line */}
            {hoveredPointData && (
              <line
                x1={hoveredPointData.x}
                y1={padding.top}
                x2={hoveredPointData.x}
                y2={height - padding.bottom}
                stroke="#0088CB"
                strokeWidth="1"
                strokeDasharray="2,2"
                opacity="0.5"
              />
            )}
          </svg>

          {/* Tooltip */}
          {hoveredPointData && (
            <div
              className="absolute bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none z-10 whitespace-nowrap"
              style={{
                left: `${Math.min(Math.max((hoveredPointData.x / width) * 100, 5), 95)}%`,
                bottom: `${((height - hoveredPointData.y) / height) * 100}%`,
                transform: 'translateX(-50%) translateY(-100%) translateY(-8px)',
              }}
            >
              <div className="font-semibold">{hoveredPointData.fullDate}</div>
              <div className="text-gray-300 mt-0.5">{formatCurrency(hoveredPointData.earnings)}</div>
            </div>
          )}

          {/* X-axis labels */}
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            {dataPoints.length > 0 && (
              <>
                <span>{dataPoints[0].label}</span>
                {dataPoints.length > 1 && (
                  <span>{dataPoints[dataPoints.length - 1].label}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

