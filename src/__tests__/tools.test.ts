import { NextcloudClient } from "../nextcloud-client";
import { handleFileTool, fileTools } from "../tools/files";
import { handleShareTool, shareTools } from "../tools/sharing";
import { handleUserTool, userTools } from "../tools/users";
import { handleActivityTool, activityTools } from "../tools/activities";

// Create a mock client
function makeMockClient(): jest.Mocked<NextcloudClient> {
  return {
    listFiles: jest.fn(),
    getFileContent: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    moveFile: jest.fn(),
    copyFile: jest.fn(),
    createDirectory: jest.fn(),
    searchFiles: jest.fn(),
    listShares: jest.fn(),
    createShare: jest.fn(),
    getShare: jest.fn(),
    deleteShare: jest.fn(),
    updateShare: jest.fn(),
    listUsers: jest.fn(),
    getUser: jest.fn(),
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    enableUser: jest.fn(),
    disableUser: jest.fn(),
    getUserGroups: jest.fn(),
    getCurrentUser: jest.fn(),
    getActivities: jest.fn(),
    getServerInfo: jest.fn(),
    checkHealth: jest.fn(),
  } as unknown as jest.Mocked<NextcloudClient>;
}

describe("File Tools", () => {
  let client: jest.Mocked<NextcloudClient>;

  beforeEach(() => {
    client = makeMockClient();
  });

  it("defines correct tool names", () => {
    const names = fileTools.map((t) => t.name);
    expect(names).toContain("nextcloud_list_files");
    expect(names).toContain("nextcloud_get_file");
    expect(names).toContain("nextcloud_upload_file");
    expect(names).toContain("nextcloud_delete_file");
    expect(names).toContain("nextcloud_move_file");
    expect(names).toContain("nextcloud_copy_file");
    expect(names).toContain("nextcloud_create_directory");
    expect(names).toContain("nextcloud_search_files");
  });

  it("nextcloud_list_files calls client.listFiles", async () => {
    const mockFiles = [{ filename: "/Documents", basename: "Documents", type: "directory" }];
    client.listFiles.mockResolvedValueOnce(mockFiles as never);

    const result = await handleFileTool(client, "nextcloud_list_files", { path: "/" });
    expect(client.listFiles).toHaveBeenCalledWith("/");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Documents");
  });

  it("nextcloud_list_files uses default path '/'", async () => {
    client.listFiles.mockResolvedValueOnce([]);
    await handleFileTool(client, "nextcloud_list_files", {});
    expect(client.listFiles).toHaveBeenCalledWith("/");
  });

  it("nextcloud_get_file returns file content", async () => {
    client.getFileContent.mockResolvedValueOnce("hello world");
    const result = await handleFileTool(client, "nextcloud_get_file", { path: "/test.txt" });
    expect(result.content[0].text).toBe("hello world");
  });

  it("nextcloud_get_file requires path", async () => {
    await expect(handleFileTool(client, "nextcloud_get_file", {})).rejects.toThrow();
  });

  it("nextcloud_upload_file uploads content", async () => {
    client.uploadFile.mockResolvedValueOnce(undefined);
    const result = await handleFileTool(client, "nextcloud_upload_file", {
      path: "/test.txt",
      content: "test content",
    });
    expect(client.uploadFile).toHaveBeenCalledWith("/test.txt", "test content");
    expect(result.content[0].text).toContain("uploaded successfully");
  });

  it("nextcloud_delete_file deletes file", async () => {
    client.deleteFile.mockResolvedValueOnce(undefined);
    const result = await handleFileTool(client, "nextcloud_delete_file", { path: "/old.txt" });
    expect(result.content[0].text).toContain("Deleted");
  });

  it("nextcloud_move_file moves file", async () => {
    client.moveFile.mockResolvedValueOnce(undefined);
    const result = await handleFileTool(client, "nextcloud_move_file", {
      from: "/a.txt",
      to: "/b.txt",
    });
    expect(client.moveFile).toHaveBeenCalledWith("/a.txt", "/b.txt");
    expect(result.content[0].text).toContain("Moved");
  });

  it("nextcloud_copy_file copies file", async () => {
    client.copyFile.mockResolvedValueOnce(undefined);
    const result = await handleFileTool(client, "nextcloud_copy_file", {
      from: "/original.txt",
      to: "/copy.txt",
    });
    expect(result.content[0].text).toContain("Copied");
  });

  it("nextcloud_create_directory creates directory", async () => {
    client.createDirectory.mockResolvedValueOnce(undefined);
    const result = await handleFileTool(client, "nextcloud_create_directory", {
      path: "/NewDir",
    });
    expect(result.content[0].text).toContain("Directory created");
  });

  it("nextcloud_search_files returns results", async () => {
    client.searchFiles.mockResolvedValueOnce([]);
    const result = await handleFileTool(client, "nextcloud_search_files", { query: "test" });
    expect(client.searchFiles).toHaveBeenCalledWith("test");
    expect(result.isError).toBeUndefined();
  });

  it("returns error for unknown tool", async () => {
    const result = await handleFileTool(client, "unknown_tool", {});
    expect(result.isError).toBe(true);
  });
});

