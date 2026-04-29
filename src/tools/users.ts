import { z } from "zod";
import { NextcloudClient } from "../nextcloud-client.js";

export const userTools = [
  {
    name: "nextcloud_list_users",
    description: "List users in the Nextcloud instance (admin required)",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description: "Optional search term to filter users",
        },
        limit: {
          type: "number",
          description: "Maximum number of users to return",
        },
        offset: {
          type: "number",
          description: "Offset for pagination",
        },
      },
    },
  },
  {
    name: "nextcloud_get_user",
    description: "Get detailed information about a specific user",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Username/user ID to retrieve",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "nextcloud_create_user",
    description: "Create a new user in Nextcloud (admin required)",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Username for the new user",
        },
        password: {
          type: "string",
          description: "Password for the new user",
        },
        displayName: {
          type: "string",
          description: "Display name for the user",
        },
        email: {
          type: "string",
          description: "Email address for the user",
        },
        groups: {
          type: "array",
          items: { type: "string" },
          description: "Groups to add the user to",
        },
      },
      required: ["userId", "password"],
    },
  },
  {
    name: "nextcloud_delete_user",
    description: "Delete a user from Nextcloud (admin required)",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Username to delete",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "nextcloud_enable_user",
    description: "Enable a disabled user account (admin required)",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Username to enable",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "nextcloud_disable_user",
    description: "Disable a user account (admin required)",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Username to disable",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "nextcloud_get_user_groups",
    description: "Get the groups a user belongs to",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "Username to get groups for",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "nextcloud_get_current_user",
    description: "Get information about the currently authenticated user",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

const ListUsersSchema = z.object({
  search: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
const UserIdSchema = z.object({ userId: z.string().min(1) });
const CreateUserSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(1),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  groups: z.array(z.string()).optional(),
});

type ToolResponse = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export async function handleUserTool(
  client: NextcloudClient,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  switch (name) {
    case "nextcloud_list_users": {
      const { search, limit, offset } = ListUsersSchema.parse(args);
      const users = await client.listUsers(search, limit, offset);
      return { content: [{ type: "text", text: JSON.stringify(users, null, 2) }] };
    }

    case "nextcloud_get_user": {
      const { userId } = UserIdSchema.parse(args);
      const user = await client.getUser(userId);
      return { content: [{ type: "text", text: JSON.stringify(user, null, 2) }] };
    }

    case "nextcloud_create_user": {
      const { userId, password, displayName, email, groups } = CreateUserSchema.parse(args);
      await client.createUser(userId, password, displayName, email, groups);
      return { content: [{ type: "text", text: `User '${userId}' created successfully` }] };
    }

    case "nextcloud_delete_user": {
      const { userId } = UserIdSchema.parse(args);
      await client.deleteUser(userId);
      return { content: [{ type: "text", text: `User '${userId}' deleted successfully` }] };
    }

    case "nextcloud_enable_user": {
      const { userId } = UserIdSchema.parse(args);
      await client.enableUser(userId);
      return { content: [{ type: "text", text: `User '${userId}' enabled` }] };
    }

    case "nextcloud_disable_user": {
      const { userId } = UserIdSchema.parse(args);
      await client.disableUser(userId);
      return { content: [{ type: "text", text: `User '${userId}' disabled` }] };
    }

    case "nextcloud_get_user_groups": {
      const { userId } = UserIdSchema.parse(args);
      const groups = await client.getUserGroups(userId);
      return { content: [{ type: "text", text: JSON.stringify(groups, null, 2) }] };
    }

    case "nextcloud_get_current_user": {
      const userId = await client.getCurrentUser();
      const user = await client.getUser(userId);
      return { content: [{ type: "text", text: JSON.stringify(user, null, 2) }] };
    }

    default:
      return { content: [{ type: "text", text: `Unknown user tool: ${name}` }], isError: true };
  }
}
