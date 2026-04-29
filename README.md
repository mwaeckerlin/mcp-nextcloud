# MCP Nextcloud

A TypeScript [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for secure Nextcloud API integration. Provides sandboxed AI agents with authenticated access to Nextcloud files, sharing, users, and activity — without ever exposing credentials to the agent.

## Features

- 📁 **File Operations** — list, read, upload, delete, move, copy, create directories, search
- 🔗 **Sharing** — create/list/update/delete shares (public links, user shares, group shares)
- 👥 **User Management** — list, get, create, delete, enable/disable users and their groups
- 📊 **Activity Feed** — fetch recent Nextcloud activity
- 🏥 **Health Check** — verify server reachability and capabilities
- 🔐 **Security** — credentials stored server-side only; never sent to AI agents

## Security Model

Credentials (`NEXTCLOUD_URL`, `NEXTCLOUD_TOKEN`) are held exclusively by the MCP server process. Agents interact only through validated MCP tool calls — they never see tokens or raw HTTP requests. This follows the same sandboxed-agent security model as [mcp-github](https://github.com/github/github-mcp-server).

## Prerequisites

- Node.js ≥ 18
- A Nextcloud instance with an [app password](https://docs.nextcloud.com/server/latest/user_manual/en/session_management.html#managing-devices)

## Installation

```bash
npm install -g @mwaeckerlin/mcp-nextcloud
```

Or run directly with `npx`:

```bash
npx @mwaeckerlin/mcp-nextcloud
```

## Configuration

Set the following environment variables before starting the server:

| Variable           | Description                                           | Required |
|--------------------|-------------------------------------------------------|----------|
| `NEXTCLOUD_URL`    | Full URL of your Nextcloud instance, e.g. `https://cloud.example.com` | ✅ |
| `NEXTCLOUD_TOKEN`  | App password generated in Nextcloud → Settings → Security → App passwords | ✅ |

### Generating an App Password

1. Log in to your Nextcloud instance
2. Navigate to **Settings → Personal → Security**
3. Under **App passwords**, enter a name and click **Create new app password**
4. Copy the generated password — it will only be shown once

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "nextcloud": {
      "command": "npx",
      "args": ["-y", "@mwaeckerlin/mcp-nextcloud"],
      "env": {
        "NEXTCLOUD_URL": "https://cloud.example.com",
        "NEXTCLOUD_TOKEN": "your-app-password-here"
      }
    }
  }
}
```

## Usage with VS Code (Copilot)

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "nextcloud": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@mwaeckerlin/mcp-nextcloud"],
      "env": {
        "NEXTCLOUD_URL": "https://cloud.example.com",
        "NEXTCLOUD_TOKEN": "your-app-password-here"
      }
    }
  }
}
```

## Available Tools

### File Operations

| Tool | Description |
|------|-------------|
| `nextcloud_list_files` | List files and directories at a given path |
| `nextcloud_get_file` | Get the content of a file |
| `nextcloud_upload_file` | Create or update a file with given content |
| `nextcloud_delete_file` | Delete a file or directory |
| `nextcloud_move_file` | Move or rename a file/directory |
| `nextcloud_copy_file` | Copy a file or directory |
| `nextcloud_create_directory` | Create a new directory |
| `nextcloud_search_files` | Search for files by name |

### Sharing

| Tool | Description |
|------|-------------|
| `nextcloud_list_shares` | List all shares, optionally filtered by path |
| `nextcloud_create_share` | Create a new share (user/group/public link/email/federated) |
| `nextcloud_get_share` | Get details of a specific share |
| `nextcloud_delete_share` | Revoke/delete a share |
| `nextcloud_update_share` | Update share permissions, expiry, note, or password |

**Share Types:**
- `0` — User share
- `1` — Group share
- `3` — Public link
- `4` — Email share
- `6` — Federated cloud share

**Permission Bitmask:**
- `1` — Read
- `2` — Update
- `4` — Create
- `8` — Delete
- `16` — Share (re-share)

### User Management (admin required)

| Tool | Description |
|------|-------------|
| `nextcloud_list_users` | List all users (supports search, limit, offset) |
| `nextcloud_get_user` | Get detailed info about a user |
| `nextcloud_get_current_user` | Get info about the authenticated user |
| `nextcloud_create_user` | Create a new user account |
| `nextcloud_delete_user` | Delete a user account |
| `nextcloud_enable_user` | Enable a disabled account |
| `nextcloud_disable_user` | Disable a user account |
| `nextcloud_get_user_groups` | List groups a user belongs to |

### Activity & Server

| Tool | Description |
|------|-------------|
| `nextcloud_get_activities` | Get recent activity feed |
| `nextcloud_get_server_info` | Get Nextcloud version and capabilities |
| `nextcloud_check_health` | Check server reachability |

## Example Prompts

Once configured, you can ask your AI assistant:

- *"List all files in my Documents folder"*
- *"Upload a file called 'notes.txt' with the content 'Meeting at 3pm'"*
- *"Create a public share link for /Reports/Q1.pdf that expires in 7 days"*
- *"Show me all users in my Nextcloud instance"*
- *"Search for all PDF files"*
- *"What's the recent activity on my Nextcloud?"*

## Development

### Setup

```bash
git clone https://github.com/mwaeckerlin/mcp-nextcloud.git
cd mcp-nextcloud
npm install
```

### Commands

```bash
npm run build      # Compile TypeScript
npm run typecheck  # Type-check without emitting
npm test           # Run tests
npm run test:coverage  # Run tests with coverage report
npm run dev        # Run with ts-node (requires env vars)
```

### Project Structure

```
src/
├── index.ts              # Entry point
├── server.ts             # MCP server setup, config validation
├── nextcloud-client.ts   # Nextcloud WebDAV & OCS API client
├── tools/
│   ├── files.ts          # File operation tools
│   ├── sharing.ts        # Share management tools
│   ├── users.ts          # User management tools
│   └── activities.ts     # Activity & health tools
└── __tests__/
    ├── nextcloud-client.test.ts
    ├── tools.test.ts
    └── server.test.ts
```

## Nextcloud API Reference

This server uses:
- **WebDAV API** (`/remote.php/dav/files/`) for file operations
- **OCS API v2** (`/ocs/v2.php`) for sharing, users, and activities

## License

MIT
