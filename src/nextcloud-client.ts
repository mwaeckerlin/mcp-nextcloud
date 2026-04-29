import axios, { AxiosInstance, AxiosResponse } from "axios";

export interface NextcloudConfig {
  url: string;
  token: string;
}

export interface FileInfo {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: "file" | "directory";
  etag: string;
  mime?: string;
  props?: Record<string, unknown>;
}

export interface ShareInfo {
  id: string;
  shareType: number;
  shareWith?: string;
  permissions: number;
  path: string;
  url?: string;
  token?: string;
  expiration?: string;
  note?: string;
}

export interface UserInfo {
  id: string;
  enabled: boolean;
  email?: string;
  displayname: string;
  groups?: string[];
  quota?: {
    used: number;
    total: number;
    relative: number;
    free: number;
  };
}

export interface ActivityInfo {
  activityId: number;
  app: string;
  type: string;
  user: string;
  subject: string;
  message: string;
  objectType: string;
  objectId: number;
  objectName: string;
  datetime: string;
}

export class NextcloudClient {
  private readonly webdavBase: string;
  private readonly ocsBase: string;
  private readonly http: AxiosInstance;

  constructor(private readonly config: NextcloudConfig) {
    const baseURL = config.url.replace(/\/$/, "");
    this.webdavBase = `${baseURL}/remote.php/dav/files`;
    this.ocsBase = `${baseURL}/ocs/v2.php`;

    this.http = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "OCS-APIRequest": "true",
        Accept: "application/json",
      },
      timeout: 30000,
    });
  }

  // ─── File Operations (WebDAV) ────────────────────────────────────────────────

  async listFiles(path: string = "/"): Promise<FileInfo[]> {
    const user = await this.getCurrentUser();
    const url = `${this.webdavBase}/${user}${path === "/" ? "" : path}`;
    const response: AxiosResponse<string> = await this.http.request({
      method: "PROPFIND",
      url,
      headers: {
        Depth: "1",
        "Content-Type": "application/xml",
      },
      data: `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getlastmodified/>
    <D:getcontentlength/>
    <D:getcontenttype/>
    <D:getetag/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`,
    });
    return this.parseWebDAVResponse(response.data, path);
  }

  async getFileContent(path: string): Promise<string> {
    const user = await this.getCurrentUser();
    const url = `${this.webdavBase}/${user}${path}`;
    const response: AxiosResponse<string> = await this.http.get(url, {
      responseType: "text",
    });
    return response.data;
  }

  async uploadFile(path: string, content: string): Promise<void> {
    const user = await this.getCurrentUser();
    const url = `${this.webdavBase}/${user}${path}`;
    await this.http.put(url, content, {
      headers: { "Content-Type": "application/octet-stream" },
    });
  }

  async deleteFile(path: string): Promise<void> {
    const user = await this.getCurrentUser();
    const url = `${this.webdavBase}/${user}${path}`;
    await this.http.delete(url);
  }

  async moveFile(fromPath: string, toPath: string): Promise<void> {
    const user = await this.getCurrentUser();
    const fromUrl = `${this.webdavBase}/${user}${fromPath}`;
    const toUrl = `${this.webdavBase}/${user}${toPath}`;
    await this.http.request({
      method: "MOVE",
      url: fromUrl,
      headers: { Destination: toUrl, Overwrite: "T" },
    });
  }

  async copyFile(fromPath: string, toPath: string): Promise<void> {
    const user = await this.getCurrentUser();
    const fromUrl = `${this.webdavBase}/${user}${fromPath}`;
    const toUrl = `${this.webdavBase}/${user}${toPath}`;
    await this.http.request({
      method: "COPY",
      url: fromUrl,
      headers: { Destination: toUrl, Overwrite: "T" },
    });
  }

  async createDirectory(path: string): Promise<void> {
    const user = await this.getCurrentUser();
    const url = `${this.webdavBase}/${user}${path}`;
    await this.http.request({ method: "MKCOL", url });
  }

  async searchFiles(query: string): Promise<FileInfo[]> {
    const user = await this.getCurrentUser();
    const url = `${this.webdavBase}/${user}`;
    const response: AxiosResponse<string> = await this.http.request({
      method: "SEARCH",
      url,
      headers: { "Content-Type": "application/xml" },
      data: `<?xml version="1.0" encoding="UTF-8"?>
<D:searchrequest xmlns:D="DAV:">
  <D:basicsearch>
    <D:select><D:allprop/></D:select>
    <D:from><D:scope><D:href>/remote.php/dav/files/${user}/</D:href><D:depth>infinity</D:depth></D:scope></D:from>
    <D:where>
      <D:like><D:prop><D:displayname/></D:prop><D:literal>%${query}%</D:literal></D:like>
    </D:where>
  </D:basicsearch>
</D:searchrequest>`,
    });
    return this.parseWebDAVResponse(response.data, "/");
  }

  // ─── Share Operations (OCS API) ──────────────────────────────────────────────

  async listShares(path?: string): Promise<ShareInfo[]> {
    const params: Record<string, string> = { format: "json" };
    if (path) params["path"] = path;
    const response = await this.http.get(`${this.ocsBase}/apps/files_sharing/api/v1/shares`, {
      params,
    });
    return this.extractOCSData<ShareInfo[]>(response.data, "element");
  }

  async createShare(
    path: string,
    shareType: number,
    shareWith?: string,
    permissions?: number,
    expireDate?: string,
    note?: string
  ): Promise<ShareInfo> {
    const data: Record<string, string | number> = {
      path,
      shareType,
      permissions: permissions ?? 1,
    };
    if (shareWith) data["shareWith"] = shareWith;
    if (expireDate) data["expireDate"] = expireDate;
    if (note) data["note"] = note;

    const response = await this.http.post(
      `${this.ocsBase}/apps/files_sharing/api/v1/shares`,
      new URLSearchParams(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return this.extractOCSData<ShareInfo>(response.data);
  }

  async getShare(shareId: string): Promise<ShareInfo> {
    const response = await this.http.get(
      `${this.ocsBase}/apps/files_sharing/api/v1/shares/${shareId}`,
      { params: { format: "json" } }
    );
    return this.extractOCSData<ShareInfo>(response.data, "element");
  }

  async deleteShare(shareId: string): Promise<void> {
    await this.http.delete(
      `${this.ocsBase}/apps/files_sharing/api/v1/shares/${shareId}`,
      { params: { format: "json" } }
    );
  }

  async updateShare(
    shareId: string,
    updates: { permissions?: number; expireDate?: string; note?: string; password?: string }
  ): Promise<ShareInfo> {
    const data = new URLSearchParams(
      Object.fromEntries(
        Object.entries(updates)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    );
    const response = await this.http.put(
      `${this.ocsBase}/apps/files_sharing/api/v1/shares/${shareId}`,
      data,
      { params: { format: "json" }, headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return this.extractOCSData<ShareInfo>(response.data);
  }

  // ─── User Operations (OCS API) ───────────────────────────────────────────────

  async listUsers(search?: string, limit?: number, offset?: number): Promise<string[]> {
    const params: Record<string, string | number> = { format: "json" };
    if (search) params["search"] = search;
    if (limit !== undefined) params["limit"] = limit;
    if (offset !== undefined) params["offset"] = offset;
    const response = await this.http.get(`${this.ocsBase}/cloud/users`, { params });
    const data = this.extractOCSData<{ users: string[] }>(response.data);
    return data.users ?? [];
  }

  async getUser(userId: string): Promise<UserInfo> {
    const response = await this.http.get(`${this.ocsBase}/cloud/users/${encodeURIComponent(userId)}`, {
      params: { format: "json" },
    });
    return this.extractOCSData<UserInfo>(response.data);
  }

  async createUser(
    userId: string,
    password: string,
    displayName?: string,
    email?: string,
    groups?: string[]
  ): Promise<void> {
    const data: Record<string, string> = { userid: userId, password };
    if (displayName) data["displayName"] = displayName;
    if (email) data["email"] = email;
    if (groups) {
      groups.forEach((g, i) => {
        data[`groups[${i}]`] = g;
      });
    }
    await this.http.post(
      `${this.ocsBase}/cloud/users`,
      new URLSearchParams(data),
      { params: { format: "json" }, headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
  }

  async deleteUser(userId: string): Promise<void> {
    await this.http.delete(`${this.ocsBase}/cloud/users/${encodeURIComponent(userId)}`, {
      params: { format: "json" },
    });
  }

  async enableUser(userId: string): Promise<void> {
    await this.http.put(`${this.ocsBase}/cloud/users/${encodeURIComponent(userId)}/enable`, null, {
      params: { format: "json" },
    });
  }

  async disableUser(userId: string): Promise<void> {
    await this.http.put(`${this.ocsBase}/cloud/users/${encodeURIComponent(userId)}/disable`, null, {
      params: { format: "json" },
    });
  }

  async getUserGroups(userId: string): Promise<string[]> {
    const response = await this.http.get(
      `${this.ocsBase}/cloud/users/${encodeURIComponent(userId)}/groups`,
      { params: { format: "json" } }
    );
    const data = this.extractOCSData<{ groups: string[] }>(response.data);
    return data.groups ?? [];
  }

  // ─── Activity Operations ─────────────────────────────────────────────────────

  async getActivities(
    objectType?: string,
    objectId?: number,
    since?: number,
    limit?: number
  ): Promise<ActivityInfo[]> {
    const params: Record<string, string | number> = { format: "json" };
    if (objectType) params["object_type"] = objectType;
    if (objectId !== undefined) params["object_id"] = objectId;
    if (since !== undefined) params["since"] = since;
    if (limit !== undefined) params["limit"] = limit;
    const response = await this.http.get(`${this.ocsBase}/apps/activity/api/v2/activity`, { params });
    return this.extractOCSData<ActivityInfo[]>(response.data, "element") ?? [];
  }

  // ─── Health & Info ────────────────────────────────────────────────────────────

  async getServerInfo(): Promise<Record<string, unknown>> {
    const response = await this.http.get(`${this.ocsBase}/cloud/capabilities`, {
      params: { format: "json" },
    });
    return this.extractOCSData<Record<string, unknown>>(response.data);
  }

  async checkHealth(): Promise<{ status: string; version?: string }> {
    try {
      const info = await this.getServerInfo();
      const version = (info as Record<string, unknown>)["version"] as string | undefined;
      return { status: "ok", version };
    } catch {
      return { status: "error" };
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private currentUser: string | null = null;

  async getCurrentUser(): Promise<string> {
    if (this.currentUser) return this.currentUser;
    const response = await this.http.get(`${this.ocsBase}/cloud/user`, {
      params: { format: "json" },
    });
    const data = this.extractOCSData<{ id: string }>(response.data);
    this.currentUser = data.id;
    return this.currentUser;
  }

  private extractOCSData<T>(body: unknown, arrayKey?: string): T {
    const typed = body as {
      ocs?: {
        meta?: { statuscode?: number; message?: string };
        data?: unknown;
      };
    };
    const ocs = typed?.ocs;
    if (!ocs) throw new Error("Invalid OCS response: missing 'ocs' field");
    const statusCode = ocs.meta?.statuscode;
    if (statusCode !== undefined && statusCode !== 100 && statusCode !== 200) {
      throw new Error(`Nextcloud API error ${statusCode}: ${ocs.meta?.message ?? "unknown"}`);
    }
    const data = ocs.data;
    if (arrayKey && data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      if (Array.isArray(record[arrayKey])) return record[arrayKey] as T;
    }
    return data as T;
  }

  private parseWebDAVResponse(xmlData: string, basePath: string): FileInfo[] {
    const results: FileInfo[] = [];
    const responseRegex = /<D:response[^>]*>([\s\S]*?)<\/D:response>/gi;
    let match: RegExpExecArray | null;

    while ((match = responseRegex.exec(xmlData)) !== null) {
      const block = match[1];
      const hrefMatch = /<D:href[^>]*>(.*?)<\/D:href>/i.exec(block);
      if (!hrefMatch) continue;

      const href = decodeURIComponent(hrefMatch[1]);
      // Skip the base path entry itself (first result is the directory itself)
      const pathPart = href.replace(/^\/remote\.php\/dav\/files\/[^/]+/, "");
      if (pathPart === basePath || pathPart === basePath + "/") continue;

      const isCollection = /<D:collection\s*\/>/.test(block) || /<D:collection><\/D:collection>/.test(block);
      const lastmodMatch = /<D:getlastmodified[^>]*>(.*?)<\/D:getlastmodified>/i.exec(block);
      const sizeMatch = /<D:getcontentlength[^>]*>(.*?)<\/D:getcontentlength>/i.exec(block);
      const etagMatch = /<D:getetag[^>]*>(.*?)<\/D:getetag>/i.exec(block);
      const mimeMatch = /<D:getcontenttype[^>]*>(.*?)<\/D:getcontenttype>/i.exec(block);

      const basename = pathPart.replace(/\/$/, "").split("/").pop() ?? "";

      results.push({
        filename: pathPart.replace(/\/$/, ""),
        basename,
        lastmod: lastmodMatch?.[1] ?? "",
        size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
        type: isCollection ? "directory" : "file",
        etag: etagMatch?.[1]?.replace(/"/g, "") ?? "",
        mime: mimeMatch?.[1],
      });
    }

    return results;
  }
}
