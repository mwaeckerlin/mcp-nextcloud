import axios from "axios";
import { NextcloudClient } from "../nextcloud-client";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_CONFIG = {
  url: "https://nextcloud.example.com",
  token: "test-token-123",
};

// Sample PROPFIND XML response
const PROPFIND_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/remote.php/dav/files/admin/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>Tue, 29 Apr 2025 10:00:00 GMT</D:getlastmodified>
        <D:getetag>"abc123"</D:getetag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/remote.php/dav/files/admin/Documents/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Documents</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>Tue, 29 Apr 2025 09:00:00 GMT</D:getlastmodified>
        <D:getetag>"dir456"</D:getetag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/remote.php/dav/files/admin/README.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>README.txt</D:displayname>
        <D:resourcetype/>
        <D:getlastmodified>Mon, 28 Apr 2025 12:00:00 GMT</D:getlastmodified>
        <D:getcontentlength>1024</D:getcontentlength>
        <D:getcontenttype>text/plain</D:getcontenttype>
        <D:getetag>"file789"</D:getetag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

describe("NextcloudClient", () => {
  let client: NextcloudClient;
  let mockHttpInstance: jest.Mocked<ReturnType<typeof axios.create>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHttpInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<ReturnType<typeof axios.create>>;

    mockedAxios.create.mockReturnValue(mockHttpInstance as ReturnType<typeof axios.create>);
    client = new NextcloudClient(MOCK_CONFIG);
  });

  describe("getCurrentUser", () => {
    it("fetches and caches the current user", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({
        data: {
          ocs: {
            meta: { statuscode: 200 },
            data: { id: "admin" },
          },
        },
      });

      const user = await client.getCurrentUser();
      expect(user).toBe("admin");

      // Second call should use cache
      const user2 = await client.getCurrentUser();
      expect(user2).toBe("admin");
      expect(mockHttpInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("listFiles", () => {
    it("parses PROPFIND response and returns file list", async () => {
      // Mock getCurrentUser
      mockHttpInstance.get.mockResolvedValueOnce({
        data: { ocs: { meta: { statuscode: 200 }, data: { id: "admin" } } },
      });
      // Mock PROPFIND
      mockHttpInstance.request.mockResolvedValueOnce({ data: PROPFIND_RESPONSE });

      const files = await client.listFiles("/");
      expect(files).toHaveLength(2);

      const dir = files.find((f) => f.type === "directory");
      expect(dir).toBeDefined();
      expect(dir?.basename).toBe("Documents");

      const file = files.find((f) => f.type === "file");
      expect(file).toBeDefined();
      expect(file?.basename).toBe("README.txt");
      expect(file?.size).toBe(1024);
      expect(file?.mime).toBe("text/plain");
    });
  });

  describe("getFileContent", () => {
    it("fetches file content", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({
        data: { ocs: { meta: { statuscode: 200 }, data: { id: "admin" } } },
      });
      mockHttpInstance.get.mockResolvedValueOnce({ data: "Hello, World!" });

      const content = await client.getFileContent("/README.txt");
      expect(content).toBe("Hello, World!");
    });
  });

  describe("uploadFile", () => {
    it("uploads file content via PUT", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({
        data: { ocs: { meta: { statuscode: 200 }, data: { id: "admin" } } },
      });
      mockHttpInstance.put.mockResolvedValueOnce({ status: 201 });

      await expect(client.uploadFile("/test.txt", "content")).resolves.toBeUndefined();
      expect(mockHttpInstance.put).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteFile", () => {
    it("deletes a file via DELETE", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({
        data: { ocs: { meta: { statuscode: 200 }, data: { id: "admin" } } },
      });
      mockHttpInstance.delete.mockResolvedValueOnce({ status: 204 });

      await expect(client.deleteFile("/old.txt")).resolves.toBeUndefined();
      expect(mockHttpInstance.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("moveFile", () => {
    it("moves a file via MOVE", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({
        data: { ocs: { meta: { statuscode: 200 }, data: { id: "admin" } } },
      });
      mockHttpInstance.request.mockResolvedValueOnce({ status: 201 });

      await expect(client.moveFile("/old.txt", "/new.txt")).resolves.toBeUndefined();
      expect(mockHttpInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: "MOVE" })
      );
    });
  });

  describe("copyFile", () => {
    it("copies a file via COPY", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({
        data: { ocs: { meta: { statuscode: 200 }, data: { id: "admin" } } },
      });
      mockHttpInstance.request.mockResolvedValueOnce({ status: 201 });

      await expect(client.copyFile("/source.txt", "/dest.txt")).resolves.toBeUndefined();
      expect(mockHttpInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: "COPY" })
      );
    });
  });

  describe("createDirectory", () => {
    it("creates directory via MKCOL", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({
        data: { ocs: { meta: { statuscode: 200 }, data: { id: "admin" } } },
      });
      mockHttpInstance.request.mockResolvedValueOnce({ status: 201 });

      await expect(client.createDirectory("/NewFolder")).resolves.toBeUndefined();
      expect(mockHttpInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: "MKCOL" })
      );
    });
  });

  describe("listShares", () => {
    it("returns list of shares", async () => {
      const mockShares = [{ id: "1", path: "/test.txt", shareType: 3 }];
      mockHttpInstance.get.mockResolvedValueOnce({
        data: {
          ocs: {
            meta: { statuscode: 100 },
            data: { element: mockShares },
          },
        },
      });

      const shares = await client.listShares();
      expect(shares).toEqual(mockShares);
    });
  });

  describe("createShare", () => {
    it("creates a share and returns share info", async () => {
      const mockShare = { id: "42", path: "/Documents", shareType: 3, permissions: 1 };
      mockHttpInstance.post.mockResolvedValueOnce({
        data: { ocs: { meta: { statuscode: 100 }, data: mockShare } },
      });

      const share = await client.createShare("/Documents", 3);
      expect(share).toEqual(mockShare);
      expect(mockHttpInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteShare", () => {
    it("deletes a share by ID", async () => {
      mockHttpInstance.delete.mockResolvedValueOnce({
        data: { ocs: { meta: { statuscode: 100 }, data: null } },
      });

      await expect(client.deleteShare("42")).resolves.toBeUndefined();
      expect(mockHttpInstance.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("listUsers", () => {
    it("returns list of user IDs", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({
        data: {
          ocs: {
            meta: { statuscode: 100 },
            data: { users: ["admin", "alice", "bob"] },
          },
        },
      });

      const users = await client.listUsers();
      expect(users).toEqual(["admin", "alice", "bob"]);
    });
  });

  describe("getUser", () => {
    it("returns user info", async () => {
      const mockUser = { id: "alice", displayname: "Alice Smith", email: "alice@example.com", enabled: true };
      mockHttpInstance.get.mockResolvedValueOnce({
        data: { ocs: { meta: { statuscode: 100 }, data: mockUser } },
      });

      const user = await client.getUser("alice");
      expect(user).toEqual(mockUser);
    });
  });

  describe("checkHealth", () => {
    it("returns ok status when server is reachable", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({
        data: {
          ocs: {
            meta: { statuscode: 100 },
            data: { version: "28.0.0" },
          },
        },
      });

      const health = await client.checkHealth();
      expect(health.status).toBe("ok");
    });

    it("returns error status when server is unreachable", async () => {
      mockHttpInstance.get.mockRejectedValueOnce(new Error("Network Error"));

      const health = await client.checkHealth();
      expect(health.status).toBe("error");
    });
  });

  describe("error handling", () => {
    it("throws on OCS error status codes", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({
        data: {
          ocs: {
            meta: { statuscode: 404, message: "Not found" },
            data: null,
          },
        },
      });

      await expect(client.listUsers()).rejects.toThrow("Nextcloud API error 404: Not found");
    });

    it("throws when ocs field is missing", async () => {
      mockHttpInstance.get.mockResolvedValueOnce({ data: {} });
      await expect(client.listUsers()).rejects.toThrow("Invalid OCS response");
    });
  });
});
