import { z } from 'zod';
import { XMLParser } from 'fast-xml-parser';
import type { NextcloudClient } from '../nextcloud-client.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

export interface FileItem {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  lastModified: string;
  contentType: string;
}

function parseWebDAVListing(xml: string, basePath: string): FileItem[] {
  const parsed = parser.parse(xml);
  const multistatus = parsed?.multistatus;
  if (!multistatus) return [];

  const responses = multistatus?.response;
  if (!responses) return [];

  const responseArray = Array.isArray(responses) ? responses : [responses];
  const items: FileItem[] = [];

  for (const resp of responseArray) {
    const href: string = resp?.href || '';
    const propstat = resp?.propstat;
    const propstatArray = Array.isArray(propstat) ? propstat : [propstat];

    let prop: Record<string, unknown> = {};
    for (const ps of propstatArray) {
      const status: string = ps?.status || '';
      if (status.includes('200')) {
        prop = ps?.prop || {};
        break;
      }
    }

    const resourcetype = prop?.resourcetype;
    const isDirectory = resourcetype !== undefined && resourcetype !== null &&
      typeof resourcetype === 'object' && 'collection' in (resourcetype as Record<string, unknown>);
    const name = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
    if (!name || href === `/remote.php/dav/files/${basePath}/` || href === `/remote.php/dav/files/${basePath}`) {
      continue;
    }

    items.push({
      name,
      path: href,
      size: Number(prop?.['getcontentlength'] || 0),
      isDirectory,
      lastModified: String(prop?.['getlastmodified'] || ''),
      contentType: isDirectory ? 'directory' : String(prop?.['getcontenttype'] || 'application/octet-stream'),
    });
  }

  return items;
}

