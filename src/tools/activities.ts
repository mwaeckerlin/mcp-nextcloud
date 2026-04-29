import { z } from "zod";
import { NextcloudClient } from "../nextcloud-client.js";

export const activityTools = [
  {
    name: "nextcloud_get_activities",
    description: "Get recent activity feed from Nextcloud",
    inputSchema: {
      type: "object" as const,
      properties: {
        objectType: {
          type: "string",
          description:
            "Filter by object type (e.g. 'files', 'comments', 'calendar'). Leave empty for all activity.",
        },
        objectId: {
          type: "number",
          description: "Filter by specific object ID",
        },
        since: {
          type: "number",
          description: "Activity ID to fetch newer activities since",
        },
        limit: {
          type: "number",
          description: "Maximum number of activities to return (default: 50)",
        },
      },
    },
  },
  {
    name: "nextcloud_get_server_info",
    description: "Get Nextcloud server information and capabilities",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "nextcloud_check_health",
    description: "Check if the Nextcloud server is reachable and healthy",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

const GetActivitiesSchema = z.object({
  objectType: z.string().optional(),
  objectId: z.number().int().optional(),
  since: z.number().int().optional(),
  limit: z.number().int().positive().optional(),
});

type ToolResponse = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export async function handleActivityTool(
  client: NextcloudClient,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  switch (name) {
    case "nextcloud_get_activities": {
      const { objectType, objectId, since, limit } = GetActivitiesSchema.parse(args);
      const activities = await client.getActivities(objectType, objectId, since, limit);
      return { content: [{ type: "text", text: JSON.stringify(activities, null, 2) }] };
    }

    case "nextcloud_get_server_info": {
      const info = await client.getServerInfo();
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    }

    case "nextcloud_check_health": {
      const health = await client.checkHealth();
      return { content: [{ type: "text", text: JSON.stringify(health, null, 2) }] };
    }

    default:
      return { content: [{ type: "text", text: `Unknown activity tool: ${name}` }], isError: true };
  }
}
