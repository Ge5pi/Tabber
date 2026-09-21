export interface CalendarEventPayload {
  title: string;
  description?: string;
  startDateTime?: string; // ISO string YYYY-MM-DDTHH:mm:ss
  endDateTime?: string;   // ISO string YYYY-MM-DDTHH:mm:ss
  durationMinutes?: number;
}

export interface CalendarEventResult {
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
  viaWebFallback?: boolean;
}

export const createGoogleCalendarWebLink = (eventData: CalendarEventPayload): string => {
  const startDate = eventData.startDateTime
    ? new Date(eventData.startDateTime)
    : new Date(Date.now() + 3600000);

  const durationMs = (eventData.durationMinutes || 30) * 60 * 1000;
  const endDate = eventData.endDateTime
    ? new Date(eventData.endDateTime)
    : new Date(startDate.getTime() + durationMs);

  const formatIsoForUrl = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const datesStr = `${formatIsoForUrl(startDate)}/${formatIsoForUrl(endDate)}`;
  const titleStr = encodeURIComponent(eventData.title);
  const detailsStr = encodeURIComponent(eventData.description || 'Created via TabAI Copilot');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titleStr}&details=${detailsStr}&dates=${datesStr}`;
};

export const createCalendarEvent = async (
  token: string | null,
  eventData: CalendarEventPayload
): Promise<CalendarEventResult> => {
  const webLink = createGoogleCalendarWebLink(eventData);

  // If no token or demo token, fallback gracefully to Google Calendar Web Link
  if (!token || token.startsWith('demo_') || token.startsWith('mock_')) {
    console.log('[Calendar API] No GCP OAuth Token active. Opening Google Calendar web template...');
    window.open(webLink, '_blank');
    return {
      success: true,
      htmlLink: webLink,
      viaWebFallback: true
    };
  }

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const startDate = eventData.startDateTime
    ? new Date(eventData.startDateTime)
    : new Date(Date.now() + 3600000);

  const durationMs = (eventData.durationMinutes || 30) * 60 * 1000;
  const endDate = eventData.endDateTime
    ? new Date(eventData.endDateTime)
    : new Date(startDate.getTime() + durationMs);

  const requestBody = {
    summary: eventData.title,
    description: eventData.description || 'Created via TabAI Copilot',
    start: {
      dateTime: startDate.toISOString(),
      timeZone: userTimeZone
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: userTimeZone
    },
    reminders: {
      useDefault: true
    }
  };

  console.log(`[Calendar API] Creating event "${eventData.title}" via REST API...`);

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      console.warn(`⚠️ [Calendar API Warning] HTTP ${res.status}. Falling back to Google Calendar Web link.`);
      window.open(webLink, '_blank');
      return {
        success: true,
        htmlLink: webLink,
        viaWebFallback: true
      };
    }

    const data = await res.json();
    console.log(`✅ [Calendar API Success] Event created! ID: ${data.id}, Link: ${data.htmlLink}`);
    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink || webLink
    };
  } catch (err: any) {
    console.warn('⚠️ [Calendar API Exception]: Falling back to Google Calendar Web link.', err);
    window.open(webLink, '_blank');
    return {
      success: true,
      htmlLink: webLink,
      viaWebFallback: true
    };
  }
};
