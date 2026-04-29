import { z } from 'zod';
import type { NextcloudClient } from '../nextcloud-client.js';

export const appsTools = [
  {
    name: 'apps_list',
    description: 'List Nextcloud apps',
    inputSchema: {
      filter: z.enum(['enabled', 'disabled']).optional().describe('Filter by enabled or disabled status'),
    },
    handler: async (client: NextcloudClient, args: { filter?: string }) => {
      const params: Record<string, string> = {};
      if (args.filter) params['filter'] = args.filter;
      const data = await client.ocsRequest('GET', 'cloud/apps', params);
      const apps = (data as { apps?: string[] })?.apps;
      return apps || [];
    },
  },
  {
    name: 'apps_get_info',
    description: 'Get information about a specific app',
    inputSchema: {
      app: z.string().describe('App ID'),
    },
    handler: async (client: NextcloudClient, args: { app: string }) => {
      const data = await client.ocsRequest('GET', `cloud/apps/${args.app}`);
      return data;
    },
  },
  {
    name: 'apps_enable',
    description: 'Enable an app',
    inputSchema: {
      app: z.string().describe('App ID to enable'),
    },
    handler: async (client: NextcloudClient, args: { app: string }) => {
      await client.ocsRequest('POST', `cloud/apps/${args.app}`);
      return { success: true, message: `App ${args.app} enabled` };
    },
  },
  {
    name: 'apps_disable',
    description: 'Disable an app',
    inputSchema: {
      app: z.string().describe('App ID to disable'),
    },
    handler: async (client: NextcloudClient, args: { app: string }) => {
      await client.ocsRequest('DELETE', `cloud/apps/${args.app}`);
      return { success: true, message: `App ${args.app} disabled` };
    },
  },
];
