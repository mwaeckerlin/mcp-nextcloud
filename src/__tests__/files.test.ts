import { jest } from '@jest/globals';
import { NextcloudClient } from '../nextcloud-client.js';
import { filesTools } from '../tools/files.js';

const config = {
  url: 'https://nextcloud.example.com',
  username: 'testuser',
  password: 'testpass',
};

describe('files_list', () => {
  let client: NextcloudClient;

  beforeEach(() => {
    client = new NextcloudClient(config);
    jest.restoreAllMocks();
  });

  it('parses WebDAV XML response correctly', async () => {
    const xmlResponse = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:response>
    <d:href>/remote.php/dav/files/testuser/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/testuser/Documents/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>Documents</d:displayname>
        <d:getlastmodified>Mon, 01 Jan 2024 00:00:00 GMT</d:getlastmodified>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/testuser/test.txt</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>test.txt</d:displayname>
        <d:getcontentlength>100</d:getcontentlength>
        <d:getcontenttype>text/plain</d:getcontenttype>
        <d:getlastmodified>Mon, 01 Jan 2024 00:00:00 GMT</d:getlastmodified>
        <d:resourcetype/>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

    jest.spyOn(client, 'webdavRequest').mockResolvedValueOnce({
      data: xmlResponse,
      status: 207,
      headers: { 'content-type': 'application/xml' },
    });

    const tool = filesTools.find(t => t.name === 'files_list')!;
    const result = await tool.handler(client, { path: '/' } as never) as Array<{ name: string; isDirectory: boolean }>;

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    const docDir = result.find(r => r.name === 'Documents');
    expect(docDir).toBeDefined();
    expect(docDir?.isDirectory).toBe(true);
    const txtFile = result.find(r => r.name === 'test.txt');
    expect(txtFile).toBeDefined();
    expect(txtFile?.isDirectory).toBe(false);
  });
});

describe('files_upload', () => {
  let client: NextcloudClient;

  beforeEach(() => {
    client = new NextcloudClient(config);
    jest.restoreAllMocks();
  });

  it('sends correct PUT request', async () => {
    const spy = jest.spyOn(client, 'webdavRequest').mockResolvedValueOnce({
      data: '',
      status: 201,
      headers: {},
    });

    const tool = filesTools.find(t => t.name === 'files_upload')!;
    const result = await tool.handler(client, {
      path: '/test.txt',
      content: 'Hello World',
      encoding: 'utf8',
    } as never) as { success: boolean };

    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      'PUT',
      '/test.txt',
      'Hello World',
      expect.objectContaining({ 'Content-Type': 'application/octet-stream' })
    );
  });
});

describe('files_delete', () => {
  let client: NextcloudClient;

  beforeEach(() => {
    client = new NextcloudClient(config);
    jest.restoreAllMocks();
  });

  it('sends correct DELETE request', async () => {
    const spy = jest.spyOn(client, 'webdavRequest').mockResolvedValueOnce({
      data: '',
      status: 204,
      headers: {},
    });

    const tool = filesTools.find(t => t.name === 'files_delete')!;
    const result = await tool.handler(client, { path: '/test.txt' } as never) as { success: boolean };

    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalledWith('DELETE', '/test.txt');
  });
});

describe('error handling', () => {
  let client: NextcloudClient;

  beforeEach(() => {
    client = new NextcloudClient(config);
    jest.restoreAllMocks();
  });

  it('throws error when server returns 404', async () => {
    jest.spyOn(client, 'webdavRequest').mockRejectedValueOnce(
      new Error('HTTP 404 Not Found: Not Found')
    );

    const tool = filesTools.find(t => t.name === 'files_get')!;
    await expect(tool.handler(client, { path: '/nonexistent.txt' } as never)).rejects.toThrow();
  });
});
