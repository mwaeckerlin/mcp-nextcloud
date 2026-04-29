# MCP Nextcloud

MCP server for Nextcloud API integration — a transparent authentication proxy that lets AI clients call any Nextcloud API without ever knowing the Nextcloud credentials.

## How it works

```
AI client  ──(tool call)──▶  mcp-nextcloud  ──(+ Basic Auth)──▶  Nextcloud
                                  ▲
                     credentials stored here only
```

The server exposes a single tool, `nextcloud_request`.
The caller builds the path and payload; the server injects the Nextcloud credentials and forwards the request 1:1.

## Quick start

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXTCLOUD_URL` | ✅ | Your Nextcloud base URL, e.g. `https://cloud.example.com` |
| `NEXTCLOUD_USERNAME` | ✅ | Nextcloud username |
| `NEXTCLOUD_TOKEN` | ✅ | Nextcloud [App Password](#authentication) token |
| `MCP_NEXTCLOUD_HOST` | — | Listen host (default `127.0.0.1`) |
| `MCP_NEXTCLOUD_PORT` | — | Listen port (default `4000`) |
| `MCP_AUTH_TOKEN` | — | Bearer token required by MCP clients (optional) |

### Run with Docker Compose

```bash
NEXTCLOUD_URL=https://cloud.example.com \
NEXTCLOUD_USERNAME=alice \
NEXTCLOUD_TOKEN=xxxx-xxxx-xxxx-xxxx \
docker compose up --build
```

### Run with Node.js

```bash
npm install
npm run build
NEXTCLOUD_URL=https://cloud.example.com \
NEXTCLOUD_USERNAME=alice \
NEXTCLOUD_TOKEN=xxxx-xxxx-xxxx-xxxx \
node dist/server.js
```

### Run with Docker

```bash
docker build -t mcp-nextcloud .
docker run --rm \
  -e NEXTCLOUD_URL=https://cloud.example.com \
  -e NEXTCLOUD_USERNAME=alice \
  -e NEXTCLOUD_TOKEN=xxxx-xxxx-xxxx-xxxx \
  -p 4000:4000 \
  mcp-nextcloud
```

## Authentication

Nextcloud App Passwords are the recommended (and only supported) authentication method.

1. Log in to Nextcloud → **Settings → Security → App passwords**
2. Enter a name (e.g. `mcp-agent`) and click **Generate new app password**
3. Copy the generated token and use it as `NEXTCLOUD_TOKEN`

## Tool reference

### `nextcloud_request`

Make an authenticated HTTP request to Nextcloud and return the response.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `method` | string | ✅ | HTTP method: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `PROPFIND`, `MKCOL`, `MOVE`, `COPY`, `REPORT`, `HEAD`, `OPTIONS` |
| `path` | string | ✅ | Path relative to the Nextcloud base URL |
| `body` | string | — | Request body (XML, JSON, iCal, vCard, …) |
| `headers` | object | — | Additional request headers |
| `response_encoding` | `"text"` \| `"base64"` | — | Response body encoding (default `"text"`; use `"base64"` for binary files) |

**Returns** a JSON object:

```json
{
  "status": 207,
  "headers": { "content-type": "application/xml; charset=utf-8" },
  "body": "..."
}
```

## Common path prefixes

| API | Path prefix |
|---|---|
| WebDAV files | `/remote.php/dav/files/<username>/` |
| CalDAV | `/remote.php/dav/calendars/<username>/` |
| CardDAV | `/remote.php/dav/addressbooks/users/<username>/` |
| OCS REST | `/ocs/v2.php/` |

OCS calls require the query string `?format=json` and the header `OCS-APIREQUEST: true`.

## Development

```bash
npm install
npm test        # Unit tests
npm run build   # Compile to dist/
npm run dev     # Run directly with tsx (requires env vars)
```
