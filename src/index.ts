#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getConfig } from './config.js';
import { createClient } from './nextcloud-client.js';

async function main() {
  const config = getConfig();
  const client = createClient(config);

  const server = new McpServer({
    name: 'mcp-nextcloud',
    version: '1.0.0',
  });

  // Expose the Nextcloud base URL and username so the AI can build correct paths.
  // The password/token is never exposed.
  server.resource(
    'nextcloud_info',
    'nextcloud://info',
    async () => ({
      contents: [
        {
          uri: 'nextcloud://info',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              base_url: client.baseUrl,
              username: client.username,
              description: [
                'Use these values to build Nextcloud API paths:',
                `  WebDAV files:   /remote.php/dav/files/${client.username}/<path>`,
                `  CalDAV:         /remote.php/dav/calendars/${client.username}/<calendar>/`,
                `  CardDAV:        /remote.php/dav/addressbooks/users/${client.username}/<book>/`,
                '  OCS API:        /ocs/v2.php/<endpoint>  (add ?format=json&OCS-APIREQUEST=true)',
              ].join('\n'),
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // Single pass-through tool — adds auth, forwards everything else 1:1.
  server.tool(
    'nextcloud_request',
    `Make an authenticated HTTP request to the Nextcloud server and return the response.
All Nextcloud credentials are kept server-side; the caller only provides the path and payload.

Common path prefixes (base_url is in the nextcloud_info resource):
  /remote.php/dav/files/<username>/      — WebDAV file operations
  /remote.php/dav/calendars/<username>/  — CalDAV calendar operations
  /remote.php/dav/addressbooks/users/<username>/ — CardDAV contacts
  /ocs/v2.php/                           — OCS REST API (users, apps, shares, …)

For OCS calls add query string:  ?format=json  and header  OCS-APIREQUEST: true
WebDAV directory listings need method PROPFIND and header  Depth: 1`,
    {
      method: z
        .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'PROPFIND', 'MKCOL', 'MOVE', 'COPY', 'REPORT', 'HEAD', 'OPTIONS'])
        .describe('HTTP method'),
      path: z
        .string()
        .describe('Request path relative to the Nextcloud base URL, e.g. "/remote.php/dav/files/alice/Documents/"'),
      body: z
        .string()
        .optional()
        .describe('Request body (text, XML, JSON, iCal, vCard, …)'),
      headers: z
        .record(z.string())
        .optional()
        .describe('Additional HTTP headers (key/value pairs)'),
      response_encoding: z
        .enum(['text', 'base64'])
        .optional()
        .default('text')
        .describe('Encoding for the response body. Use "base64" for binary files.'),
    },
    async ({ method, path, body, headers, response_encoding }) => {
      try {
        const result = await client.request(method, path, body, headers, response_encoding);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