describe("Share Tools", () => {
  let client: jest.Mocked<NextcloudClient>;

  beforeEach(() => {
    client = makeMockClient();
  });

  it("defines correct tool names", () => {
    const names = shareTools.map((t) => t.name);
    expect(names).toContain("nextcloud_list_shares");
    expect(names).toContain("nextcloud_create_share");
    expect(names).toContain("nextcloud_get_share");
    expect(names).toContain("nextcloud_delete_share");
    expect(names).toContain("nextcloud_update_share");
  });

  it("nextcloud_list_shares lists shares", async () => {
    client.listShares.mockResolvedValueOnce([]);
    const result = await handleShareTool(client, "nextcloud_list_shares", {});
    expect(client.listShares).toHaveBeenCalledWith(undefined);
    expect(result.isError).toBeUndefined();
  });

  it("nextcloud_create_share creates public link", async () => {
    const mockShare = { id: "1", shareType: 3, path: "/test", permissions: 1 };
    client.createShare.mockResolvedValueOnce(mockShare as never);
    const result = await handleShareTool(client, "nextcloud_create_share", {
      path: "/test",
      shareType: 3,
    });
    expect(client.createShare).toHaveBeenCalledWith("/test", 3, undefined, undefined, undefined, undefined);
    expect(result.content[0].text).toContain('"id": "1"');
  });

  it("nextcloud_delete_share deletes share", async () => {
    client.deleteShare.mockResolvedValueOnce(undefined);
    const result = await handleShareTool(client, "nextcloud_delete_share", { shareId: "42" });
    expect(result.content[0].text).toContain("deleted successfully");
  });
});

describe("User Tools", () => {
  let client: jest.Mocked<NextcloudClient>;

  beforeEach(() => {
    client = makeMockClient();
  });

  it("defines correct tool names", () => {
    const names = userTools.map((t) => t.name);
    expect(names).toContain("nextcloud_list_users");
    expect(names).toContain("nextcloud_get_user");
    expect(names).toContain("nextcloud_create_user");
    expect(names).toContain("nextcloud_delete_user");
    expect(names).toContain("nextcloud_enable_user");
    expect(names).toContain("nextcloud_disable_user");
    expect(names).toContain("nextcloud_get_user_groups");
    expect(names).toContain("nextcloud_get_current_user");
  });

  it("nextcloud_list_users lists users", async () => {
    client.listUsers.mockResolvedValueOnce(["admin", "alice"]);
    const result = await handleUserTool(client, "nextcloud_list_users", {});
    expect(JSON.parse(result.content[0].text)).toEqual(["admin", "alice"]);
  });

  it("nextcloud_get_user returns user info", async () => {
    const mockUser = { id: "alice", displayname: "Alice", enabled: true };
    client.getUser.mockResolvedValueOnce(mockUser as never);
    const result = await handleUserTool(client, "nextcloud_get_user", { userId: "alice" });
    expect(JSON.parse(result.content[0].text)).toEqual(mockUser);
  });

  it("nextcloud_create_user creates user", async () => {
    client.createUser.mockResolvedValueOnce(undefined);
    const result = await handleUserTool(client, "nextcloud_create_user", {
      userId: "newuser",
      password: "secret123",
    });
    expect(result.content[0].text).toContain("created successfully");
  });

  it("nextcloud_create_user validates email format", async () => {
    await expect(
      handleUserTool(client, "nextcloud_create_user", {
        userId: "newuser",
        password: "secret123",
        email: "invalid-email",
      })
    ).rejects.toThrow();
  });

  it("nextcloud_delete_user deletes user", async () => {
    client.deleteUser.mockResolvedValueOnce(undefined);
    const result = await handleUserTool(client, "nextcloud_delete_user", { userId: "alice" });
    expect(result.content[0].text).toContain("deleted successfully");
  });

  it("nextcloud_get_current_user returns current user info", async () => {
    const mockUser = { id: "admin", displayname: "Admin", enabled: true };
    client.getCurrentUser.mockResolvedValueOnce("admin");
    client.getUser.mockResolvedValueOnce(mockUser as never);
    const result = await handleUserTool(client, "nextcloud_get_current_user", {});
    expect(JSON.parse(result.content[0].text)).toEqual(mockUser);
  });
});

describe("Activity Tools", () => {
  let client: jest.Mocked<NextcloudClient>;

  beforeEach(() => {
    client = makeMockClient();
  });

  it("defines correct tool names", () => {
    const names = activityTools.map((t) => t.name);
    expect(names).toContain("nextcloud_get_activities");
    expect(names).toContain("nextcloud_get_server_info");
    expect(names).toContain("nextcloud_check_health");
  });

  it("nextcloud_get_activities returns activities", async () => {
    const mockActivities = [{ activityId: 1, subject: "File uploaded", user: "admin" }];
    client.getActivities.mockResolvedValueOnce(mockActivities as never);
    const result = await handleActivityTool(client, "nextcloud_get_activities", { limit: 10 });
    expect(client.getActivities).toHaveBeenCalledWith(undefined, undefined, undefined, 10);
    expect(JSON.parse(result.content[0].text)).toEqual(mockActivities);
  });

  it("nextcloud_check_health returns health status", async () => {
    client.checkHealth.mockResolvedValueOnce({ status: "ok", version: "28.0.0" });
    const result = await handleActivityTool(client, "nextcloud_check_health", {});
    const health = JSON.parse(result.content[0].text);
    expect(health.status).toBe("ok");
    expect(health.version).toBe("28.0.0");
  });

  it("nextcloud_get_server_info returns server info", async () => {
    client.getServerInfo.mockResolvedValueOnce({ version: "28.0.0" });
    const result = await handleActivityTool(client, "nextcloud_get_server_info", {});
    expect(JSON.parse(result.content[0].text)).toEqual({ version: "28.0.0" });
  });
});
