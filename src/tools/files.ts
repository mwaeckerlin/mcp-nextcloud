import { z } from "zod";
import { NextcloudClient } from "../nextcloud-client.js";

export const fileTools = [
  {
    name: "nextcloud_list_files",
    description: "List files and directories at a given path in Nextcloud",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to list (default: '/'). Example: '/Documents'",
          default: "/",
        },
      },
    },
  },
  {
    name: "nextcloud_get_file",
    description: "Get the content of a file from Nextcloud",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Full path to the file. Example: '/Documents/report.txt'",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "nextcloud_upload_file",
    description: "Upload or update a file in Nextcloud",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Full destination path. Example: '/Documents/notes.txt'",
        },
        content: {
          type: "string",
          description: "File content to write",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "nextcloud_delete_file",
    description: "Delete a file or directory from Nextcloud",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Full path to the file or directory to delete",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "nextcloud_move_file",
    description: "Move or rename a file or directory in Nextcloud",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Source path",
        },
        to: {
          type: "string",
          description: "Destination path",
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "nextcloud_copy_file",
    description: "Copy a file or directory in Nextcloud",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Source path",
        },
        to: {
          type: "string",
          description: "Destination path",
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "nextcloud_create_directory",
    description: "Create a new directory in Nextcloud",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path of the directory to create. Example: '/Documents/NewFolder'",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "nextcloud_search_files",
    description: "Search for files by name in Nextcloud",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term to find in file/directory names",
        },
      },
      required: ["query"],
    },
  },
];

const ListFilesSchema = z.object({ path: z.string().default("/") });
const GetFileSchema = z.object({ path: z.string().min(1) });
const UploadFileSchema = z.object({ path: z.string().min(1), content: z.string() });
const DeleteFileSchema = z.object({ path: z.string().min(1) });
const MoveFileSchema = z.object({ from: z.string().min(1), to: z.string().min(1) });
const CopyFileSchema = z.object({ from: z.string().min(1), to: z.string().min(1) });
const CreateDirectorySchema = z.object({ path: z.string().min(1) });
const SearchFilesSchema = z.object({ query: z.string().min(1) });

type ToolResponse = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export async function handleFileTool(
  client: NextcloudClient,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  switch (name) {
    case "nextcloud_list_files": {
      const { path } = ListFilesSchema.parse(args);
      const files = await client.listFiles(path);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(files, null, 2),
          },
        ],
      };
    }

    case "nextcloud_get_file": {
      const { path } = GetFileSchema.parse(args);
      const content = await client.getFileContent(path);
      return { content: [{ type: "text", text: content }] };
    }

    case "nextcloud_upload_file": {
      const { path, content } = UploadFileSchema.parse(args);
      await client.uploadFile(path, content);
      return { content: [{ type: "text", text: `File uploaded successfully: ${path}` }] };
    }

    case "nextcloud_delete_file": {
      const { path } = DeleteFileSchema.parse(args);
      await client.deleteFile(path);
      return { content: [{ type: "text", text: `Deleted: ${path}` }] };
    }

    case "nextcloud_move_file": {
      const { from, to } = MoveFileSchema.parse(args);
      await client.moveFile(from, to);
      return { content: [{ type: "text", text: `Moved: ${from} → ${to}` }] };
    }

    case "nextcloud_copy_file": {
      const { from, to } = CopyFileSchema.parse(args);
      await client.copyFile(from, to);
      return { content: [{ type: "text", text: `Copied: ${from} → ${to}` }] };
    }

    case "nextcloud_create_directory": {
      const { path } = CreateDirectorySchema.parse(args);
      await client.createDirectory(path);
      return { content: [{ type: "text", text: `Directory created: ${path}` }] };
    }

    case "nextcloud_search_files": {
      const { query } = SearchFilesSchema.parse(args);
      const files = await client.searchFiles(query);
      return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
    }

    default:
      return { content: [{ type: "text", text: `Unknown file tool: ${name}` }], isError: true };
  }
}
