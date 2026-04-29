import { z } from "zod";
import { NextcloudClient } from "../nextcloud-client.js";

// Share type constants matching Nextcloud OCS API
export const SHARE_TYPE_USER = 0;
export const SHARE_TYPE_GROUP = 1;
export const SHARE_TYPE_PUBLIC_LINK = 3;
export const SHARE_TYPE_EMAIL = 4;
export const SHARE_TYPE_FEDERATED = 6;
export const SHARE_TYPE_CIRCLE = 7;
export const SHARE_TYPE_TALK = 10;

export const shareTools = [
  {
    name: "nextcloud_list_shares",
    description: "List existing shares, optionally filtered by path",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Optional: filter shares by file/directory path",
        },
      },
    },
  },
  {
    name: "nextcloud_create_share",
    description:
      "Create a new share for a file or directory. Share types: 0=user, 1=group, 3=public link, 4=email, 6=federated",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the file or directory to share",
        },
        shareType: {
          type: "number",
          description: "Share type (0=user, 1=group, 3=public link, 4=email, 6=federated)",
        },
        shareWith: {
          type: "string",
          description: "User, group, or email to share with (not required for public links)",
        },
        permissions: {
          type: "number",
          description: "Permission bitmask: 1=read, 2=update, 4=create, 8=delete, 16=share (default: 1)",
        },
        expireDate: {
          type: "string",
          description: "Expiration date in YYYY-MM-DD format",
        },
        note: {
          type: "string",
          description: "Note/message for the share recipient",
        },
      },
      required: ["path", "shareType"],
    },
  },
  {
    name: "nextcloud_get_share",
    description: "Get details of a specific share by ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        shareId: {
          type: "string",
          description: "Share ID",
        },
      },
      required: ["shareId"],
    },
  },
  {
    name: "nextcloud_delete_share",
    description: "Delete/revoke a share by ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        shareId: {
          type: "string",
          description: "Share ID to delete",
        },
      },
      required: ["shareId"],
    },
  },
  {
    name: "nextcloud_update_share",
    description: "Update an existing share's permissions, expiry, or note",
    inputSchema: {
      type: "object" as const,
      properties: {
        shareId: {
          type: "string",
          description: "Share ID to update",
        },
        permissions: {
          type: "number",
          description: "New permission bitmask",
        },
        expireDate: {
          type: "string",
          description: "New expiry date (YYYY-MM-DD) or empty string to remove",
        },
        note: {
          type: "string",
          description: "New note for the share",
        },
        password: {
          type: "string",
          description: "New password for public link shares",
        },
      },
      required: ["shareId"],
    },
  },
];

const ListSharesSchema = z.object({ path: z.string().optional() });
const CreateShareSchema = z.object({
  path: z.string().min(1),
  shareType: z.number().int(),
  shareWith: z.string().optional(),
  permissions: z.number().int().optional(),
  expireDate: z.string().optional(),
  note: z.string().optional(),
});
const GetShareSchema = z.object({ shareId: z.string().min(1) });
const DeleteShareSchema = z.object({ shareId: z.string().min(1) });
const UpdateShareSchema = z.object({
  shareId: z.string().min(1),
  permissions: z.number().int().optional(),
  expireDate: z.string().optional(),
  note: z.string().optional(),
  password: z.string().optional(),
});

type ToolResponse = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export async function handleShareTool(
  client: NextcloudClient,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  switch (name) {
    case "nextcloud_list_shares": {
      const { path } = ListSharesSchema.parse(args);
      const shares = await client.listShares(path);
      return { content: [{ type: "text", text: JSON.stringify(shares, null, 2) }] };
    }

    case "nextcloud_create_share": {
      const { path, shareType, shareWith, permissions, expireDate, note } =
        CreateShareSchema.parse(args);
      const share = await client.createShare(path, shareType, shareWith, permissions, expireDate, note);
      return { content: [{ type: "text", text: JSON.stringify(share, null, 2) }] };
    }

    case "nextcloud_get_share": {
      const { shareId } = GetShareSchema.parse(args);
      const share = await client.getShare(shareId);
      return { content: [{ type: "text", text: JSON.stringify(share, null, 2) }] };
    }

    case "nextcloud_delete_share": {
      const { shareId } = DeleteShareSchema.parse(args);
      await client.deleteShare(shareId);
      return { content: [{ type: "text", text: `Share ${shareId} deleted successfully` }] };
    }

    case "nextcloud_update_share": {
      const { shareId, ...updates } = UpdateShareSchema.parse(args);
      const share = await client.updateShare(shareId, updates);
      return { content: [{ type: "text", text: JSON.stringify(share, null, 2) }] };
    }

    default:
      return { content: [{ type: "text", text: `Unknown share tool: ${name}` }], isError: true };
  }
}
