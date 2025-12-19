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
  hostEmail: string; // Provider's email address
}

let cachedToken: { token: string; expiresAt: number } | null = null;

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
    const response = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Zoom access token: ${response.status} ${errorText}`);
    }

    const data: ZoomAccessToken = await response.json();

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
): Promise<{ joinUrl: string; meetingId: string }> {
  const accessToken = await getZoomAccessToken();

  // Get the host user ID from their email
  // Note: In production, you might want to cache this mapping
  const hostUserId = await getZoomUserIdByEmail(params.hostEmail, accessToken);

  const meetingData = {
    topic: params.topic,
    type: 2, // Scheduled meeting
    start_time: params.startTime,
    duration: params.duration,
    timezone: 'UTC',
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: false,
      watermark: false,
      approval_type: 0, // Automatically approve
      audio: 'both',
      auto_recording: 'none',
    },
  };

  try {
    const response = await fetch(`https://api.zoom.us/v2/users/${hostUserId}/meetings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(meetingData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create Zoom meeting: ${response.status} ${errorText}`);
    }

    const meeting: ZoomMeeting = await response.json();

    return {
      joinUrl: meeting.join_url,
      meetingId: meeting.id.toString(),
    };
  } catch (error) {
    console.error('Error creating Zoom meeting:', error);
    throw error;
  }
}

/**
 * Get Zoom user ID by email address
 * This is needed to create meetings on behalf of the host
 */
async function getZoomUserIdByEmail(email: string, accessToken: string): Promise<string> {
  try {
    const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If user lookup fails, try using the account ID as fallback
      // Some Zoom setups allow creating meetings directly with account ID
      const accountId = process.env.ZOOM_ACCOUNT_ID;
      if (accountId) {
        console.warn(`Could not find Zoom user for email ${email}, using account ID as fallback`);
        return accountId;
      }
      const errorText = await response.text();
      throw new Error(`Failed to get Zoom user ID: ${response.status} ${errorText}`);
    }

    const user = await response.json();
    return user.id;
  } catch (error) {
    console.error('Error getting Zoom user ID:', error);
    // Fallback to account ID if available
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    if (accountId) {
      console.warn(`Using account ID as fallback for email ${email}`);
      return accountId;
    }
    throw error;
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
