import axios from 'axios';
import { NextcloudClient } from '../nextcloud-client.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const config = {
  url: 'https://cloud.example.com',
  username: 'alice',
  password: 'secret-app-password',
};

function makeInstance(overrides: Partial<typeof config> = {}): NextcloudClient {
  return new NextcloudClient({ ...config, ...overrides });
}

describe('NextcloudClient', () => {
  let mockRequest: jest.Mock;

  beforeEach(() => {
    mockRequest = jest.fn();
    mockedAxios.create = jest.fn().mockReturnValue({ request: mockRequest });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('exposes baseUrl and username but not the password', () => {
    const client = makeInstance();
    expect(client.baseUrl).toBe(config.url);
    expect(client.username).toBe(config.username);
    expect((client as unknown as Record<string, unknown>).password).toBeUndefined();
  });

  it('creates axios instance with Basic Auth', () => {
    makeInstance();
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { username: config.username, password: config.password },
      })
    );
  });

  it('proxies GET request and returns status + headers + body as text', async () => {
    const client = makeInstance();
    const rawBody = Buffer.from('hello nextcloud');
    mockRequest.mockResolvedValue({
      status: 200,
      data: rawBody,
      headers: { 'content-type': 'text/plain' },
    });

    const result = await client.request('GET', '/remote.php/dav/files/alice/test.txt');

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: '/remote.php/dav/files/alice/test.txt' })
    );
    expect(result.status).toBe(200);
    expect(result.body).toBe('hello nextcloud');
    expect(result.headers['content-type']).toBe('text/plain');
  });

  it('returns body as base64 when response_encoding is "base64"', async () => {
    const client = makeInstance();
    const rawBody = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    mockRequest.mockResolvedValue({ status: 200, data: rawBody, headers: {} });

    const result = await client.request('GET', '/remote.php/dav/files/alice/img.png', undefined, undefined, 'base64');

    expect(result.body).toBe(rawBody.toString('base64'));
  });

  it('passes method, body and extra headers through', async () => {
    const client = makeInstance();
    mockRequest.mockResolvedValue({ status: 201, data: Buffer.from(''), headers: {} });

    await client.request('PUT', '/remote.php/dav/files/alice/doc.txt', 'file content', {
      'Content-Type': 'text/plain',
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        data: 'file content',
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  });

  it('normalises method to upper-case', async () => {
    const client = makeInstance();
    mockRequest.mockResolvedValue({ status: 207, data: Buffer.from('<xml/>'), headers: {} });

    await client.request('propfind' as 'GET', '/remote.php/dav/files/alice/');

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'PROPFIND' }));
  });

  it('passes non-2xx status back to caller instead of throwing', async () => {
    const client = makeInstance();
    mockRequest.mockResolvedValue({ status: 404, data: Buffer.from('Not Found'), headers: {} });

    const result = await client.request('GET', '/remote.php/dav/files/alice/missing.txt');

    expect(result.status).toBe(404);
    expect(result.body).toBe('Not Found');
  });

  it('throws a descriptive error on network failure', async () => {
    const client = makeInstance();
    const networkError = Object.assign(new Error('Network Error'), { isAxiosError: true });
    mockRequest.mockRejectedValue(networkError);

    await expect(
      client.request('GET', '/remote.php/dav/files/alice/file.txt')
    ).rejects.toThrow();
  });
});
