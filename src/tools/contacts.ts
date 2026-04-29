import { z } from 'zod';
import { XMLParser } from 'fast-xml-parser';
import type { NextcloudClient } from '../nextcloud-client.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

import { randomUUID } from 'crypto';

function generateUID(): string {
  return randomUUID();
}

function buildVCard(params: {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
}): string {
  let vcard = `BEGIN:VCARD\r\nVERSION:3.0\r\n`;
  vcard += `UID:${params.uid}\r\n`;
  vcard += `FN:${params.name}\r\n`;
  const nameParts = params.name.trim().split(/\s+/);
  const lastName = nameParts.length > 1 ? (nameParts.pop() || '') : '';
  const firstName = nameParts.join(' ');
  vcard += `N:${lastName};${firstName};;;\r\n`;
  if (params.email) vcard += `EMAIL:${params.email}\r\n`;
  if (params.phone) vcard += `TEL:${params.phone}\r\n`;
  if (params.organization) vcard += `ORG:${params.organization}\r\n`;
  vcard += `END:VCARD`;
  return vcard;
}

function parseVCard(vcardStr: string): Record<string, string> {
  const lines = vcardStr.split(/\r?\n/);
  const contact: Record<string, string> = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).split(';')[0];
    const value = line.substring(colonIdx + 1);
    if (key && value) contact[key] = value;
  }
  return contact;
}

export const contactsTools = [
  {
    name: 'contacts_list_addressbooks',
    description: 'List all address books in Nextcloud',
    inputSchema: {},
    handler: async (client: NextcloudClient, _args: Record<string, unknown>) => {
      const propfindBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`;
      const response = await client.carddavRequest('PROPFIND', '/', propfindBody, { Depth: '1' });
      const parsed = parser.parse(response.data);
      const multistatus = parsed?.multistatus;
      if (!multistatus) return [];
      const responses = multistatus?.response;
      if (!responses) return [];
      const responseArray = Array.isArray(responses) ? responses : [responses];
      const addressbooks = [];
      for (const resp of responseArray) {
        const href: string = resp?.href || '';
        const propstat = resp?.propstat;
        const propstatArray = Array.isArray(propstat) ? propstat : [propstat];
        let prop: Record<string, unknown> = {};
        for (const ps of propstatArray) {
          const status: string = ps?.status || '';
          if (status.includes('200')) { prop = ps?.prop || {}; break; }
        }
        const resourcetype = prop?.resourcetype as Record<string, unknown> | undefined;
        const isAddressbook = resourcetype && 'addressbook' in resourcetype;
        if (!isAddressbook) continue;
        const displayname = prop?.displayname;
        const slug = href.split('/').filter(Boolean).pop() || '';
        addressbooks.push({ name: slug, displayName: String(displayname || slug), href });
      }
      return addressbooks;
    },
  },
  {
    name: 'contacts_list',
    description: 'List contacts in an address book',
    inputSchema: {
      addressbook: z.string().describe('Address book name'),
    },
    handler: async (client: NextcloudClient, args: { addressbook: string }) => {
      const propfindBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag/>
    <card:address-data/>
  </d:prop>
</d:propfind>`;
      const response = await client.carddavRequest('PROPFIND', `/${args.addressbook}/`, propfindBody, { Depth: '1' });
      const parsed = parser.parse(response.data);
      const multistatus = parsed?.multistatus;
      if (!multistatus) return [];
      const responses = multistatus?.response;
      if (!responses) return [];
      const responseArray = Array.isArray(responses) ? responses : [responses];
      const contacts = [];
      for (const resp of responseArray) {
        const href: string = resp?.href || '';
        if (!href.endsWith('.vcf')) continue;
        const propstat = resp?.propstat;
        const propstatArray = Array.isArray(propstat) ? propstat : [propstat];
        let prop: Record<string, unknown> = {};
        for (const ps of propstatArray) {
          const status: string = ps?.status || '';
          if (status.includes('200')) { prop = ps?.prop || {}; break; }
        }
        const addressData = prop?.['address-data'];
        if (!addressData) continue;
        const vcard = parseVCard(String(addressData));
        contacts.push({
          uid: vcard['UID'] || href.split('/').pop()?.replace('.vcf', '') || '',
          name: vcard['FN'] || '',
          email: vcard['EMAIL'] || '',
          phone: vcard['TEL'] || '',
        });
      }
      return contacts;
    },
  },
  {
    name: 'contacts_get',
    description: 'Get a specific contact',
    inputSchema: {
      addressbook: z.string().describe('Address book name'),
      uid: z.string().describe('Contact UID'),
    },
    handler: async (client: NextcloudClient, args: { addressbook: string; uid: string }) => {
      const response = await client.carddavRequest('GET', `/${args.addressbook}/${args.uid}.vcf`);
      const vcard = parseVCard(response.data);
      return {
        uid: vcard['UID'] || args.uid,
        name: vcard['FN'] || '',
        email: vcard['EMAIL'] || '',
        phone: vcard['TEL'] || '',
        organization: vcard['ORG'] || '',
        raw: response.data,
      };
    },
  },
  {
    name: 'contacts_create',
    description: 'Create a new contact',
    inputSchema: {
      addressbook: z.string().describe('Address book name'),
      uid: z.string().optional().describe('Contact UID (auto-generated if not provided)'),
      name: z.string().describe('Full name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      organization: z.string().optional().describe('Organization/company'),
    },
    handler: async (client: NextcloudClient, args: {
      addressbook: string; uid?: string; name: string;
      email?: string; phone?: string; organization?: string;
    }) => {
      const uid = args.uid || generateUID();
      const vcard = buildVCard({ uid, name: args.name, email: args.email, phone: args.phone, organization: args.organization });
      await client.carddavRequest('PUT', `/${args.addressbook}/${uid}.vcf`, vcard, {
        'Content-Type': 'text/vcard; charset=utf-8',
      });
      return { success: true, uid };
    },
  },
  {
    name: 'contacts_update',
    description: 'Update an existing contact',
    inputSchema: {
      addressbook: z.string().describe('Address book name'),
      uid: z.string().describe('Contact UID'),
      name: z.string().optional().describe('Full name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      organization: z.string().optional().describe('Organization/company'),
    },
    handler: async (client: NextcloudClient, args: {
      addressbook: string; uid: string; name?: string;
      email?: string; phone?: string; organization?: string;
    }) => {
      const response = await client.carddavRequest('GET', `/${args.addressbook}/${args.uid}.vcf`);
      const existing = parseVCard(response.data);
      const vcard = buildVCard({
        uid: args.uid,
        name: args.name || existing['FN'] || '',
        email: args.email !== undefined ? args.email : existing['EMAIL'],
        phone: args.phone !== undefined ? args.phone : existing['TEL'],
        organization: args.organization !== undefined ? args.organization : existing['ORG'],
      });
      await client.carddavRequest('PUT', `/${args.addressbook}/${args.uid}.vcf`, vcard, {
        'Content-Type': 'text/vcard; charset=utf-8',
      });
      return { success: true, uid: args.uid };
    },
  },
  {
    name: 'contacts_delete',
    description: 'Delete a contact',
    inputSchema: {
      addressbook: z.string().describe('Address book name'),
      uid: z.string().describe('Contact UID'),
    },
    handler: async (client: NextcloudClient, args: { addressbook: string; uid: string }) => {
      await client.carddavRequest('DELETE', `/${args.addressbook}/${args.uid}.vcf`);
      return { success: true, message: `Contact ${args.uid} deleted from ${args.addressbook}` };
    },
  },
];
