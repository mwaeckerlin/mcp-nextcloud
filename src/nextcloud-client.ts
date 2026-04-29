import axios, { AxiosInstance, isAxiosError } from "axios";
import type { NextcloudConfig } from "./config.js";

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export function normalizeNextcloudError(error: unknown): Error {
  if (isAxiosError(error)) {
    const msg = error.response ? `HTTP ${error.response.status} ${error.response.statusText}` : error.message;
    return new Error(msg);
  }
  return error instanceof Error ? error : new Error(String(error));
}

export class NextcloudClient {
  private readonly http: AxiosInstance;
  readonly username: string;
  readonly baseUrl: string;

  constructor(config: NextcloudConfig) {
    this.username = config.username;
    this.baseUrl = config.url;
    this.http = axios.create({
      baseURL: config.url,
      auth: {
        username: config.username,
        password: config.token
      },
      validateStatus: () => true
    });
  }

  async request(
    method: string,
    path: string,
    body?: string,
    headers?: Record<string, string>,
    responseEncoding: "text" | "base64" = "text"
  ): Promise<ProxyResponse> {
    try {
      const response = await this.http.request<Buffer>({
        method: method.toUpperCase(),
        url: path,
        data: body,
        headers: headers ?? {},
        responseType: "arraybuffer"
      });

      const buf = Buffer.from(response.data);
      const bodyOut = responseEncoding === "base64" ? buf.toString("base64") : buf.toString("utf8");

      const responseHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(response.headers)) {
        if (typeof v === "string") responseHeaders[k] = v;
        else if (Array.isArray(v)) responseHeaders[k] = v.join(", ");
      }

      return { status: response.status, headers: responseHeaders, body: bodyOut };
    } catch (err) {
      throw normalizeNextcloudError(err);
    }
  }
}

export function createClient(config: NextcloudConfig): NextcloudClient {
  return new NextcloudClient(config);
}

export const __testing = { normalizeNextcloudError };
