/**
 * Zoom API Integration
 * 
 * Uses Zoom Server-to-Server OAuth for authentication.
 * All credentials are stored in environment variables and never exposed to the frontend.
 */

interface ZoomAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface ZoomMeeting {
  id: string;
  join_url: string;
  start_url: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  settings: {
    host_video: boolean;
    participant_video: boolean;
    join_before_host: boolean;
    mute_upon_entry: boolean;
    watermark: boolean;
    use_pmi: boolean;
    approval_type: number;
    audio: string;
    auto_recording: string;
  };
}

interface CreateZoomMeetingParams {
  topic: string;
  startTime: string; // ISO 8601 datetime string
  duration: number; // Duration in minutes
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64Encode(input: string): string {
  // Route handlers normally run in the Node.js runtime, but we guard to be safe.
  if (typeof Buffer !== 'undefined') return Buffer.from(input).toString('base64');
  if (typeof btoa !== 'undefined') return btoa(input);
  throw new Error('No base64 encoder available in this runtime');
}

/**
 * Get Zoom access token using Server-to-Server OAuth
 * Implements token caching to avoid unnecessary API calls
 */
async function getZoomAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      'Zoom credentials not configured. Please set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET environment variables.'
    );
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: accountId,
    });

    const response = await fetch(`https://zoom.us/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${base64Encode(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Zoom access token: ${response.status} ${errorText}`);
    }

    const data: ZoomAccessToken = await response.json();
    console.log('Zoom token:', data.access_token);

    // Cache the token (expire 5 minutes before actual expiry for safety)
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000,
    };

    return data.access_token;
  } catch (error) {
    console.error('Error getting Zoom access token:', error);
    throw error;
  }
}

/**
 * Create a Zoom meeting for a booking session
 * 
 * @param params Meeting parameters including topic, start time, duration, and host email
 * @returns Zoom meeting details including join_url and meeting_id
 */
export async function createZoomMeeting(
  params: CreateZoomMeetingParams
): Promise<{ joinUrl: string; startUrl: string; meetingId: string }> {
  const accessToken = await getZoomAccessToken();
  console.log('Zoom token:', accessToken);

  const meetingData = {
    topic: params.topic,
    type: 2, // Scheduled meeting
    start_time: params.startTime,
    duration: params.duration,
    timezone: 'UTC',
    settings: {
      host_video: true,
      participant_video: true,
      // Single IvyWay Zoom account: participants must be able to join without the host.
      join_before_host: true,
      mute_upon_entry: false,
      watermark: false,
      approval_type: 0, // Automatically approve
      audio: 'both',
      auto_recording: 'none',
    },
  };

  try {
    const payload = meetingData;
    console.log("Zoom payload:", payload);

    // Always create meetings under the authenticated Zoom account owner.
    // We explicitly do NOT map IvyWay providers to Zoom users.
    const response = await fetch(`https://api.zoom.us/v2/users/me/meetings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create Zoom meeting: ${response.status} ${errorText}`);
    }

    const responseData: ZoomMeeting = await response.json();
    console.log('Zoom meeting created:', responseData);

    return {
      joinUrl: responseData.join_url,
      startUrl: responseData.start_url,
      meetingId: responseData.id.toString(),
    };
  } catch (err: any) {
    console.error("Zoom API error:", err?.response?.data || err?.message);
    throw err;
  }
}

/**
 * Check if Zoom is configured
 */
export function isZoomConfigured(): boolean {
  return !!(
    process.env.ZOOM_ACCOUNT_ID &&
    process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET
  );
}
