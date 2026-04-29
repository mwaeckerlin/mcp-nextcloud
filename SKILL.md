# SKILL — mcp-nextcloud

## What this server does

`mcp-nextcloud` is a **transparent authentication proxy** for Nextcloud.  
It holds the Nextcloud credentials server-side and exposes a single generic tool that lets you call any Nextcloud API without knowing those credentials.

## Discover the server configuration

Always start by reading the `nextcloud://info` resource.  
It gives you the **base URL** and the **authenticated username** — the two values you need to build every request path.

```
resource: nextcloud://info
```

## The one tool: `nextcloud_request`

```
tool: nextcloud_request
```

| Parameter | Description |
|---|---|
| `method` | HTTP method (GET, POST, PUT, DELETE, PROPFIND, MKCOL, MOVE, COPY, REPORT, …) |
| `path` | Path relative to the Nextcloud base URL |
| `body` | Optional request body |
| `headers` | Optional extra headers (JSON object) |
| `response_encoding` | `"text"` (default) or `"base64"` for binary files |

## API cheat-sheet

### Files (WebDAV)

| Action | method | path | headers/body |
|---|---|---|---|
| List directory | `PROPFIND` | `/remote.php/dav/files/<user>/<dir>/` | `Depth: 1` |
| Download file | `GET` | `/remote.php/dav/files/<user>/<file>` | — |
| Upload file | `PUT` | `/remote.php/dav/files/<user>/<file>` | body = file content |
| Delete | `DELETE` | `/remote.php/dav/files/<user>/<path>` | — |
| Create folder | `MKCOL` | `/remote.php/dav/files/<user>/<dir>/` | — |
| Move / rename | `MOVE` | `/remote.php/dav/files/<user>/<src>` | `Destination: <full-url-to-dest>` |
| Copy | `COPY` | `/remote.php/dav/files/<user>/<src>` | `Destination: <full-url-to-dest>` |

### Shares (OCS)

| Action | method | path | notes |
|---|---|---|---|
| List shares | `GET` | `/ocs/v2.php/apps/files_sharing/api/v1/shares` | `?format=json&path=<path>` |
| Create share | `POST` | `/ocs/v2.php/apps/files_sharing/api/v1/shares` | body: shareType, shareWith, path, permissions |
| Delete share | `DELETE` | `/ocs/v2.php/apps/files_sharing/api/v1/shares/<id>` | — |

Always include headers `OCS-APIREQUEST: true` and query param `format=json` for OCS calls.

### Users & groups (OCS)

| Action | method | path |
|---|---|---|
| List users | `GET` | `/ocs/v2.php/cloud/users?format=json` |
| Get user | `GET` | `/ocs/v2.php/cloud/users/<username>?format=json` |
| Create user | `POST` | `/ocs/v2.php/cloud/users` |
| List groups | `GET` | `/ocs/v2.php/cloud/groups?format=json` |

### Calendar (CalDAV)

| Action | method | path |
|---|---|---|
| List calendars | `PROPFIND` | `/remote.php/dav/calendars/<user>/` |
| List events | `PROPFIND` | `/remote.php/dav/calendars/<user>/<calendar>/` |
| Get event | `GET` | `/remote.php/dav/calendars/<user>/<calendar>/<uid>.ics` |
| Create event | `PUT` | `/remote.php/dav/calendars/<user>/<calendar>/<uid>.ics` |
| Delete event | `DELETE` | `/remote.php/dav/calendars/<user>/<calendar>/<uid>.ics` |

### Contacts (CardDAV)

| Action | method | path |
|---|---|---|
| List address books | `PROPFIND` | `/remote.php/dav/addressbooks/users/<user>/` |
| List contacts | `PROPFIND` | `/remote.php/dav/addressbooks/users/<user>/<book>/` |
| Get contact | `GET` | `/remote.php/dav/addressbooks/users/<user>/<book>/<uid>.vcf` |
| Create contact | `PUT` | `/remote.php/dav/addressbooks/users/<user>/<book>/<uid>.vcf` |
| Delete contact | `DELETE` | `/remote.php/dav/addressbooks/users/<user>/<book>/<uid>.vcf` |

### Apps (OCS)

| Action | method | path |
|---|---|---|
| List enabled apps | `GET` | `/ocs/v2.php/cloud/apps?filter=enabled&format=json` |
| Enable app | `POST` | `/ocs/v2.php/cloud/apps/<app>` |
| Disable app | `DELETE` | `/ocs/v2.php/cloud/apps/<app>` |

## Example prompts

- "List all files in my Documents folder"
- "Upload the text 'Hello world' to /Notes/hello.txt"
- "Show me all events in my personal calendar for next week"
- "Create a public share link for /Reports/Q1.pdf"
- "List all users in the Nextcloud instance"
- "Add a new contact Alice Smith with email alice@example.com to my address book"
