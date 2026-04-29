import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { loadNextcloudOperations } from "./nextcloud-operations.js";

const OPERATION_REGISTRY = new Map(loadNextcloudOperations().map((operation) => [operation.operationId, operation]));

export interface RestCallResult {
  status: number;
  url: string;
  data: string;
  headers: Record<string, string | null>;
}

export class NextcloudApiClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly authHeader: string;

  constructor(nextcloudUrl: string, username: string, token: string) {
    this.baseUrl = nextcloudUrl.replace(/\/+$/, "");
    this.username = username;
    this.authHeader = "Basic " + Buffer.from(`${username}:${token}`).toString("base64");
  }

  async callRestByOperationId(operationId: string, parameters: Record<string, unknown>): Promise<RestCallResult> {
    const operation = OPERATION_REGISTRY.get(operationId);
    if (!operation) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown operationId: ${operationId}`);
    }

    // Substitute path parameters
    let path = operation.path.replace("{username}", encodeURIComponent(this.username));
    const remainingParams: Record<string, unknown> = { ...parameters };

    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{${key}}`;
      if (path.includes(placeholder)) {
        path = path.replace(placeholder, encodeURIComponent(String(value)));
        delete remainingParams[key];
      }
    }

    const url = new URL(this.baseUrl + path);
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      "OCS-APIREQUEST": "true"
    };

    const isBodyMethod =
      operation.method === "POST" ||
      operation.method === "PUT" ||
      operation.method === "PROPFIND" ||
      operation.method === "REPORT" ||
      operation.method === "MKCOL";

    // Special header params for MOVE/COPY
    const destination = remainingParams.destination;
    if ((operation.method === "MOVE" || operation.method === "COPY") && typeof destination === "string") {
      headers["Destination"] = this.baseUrl + "/remote.php/dav/files/" + encodeURIComponent(this.username) + "/" + destination.replace(/^\/+/, "");
      delete remainingParams.destination;
    }

    // Depth header for PROPFIND
    if (operation.method === "PROPFIND") {
      headers["Depth"] = "1";
    }

    let body: string | undefined;

    // Handle raw body param
    if (remainingParams.body !== undefined) {
      body = String(remainingParams.body);
      delete remainingParams.body;
    } else if (operation.method === "REPORT" && operation.tags.includes("caldav")) {
      // Default calendar-query body with optional time range
      const startRaw = remainingParams.start ? String(remainingParams.start) : "";
      const startVal = startRaw ? `<C:time-range start="${escapeXmlAttr(startRaw)}"/>` : "";
      delete remainingParams.start;
      delete remainingParams.end;
      headers["Content-Type"] = "application/xml";
      body =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">` +
        `<D:prop><D:getetag/><C:calendar-data/></D:prop>` +
        `<C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT">${startVal}</C:comp-filter></C:comp-filter></C:filter>` +
        `</C:calendar-query>`;
    } else if (operation.method === "REPORT" && operation.tags.includes("carddav")) {
      // Default addressbook-query body
      headers["Content-Type"] = "application/xml";
      body =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<C:addressbook-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">` +
        `<D:prop><D:getetag/><C:address-data/></D:prop>` +
        `</C:addressbook-query>`;
    } else if (operation.method === "PROPFIND") {
      headers["Content-Type"] = "application/xml";
      body =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<D:propfind xmlns:D="DAV:"><D:prop><D:displayname/><D:getcontenttype/><D:getcontentlength/><D:getlastmodified/><D:resourcetype/></D:prop></D:propfind>`;
    }

    // Remaining params as query string (GET/DELETE/HEAD) or JSON body (POST/PUT)
    if (!isBodyMethod || operation.method === "PROPFIND" || operation.method === "REPORT" || operation.method === "MKCOL") {
      for (const [key, value] of Object.entries(remainingParams)) {
        url.searchParams.set(key, String(value));
      }
    } else if (Object.keys(remainingParams).length > 0) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(remainingParams);
    }

    // OCS endpoints: always request JSON format
    if (operation.path.startsWith("/ocs/")) {
      url.searchParams.set("format", "json");
    }

    const init: RequestInit = { method: operation.method, headers };
    if (body !== undefined) {
      init.body = body;
    }

    try {
      const response = await fetch(url.toString(), init);
      const text = await response.text();

      return {
        status: response.status,
        url: url.toString(),
        data: text,
        headers: {
          "content-type": response.headers.get("content-type"),
          "x-nextcloud-user-backend": response.headers.get("x-nextcloud-user-backend"),
          etag: response.headers.get("etag"),
          "last-modified": response.headers.get("last-modified")
        }
      };
    } catch (error: unknown) {
      if (error instanceof McpError) {
        throw error;
      }
      throw normalizeNextcloudError(error);
    }
  }
}

export function normalizeNextcloudError(error: unknown): McpError {
  const rawMessage =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error && typeof (error as Record<string, unknown>).message === "string"
        ? String((error as Record<string, unknown>).message)
        : String(error ?? "unknown error");

  const message = redactSecrets(rawMessage);

  return new McpError(ErrorCode.InternalError, `Nextcloud API request failed: ${message}`);
}

export function redactSecrets(value: string): string {
  return value.replace(/\bBasic\s+[A-Za-z0-9+/=]{8,}/gi, "Basic [redacted]");
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const __testing = { normalizeNextcloudError, redactSecrets };
