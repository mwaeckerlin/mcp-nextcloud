import { z } from 'zod';
import { XMLParser } from 'fast-xml-parser';
import type { NextcloudClient } from '../nextcloud-client.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

function formatICalDate(isoString: string, allDay: boolean = false): string {
  const date = new Date(isoString);
  if (allDay) {
    return date.toISOString().replace(/-/g, '').substring(0, 8);
  }
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

import { randomUUID } from 'crypto';

function generateUID(): string {
  return `${randomUUID()}@mcp-nextcloud`;
}

function buildICalEvent(params: {
  uid: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  allDay?: boolean;
}): string {
  const dtstart = formatICalDate(params.start, params.allDay);
  const dtend = formatICalDate(params.end, params.allDay);
  const now = formatICalDate(new Date().toISOString());

  let vcal = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//mcp-nextcloud//EN\r\nBEGIN:VEVENT\r\n`;
  vcal += `UID:${params.uid}\r\n`;
  vcal += `DTSTAMP:${now}\r\n`;
  if (params.allDay) {
    vcal += `DTSTART;VALUE=DATE:${dtstart}\r\n`;
    vcal += `DTEND;VALUE=DATE:${dtend}\r\n`;
  } else {
    vcal += `DTSTART:${dtstart}\r\n`;
    vcal += `DTEND:${dtend}\r\n`;
  }
  vcal += `SUMMARY:${params.summary}\r\n`;
  if (params.description) vcal += `DESCRIPTION:${params.description}\r\n`;
  if (params.location) vcal += `LOCATION:${params.location}\r\n`;
  vcal += `END:VEVENT\r\nEND:VCALENDAR`;
  return vcal;
}

function parseICalEvent(ical: string): Record<string, string> {
  const lines = ical.split(/\r?\n/);
  const event: Record<string, string> = {};
  let inEvent = false;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; continue; }
    if (line === 'END:VEVENT') { inEvent = false; continue; }
    if (!inEvent) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).split(';')[0];
    const value = line.substring(colonIdx + 1);
    event[key] = value;
  }
  return event;
}