export const filesTools = [
  {
    name: 'files_list',
    description: 'List directory contents in Nextcloud',
    inputSchema: {
      path: z.string().default('/').describe('Directory path to list'),
    },
    handler: async (client: NextcloudClient, args: { path?: string }) => {
      const path = args.path || '/';
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const propfindBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:prop>
    <d:displayname/>
    <d:getcontentlength/>
    <d:getcontenttype/>
    <d:getlastmodified/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`;
      const response = await client.webdavRequest('PROPFIND', normalizedPath, propfindBody, { Depth: '1' });
      const xml = typeof response.data === 'string' ? response.data : Buffer.from(response.data as ArrayBuffer).toString('utf8');
      return parseWebDAVListing(xml, client.username);
    },
  },
  {
    name: 'files_get',
    description: 'Get file content from Nextcloud',
    inputSchema: {
      path: z.string().describe('File path to retrieve'),
    },
    handler: async (client: NextcloudClient, args: { path: string }) => {
      const normalizedPath = args.path.startsWith('/') ? args.path : `/${args.path}`;
      const response = await client.webdavRequest('GET', normalizedPath, undefined, undefined, 'arraybuffer');
      const buffer = Buffer.from(response.data as ArrayBuffer);
      const contentType = response.headers['content-type'] || '';

      if (contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('javascript')) {
        return { content: buffer.toString('utf8'), encoding: 'utf8', contentType };
      }

      try {
        const text = buffer.toString('utf8');
        if (!text.includes('\0')) {
          return { content: text, encoding: 'utf8', contentType };
        }
      } catch {
        // fall through to base64
      }

      return { content: buffer.toString('base64'), encoding: 'base64', contentType };
    },
  },
  {
    name: 'files_upload',
    description: 'Upload a file to Nextcloud',
    inputSchema: {
      path: z.string().describe('Destination path for the file'),
      content: z.string().describe('File content to upload'),
      encoding: z.enum(['utf8', 'base64']).optional().default('utf8').describe('Content encoding'),
    },
    handler: async (client: NextcloudClient, args: { path: string; content: string; encoding?: string }) => {
      const normalizedPath = args.path.startsWith('/') ? args.path : `/${args.path}`;
      const encoding = args.encoding || 'utf8';
      const data = encoding === 'base64'
        ? Buffer.from(args.content, 'base64').toString('binary')
        : args.content;
      await client.webdavRequest('PUT', normalizedPath, data, { 'Content-Type': 'application/octet-stream' });
      return { success: true, message: `File uploaded to ${normalizedPath}` };
    },
  },
  {
    name: 'files_delete',
    description: 'Delete a file or directory in Nextcloud',
    inputSchema: {
      path: z.string().describe('Path of file or directory to delete'),
    },
    handler: async (client: NextcloudClient, args: { path: string }) => {
      const normalizedPath = args.path.startsWith('/') ? args.path : `/${args.path}`;
      await client.webdavRequest('DELETE', normalizedPath);
      return { success: true, message: `Deleted ${normalizedPath}` };
    },
  },
  {
    name: 'files_mkdir',
    description: 'Create a directory in Nextcloud',
    inputSchema: {
      path: z.string().describe('Directory path to create'),
    },
    handler: async (client: NextcloudClient, args: { path: string }) => {
      const normalizedPath = args.path.startsWith('/') ? args.path : `/${args.path}`;
      await client.webdavRequest('MKCOL', normalizedPath);
      return { success: true, message: `Directory created: ${normalizedPath}` };
    },
  },
  {
    name: 'files_move',
    description: 'Move or rename a file or directory in Nextcloud',
    inputSchema: {
      from: z.string().describe('Source path'),
      to: z.string().describe('Destination path'),
      overwrite: z.boolean().optional().default(false).describe('Overwrite destination if exists'),
    },
    handler: async (client: NextcloudClient, args: { from: string; to: string; overwrite?: boolean }) => {
      const from = args.from.startsWith('/') ? args.from : `/${args.from}`;
      const to = args.to.startsWith('/') ? args.to : `/${args.to}`;
      const destination = `${client.baseUrl}/remote.php/dav/files/${client.username}${to}`;
      await client.webdavRequest('MOVE', from, undefined, {
        Destination: destination,
        Overwrite: args.overwrite ? 'T' : 'F',
      });
      return { success: true, message: `Moved ${from} to ${to}` };
    },
  },
  {
    name: 'files_copy',
    description: 'Copy a file or directory in Nextcloud',
    inputSchema: {
      from: z.string().describe('Source path'),
      to: z.string().describe('Destination path'),
      overwrite: z.boolean().optional().default(false).describe('Overwrite destination if exists'),
    },
    handler: async (client: NextcloudClient, args: { from: string; to: string; overwrite?: boolean }) => {
      const from = args.from.startsWith('/') ? args.from : `/${args.from}`;
      const to = args.to.startsWith('/') ? args.to : `/${args.to}`;
      const destination = `${client.baseUrl}/remote.php/dav/files/${client.username}${to}`;
      await client.webdavRequest('COPY', from, undefined, {
        Destination: destination,
        Overwrite: args.overwrite ? 'T' : 'F',
      });
      return { success: true, message: `Copied ${from} to ${to}` };
    },
  },
  {
    name: 'files_get_shares',
    description: 'List shares for a file or directory',
    inputSchema: {
      path: z.string().optional().describe('Path to list shares for (optional)'),
    },
    handler: async (client: NextcloudClient, args: { path?: string }) => {
      const params: Record<string, string> = {};
      if (args.path) params['path'] = args.path;
      const data = await client.ocsRequest('GET', 'apps/files_sharing/api/v1/shares', params);
      return data || [];
    },
  },
  {
    name: 'files_share',
    description: 'Create a share for a file or directory',
    inputSchema: {
      path: z.string().describe('Path to share'),
      shareType: z.number().describe('Share type: 0=user, 1=group, 3=public link, 4=email, 6=federated'),
      shareWith: z.string().optional().describe('User/group to share with (required for types 0, 1, 6)'),
      permissions: z.number().optional().describe('Permissions: 1=read, 2=update, 4=create, 8=delete, 16=share, 31=all'),
      password: z.string().optional().describe('Password for public link'),
      expireDate: z.string().optional().describe('Expiry date in YYYY-MM-DD format'),
    },
    handler: async (client: NextcloudClient, args: {
      path: string;
      shareType: number;
      shareWith?: string;
      permissions?: number;
      password?: string;
      expireDate?: string;
    }) => {
      const data: Record<string, string | number> = {
        path: args.path,
        shareType: args.shareType,
      };
      if (args.shareWith) data['shareWith'] = args.shareWith;
      if (args.permissions !== undefined) data['permissions'] = args.permissions;
      if (args.password) data['password'] = args.password;
      if (args.expireDate) data['expireDate'] = args.expireDate;
      const result = await client.ocsRequest('POST', 'apps/files_sharing/api/v1/shares', undefined, data);
      return result;
    },
  },
  {
    name: 'files_delete_share',
    description: 'Remove a share',
    inputSchema: {
      shareId: z.string().describe('Share ID to delete'),
    },
    handler: async (client: NextcloudClient, args: { shareId: string }) => {
      await client.ocsRequest('DELETE', `apps/files_sharing/api/v1/shares/${args.shareId}`);
      return { success: true, message: `Share ${args.shareId} deleted` };
    },
  },
];
