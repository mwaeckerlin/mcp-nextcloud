# MCP Nextcloud

MCP server for Nextcloud API integration — a transparent authentication proxy that lets AI clients call any Nextcloud API without ever knowing the Nextcloud credentials.

## How it works

```
AI client  ──(tool call)──▶  mcp-nextcloud  ──(+ Basic Auth)──▶  Nextcloud
                                  ▲
                     credentials stored here only
```

The server exposes a single tool, `nextcloud_request`, plus a read-only resource `nextcloud://info` (base URL + username).  
The caller builds the path and payload; the server injects the Nextcloud credentials and forwards the request 1:1.

## Quick start

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXTCLOUD_URL` | ✅ | Your Nextcloud base URL, e.g. `https://cloud.example.com` |
| `NEXTCLOUD_USERNAME` | ✅ | Nextcloud username |
| `NEXTCLOUD_PASSWORD` | ✅ | Nextcloud password or [App Password](#authentication) |

### Run with Node.js

```bash
npm install
npm run build
NEXTCLOUD_URL=https://cloud.example.com \
NEXTCLOUD_USERNAME=alice \
NEXTCLOUD_PASSWORD=xxxx-xxxx-xxxx-xxxx \
node dist/index.js
```

### Run with Docker

```bash
docker build -t mcp-nextcloud .
docker run --rm \
  -e NEXTCLOUD_URL=https://cloud.example.com \
  -e NEXTCLOUD_USERNAME=alice \
  -e NEXTCLOUD_PASSWORD=xxxx-xxxx-xxxx-xxxx \
  mcp-nextcloud
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "nextcloud": {
      "command": "node",
      "args": ["/path/to/mcp-nextcloud/dist/index.js"],
      "env": {
        "NEXTCLOUD_URL": "https://cloud.example.com",
        "NEXTCLOUD_USERNAME": "alice",
        "NEXTCLOUD_PASSWORD": "xxxx-xxxx-xxxx-xxxx"
      }
    }
  }
}
```

## Authentication

Nextcloud App Passwords are recommended over your main password.

1. Log in to Nextcloud → **Settings → Security → App passwords**
2. Enter a name (e.g. `mcp-agent`) and click **Generate new app password**
3. Copy the generated token and use it as `NEXTCLOUD_PASSWORD`

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

## Resource

### `nextcloud://info`

Returns the Nextcloud base URL, the authenticated username, and a cheat-sheet of common path prefixes — **no credentials**.

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
npm run lint    # TypeScript type-check
npm test        # Unit tests
npm run build   # Compile to dist/
```