export const calendarTools = [
  {
    name: 'calendar_list',
    description: 'List all calendars in Nextcloud',
    inputSchema: {},
    handler: async (client: NextcloudClient, _args: Record<string, unknown>) => {
      const propfindBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname/>
    <cs:getctag/>
    <c:supported-calendar-component-set/>
  </d:prop>
</d:propfind>`;
      const response = await client.caldavRequest('PROPFIND', '/', propfindBody, { Depth: '1' });
      const parsed = parser.parse(response.data);
      const multistatus = parsed?.multistatus;
      if (!multistatus) return [];
      const responses = multistatus?.response;
      if (!responses) return [];
      const responseArray = Array.isArray(responses) ? responses : [responses];
      const calendars = [];
      for (const resp of responseArray) {
        const href: string = resp?.href || '';
        const propstat = resp?.propstat;
        const propstatArray = Array.isArray(propstat) ? propstat : [propstat];
        let prop: Record<string, unknown> = {};
        for (const ps of propstatArray) {
          const status: string = ps?.status || '';
          if (status.includes('200')) { prop = ps?.prop || {}; break; }
        }
        const displayname = prop?.displayname;
        if (!displayname) continue;
        const slug = href.split('/').filter(Boolean).pop() || '';
        calendars.push({ name: slug, displayName: String(displayname), href });
      }
      return calendars;
    },
  },
  {
    name: 'calendar_get_events',
    description: 'Get events from a calendar',
    inputSchema: {
      calendar: z.string().describe('Calendar name/slug'),
      start: z.string().optional().describe('Start date filter (ISO format)'),
      end: z.string().optional().describe('End date filter (ISO format)'),
    },
    handler: async (client: NextcloudClient, args: { calendar: string; start?: string; end?: string }) => {
      let reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">`;
      if (args.start || args.end) {
        const startStr = args.start ? formatICalDate(args.start) : '19700101T000000Z';
        const endStr = args.end ? formatICalDate(args.end) : '99991231T235959Z';
        reportBody += `\n        <c:time-range start="${startStr}" end="${endStr}"/>`;
      }
      reportBody += `\n      </c:comp-filter>\n    </c:comp-filter>\n  </c:filter>\n</c:calendar-query>`;

      const response = await client.caldavRequest('REPORT', `/${args.calendar}/`, reportBody, {
        Depth: '1',
        'Content-Type': 'application/xml',
      });
      const parsed = parser.parse(response.data);
      const multistatus = parsed?.multistatus;
      if (!multistatus) return [];
      const responses = multistatus?.response;
      if (!responses) return [];
      const responseArray = Array.isArray(responses) ? responses : [responses];
      const events = [];
      for (const resp of responseArray) {
        const propstat = resp?.propstat;
        const propstatArray = Array.isArray(propstat) ? propstat : [propstat];
        let prop: Record<string, unknown> = {};
        for (const ps of propstatArray) {
          const status: string = ps?.status || '';
          if (status.includes('200')) { prop = ps?.prop || {}; break; }
        }
        const calendarData = prop?.['calendar-data'];
        if (!calendarData) continue;
        const eventData = parseICalEvent(String(calendarData));
        events.push({
          uid: eventData['UID'] || '',
          summary: eventData['SUMMARY'] || '',
          start: eventData['DTSTART'] || '',
          end: eventData['DTEND'] || '',
          description: eventData['DESCRIPTION'] || '',
          location: eventData['LOCATION'] || '',
        });
      }
      return events;
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a calendar event',
    inputSchema: {
      calendar: z.string().describe('Calendar name/slug'),
      uid: z.string().optional().describe('Event UID (auto-generated if not provided)'),
      summary: z.string().describe('Event title/summary'),
      start: z.string().describe('Start datetime (ISO format)'),
      end: z.string().describe('End datetime (ISO format)'),
      description: z.string().optional().describe('Event description'),
      location: z.string().optional().describe('Event location'),
      allDay: z.boolean().optional().describe('Whether this is an all-day event'),
    },
    handler: async (client: NextcloudClient, args: {
      calendar: string; uid?: string; summary: string;
      start: string; end: string; description?: string;
      location?: string; allDay?: boolean;
    }) => {
      const uid = args.uid || generateUID();
      const ical = buildICalEvent({
        uid, summary: args.summary, start: args.start, end: args.end,
        description: args.description, location: args.location, allDay: args.allDay,
      });
      await client.caldavRequest('PUT', `/${args.calendar}/${uid}.ics`, ical, {
        'Content-Type': 'text/calendar; charset=utf-8',
      });
      return { success: true, uid };
    },
  },
  {
    name: 'calendar_update_event',
    description: 'Update an existing calendar event',
    inputSchema: {
      calendar: z.string().describe('Calendar name/slug'),
      uid: z.string().describe('Event UID'),
      summary: z.string().optional().describe('Event title/summary'),
      start: z.string().optional().describe('Start datetime (ISO format)'),
      end: z.string().optional().describe('End datetime (ISO format)'),
      description: z.string().optional().describe('Event description'),
      location: z.string().optional().describe('Event location'),
      allDay: z.boolean().optional().describe('Whether this is an all-day event'),
    },
    handler: async (client: NextcloudClient, args: {
      calendar: string; uid: string; summary?: string;
      start?: string; end?: string; description?: string;
      location?: string; allDay?: boolean;
    }) => {
      const response = await client.caldavRequest('GET', `/${args.calendar}/${args.uid}.ics`);
      const existing = parseICalEvent(response.data);
      const ical = buildICalEvent({
        uid: args.uid,
        summary: args.summary || existing['SUMMARY'] || '',
        start: args.start || existing['DTSTART'] || '',
        end: args.end || existing['DTEND'] || '',
        description: args.description !== undefined ? args.description : existing['DESCRIPTION'],
        location: args.location !== undefined ? args.location : existing['LOCATION'],
        allDay: args.allDay,
      });
      await client.caldavRequest('PUT', `/${args.calendar}/${args.uid}.ics`, ical, {
        'Content-Type': 'text/calendar; charset=utf-8',
      });
      return { success: true, uid: args.uid };
    },
  },
  {
    name: 'calendar_delete_event',
    description: 'Delete a calendar event',
    inputSchema: {
      calendar: z.string().describe('Calendar name/slug'),
      uid: z.string().describe('Event UID'),
    },
    handler: async (client: NextcloudClient, args: { calendar: string; uid: string }) => {
      await client.caldavRequest('DELETE', `/${args.calendar}/${args.uid}.ics`);
      return { success: true, message: `Event ${args.uid} deleted from ${args.calendar}` };
    },
  },
];
