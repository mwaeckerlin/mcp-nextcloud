import { z } from 'zod';
import type { NextcloudClient } from '../nextcloud-client.js';

export const usersTools = [
  {
    name: 'users_list',
    description: 'List Nextcloud users',
    inputSchema: {
      search: z.string().optional().describe('Search term'),
      limit: z.number().optional().describe('Maximum number of users to return'),
      offset: z.number().optional().describe('Offset for pagination'),
    },
    handler: async (client: NextcloudClient, args: { search?: string; limit?: number; offset?: number }) => {
      const params: Record<string, string | number> = {};
      if (args.search) params['search'] = args.search;
      if (args.limit !== undefined) params['limit'] = args.limit;
      if (args.offset !== undefined) params['offset'] = args.offset;
      const data = await client.ocsRequest('GET', 'cloud/users', params);
      const users = (data as { users?: string[] })?.users;
      return users || [];
    },
  },
  {
    name: 'users_get',
    description: 'Get details of a specific user',
    inputSchema: {
      username: z.string().describe('Username to look up'),
    },
    handler: async (client: NextcloudClient, args: { username: string }) => {
      const data = await client.ocsRequest('GET', `cloud/users/${args.username}`);
      return data;
    },
  },
  {
    name: 'users_create',
    description: 'Create a new Nextcloud user',
    inputSchema: {
      username: z.string().describe('Username for the new user'),
      password: z.string().optional().describe('Password (required if no email)'),
      email: z.string().optional().describe('Email address'),
      displayName: z.string().optional().describe('Display name'),
      groups: z.array(z.string()).optional().describe('Groups to add user to'),
    },
    handler: async (client: NextcloudClient, args: {
      username: string; password?: string; email?: string;
      displayName?: string; groups?: string[];
    }) => {
      const data: Record<string, string | string[]> = { userid: args.username };
      if (args.password) data['password'] = args.password;
      if (args.email) data['email'] = args.email;
      if (args.displayName) data['displayName'] = args.displayName;
      if (args.groups) data['groups[]'] = args.groups;
      await client.ocsRequest('POST', 'cloud/users', undefined, data);
      return { success: true, message: `User ${args.username} created` };
    },
  },
  {
    name: 'users_update',
    description: 'Update a user attribute',
    inputSchema: {
      username: z.string().describe('Username to update'),
      key: z.enum(['email', 'displayname', 'phone', 'address', 'website', 'twitter', 'password', 'quota']).describe('Attribute to update'),
      value: z.string().describe('New value'),
    },
    handler: async (client: NextcloudClient, args: { username: string; key: string; value: string }) => {
      await client.ocsRequest('PUT', `cloud/users/${args.username}`, undefined, { key: args.key, value: args.value });
      return { success: true, message: `User ${args.username} updated: ${args.key}` };
    },
  },
  {
    name: 'users_delete',
    description: 'Delete a user',
    inputSchema: {
      username: z.string().describe('Username to delete'),
    },
    handler: async (client: NextcloudClient, args: { username: string }) => {
      await client.ocsRequest('DELETE', `cloud/users/${args.username}`);
      return { success: true, message: `User ${args.username} deleted` };
    },
  },
  {
    name: 'users_enable',
    description: 'Enable a user account',
    inputSchema: {
      username: z.string().describe('Username to enable'),
    },
    handler: async (client: NextcloudClient, args: { username: string }) => {
      await client.ocsRequest('PUT', `cloud/users/${args.username}/enable`);
      return { success: true, message: `User ${args.username} enabled` };
    },
  },
  {
    name: 'users_disable',
    description: 'Disable a user account',
    inputSchema: {
      username: z.string().describe('Username to disable'),
    },
    handler: async (client: NextcloudClient, args: { username: string }) => {
      await client.ocsRequest('PUT', `cloud/users/${args.username}/disable`);
      return { success: true, message: `User ${args.username} disabled` };
    },
  },
  {
    name: 'groups_list',
    description: 'List Nextcloud groups',
    inputSchema: {
      search: z.string().optional().describe('Search term'),
    },
    handler: async (client: NextcloudClient, args: { search?: string }) => {
      const params: Record<string, string> = {};
      if (args.search) params['search'] = args.search;
      const data = await client.ocsRequest('GET', 'cloud/groups', params);
      const groups = (data as { groups?: string[] })?.groups;
      return groups || [];
    },
  },
  {
    name: 'groups_get',
    description: 'Get members of a group',
    inputSchema: {
      group: z.string().describe('Group name'),
    },
    handler: async (client: NextcloudClient, args: { group: string }) => {
      const data = await client.ocsRequest('GET', `cloud/groups/${args.group}`);
      const users = (data as { users?: string[] })?.users;
      return users || [];
    },
  },
  {
    name: 'groups_create',
    description: 'Create a new group',
    inputSchema: {
      group: z.string().describe('Group name to create'),
    },
    handler: async (client: NextcloudClient, args: { group: string }) => {
      await client.ocsRequest('POST', 'cloud/groups', undefined, { groupid: args.group });
      return { success: true, message: `Group ${args.group} created` };
    },
  },
  {
    name: 'groups_delete',
    description: 'Delete a group',
    inputSchema: {
      group: z.string().describe('Group name to delete'),
    },
    handler: async (client: NextcloudClient, args: { group: string }) => {
      await client.ocsRequest('DELETE', `cloud/groups/${args.group}`);
      return { success: true, message: `Group ${args.group} deleted` };
    },
  },
  {
    name: 'groups_add_member',
    description: 'Add a user to a group',
    inputSchema: {
      username: z.string().describe('Username to add'),
      group: z.string().describe('Group name'),
    },
    handler: async (client: NextcloudClient, args: { username: string; group: string }) => {
      await client.ocsRequest('POST', `cloud/users/${args.username}/groups`, undefined, { groupid: args.group });
      return { success: true, message: `User ${args.username} added to group ${args.group}` };
    },
  },
  {
    name: 'groups_remove_member',
    description: 'Remove a user from a group',
    inputSchema: {
      username: z.string().describe('Username to remove'),
      group: z.string().describe('Group name'),
    },
    handler: async (client: NextcloudClient, args: { username: string; group: string }) => {
      await client.ocsRequest('DELETE', `cloud/users/${args.username}/groups`, undefined, { groupid: args.group });
      return { success: true, message: `User ${args.username} removed from group ${args.group}` };
    },
  },
];
