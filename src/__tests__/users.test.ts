import { jest } from '@jest/globals';
import { NextcloudClient } from '../nextcloud-client.js';
import { usersTools } from '../tools/users.js';

const config = {
  url: 'https://nextcloud.example.com',
  username: 'testuser',
  password: 'testpass',
};

describe('users_list', () => {
  let client: NextcloudClient;

  beforeEach(() => {
    client = new NextcloudClient(config);
    jest.restoreAllMocks();
  });

  it('returns array of usernames', async () => {
    jest.spyOn(client, 'ocsRequest').mockResolvedValueOnce({ users: ['admin', 'user1', 'user2'] });

    const tool = usersTools.find(t => t.name === 'users_list')!;
    const result = await tool.handler(client, {} as never) as string[];

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('admin');
    expect(result).toContain('user1');
  });
});

describe('users_get', () => {
  let client: NextcloudClient;

  beforeEach(() => {
    client = new NextcloudClient(config);
    jest.restoreAllMocks();
  });

  it('returns user object', async () => {
    const userData = {
      id: 'admin',
      display_name: 'Administrator',
      email: 'admin@example.com',
      groups: ['admin'],
    };
    jest.spyOn(client, 'ocsRequest').mockResolvedValueOnce(userData);

    const tool = usersTools.find(t => t.name === 'users_get')!;
    const result = await tool.handler(client, { username: 'admin' } as never) as typeof userData;

    expect(result).toBeDefined();
    expect((result as Record<string, unknown>)?.id || (result as Record<string, unknown>)?.display_name).toBeTruthy();
  });
});

describe('users_create', () => {
  let client: NextcloudClient;

  beforeEach(() => {
    client = new NextcloudClient(config);
    jest.restoreAllMocks();
  });

  it('sends correct POST data', async () => {
    const spy = jest.spyOn(client, 'ocsRequest').mockResolvedValueOnce(null);

    const tool = usersTools.find(t => t.name === 'users_create')!;
    const result = await tool.handler(client, {
      username: 'newuser',
      password: 'password123',
      email: 'newuser@example.com',
      displayName: 'New User',
    } as never) as { success: boolean };

    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      'POST',
      'cloud/users',
      undefined,
      expect.objectContaining({ userid: 'newuser' })
    );
  });
});

describe('error handling', () => {
  let client: NextcloudClient;

  beforeEach(() => {
    client = new NextcloudClient(config);
    jest.restoreAllMocks();
  });

  it('throws on API failure', async () => {
    jest.spyOn(client, 'ocsRequest').mockRejectedValueOnce(
      new Error('HTTP 403 Forbidden: Forbidden')
    );

    const tool = usersTools.find(t => t.name === 'users_list')!;
    await expect(tool.handler(client, {} as never)).rejects.toThrow();
  });
});
