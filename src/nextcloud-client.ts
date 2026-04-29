import axios, { AxiosInstance, AxiosError } from 'axios';
import type { Config } from './config.js';

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export class NextcloudClient {
  private http: AxiosInstance;
  readonly username: string;
  readonly baseUrl: string;

  constructor(config: Config) {
    this.username = config.username;
    this.baseUrl = config.url;
    this.http = axios.create({
      baseURL: config.url,
      auth: {
        username: config.username,
        password: config.password,
      },
      // Don't throw on non-2xx so we can pass the status back to the caller
      validateStatus: () => true,
    });
  }

  async request(
    method: string,
    path: string,
    body?: string,
    headers?: Record<string, string>,
    responseEncoding: 'text' | 'base64' = 'text'
  ): Promise<ProxyResponse> {
    try {
      const response = await this.http.request<Buffer>({
        method: method.toUpperCase(),
        url: path,
        data: body,
        headers: headers ?? {},
        responseType: 'arraybuffer',
      });

      const buf = Buffer.from(response.data);
      const bodyOut =
        responseEncoding === 'base64'
          ? buf.toString('base64')
          : buf.toString('utf8');

      const responseHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(response.headers)) {
        if (typeof v === 'string') responseHeaders[k] = v;
        else if (Array.isArray(v)) responseHeaders[k] = v.join(', ');
      }

      return { status: response.status, headers: responseHeaders, body: bodyOut };
    } catch (err) {
      if (err instanceof AxiosError) {
        const msg = err.response
          ? `HTTP ${err.response.status} ${err.response.statusText}`
          : err.message;
        throw new Error(msg);
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}

export function createClient(config: Config): NextcloudClient {
  return new NextcloudClient(config);
}
