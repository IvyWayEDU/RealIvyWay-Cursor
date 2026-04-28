import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo/site';

export const runtime = 'edge';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #052A48 0%, #0B5F96 55%, #BFEAFF 100%)',
          position: 'relative',
          color: '#ffffff',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(900px 520px at 50% 0%, rgba(255,255,255,0.18), rgba(255,255,255,0) 62%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: -120,
            top: -160,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: 'rgba(0,136,203,0.22)',
            filter: 'blur(50px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: -140,
            top: -190,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.10)',
            filter: 'blur(50px)',
          }}
        />

        <div style={{ width: 980, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -0.8 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -1.6, lineHeight: 1.05 }}>
            Tutoring, counseling,
            <br />
            test prep — plus IvyWay AI.
          </div>
          <div style={{ fontSize: 30, opacity: 0.92, lineHeight: 1.35, maxWidth: 900 }}>
            Real tutors. Real college mentors. AI study tools built to reinforce the work.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

