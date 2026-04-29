import axios, { AxiosInstance, AxiosError } from 'axios';
import type { Config } from './config.js';

export class NextcloudClient {
  private http: AxiosInstance;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.http = axios.create({
      baseURL: config.url,
      auth: {
        username: config.username,
        password: config.password,
      },
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  async webdavRequest(
    method: string,
    path: string,
    data?: string | Buffer,
    headers?: Record<string, string>,
    responseType: 'text' | 'arraybuffer' = 'text'
  ): Promise<{ data: string | ArrayBuffer; status: number; headers: Record<string, string> }> {
    try {
      const response = await this.http.request({
        method,
        url: `/remote.php/dav/files/${this.config.username}${path}`,
        data,
        headers: {
          'Content-Type': 'application/xml',
          ...headers,
        },
        responseType,
      });
      return { data: response.data, status: response.status, headers: response.headers as Record<string, string> };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async ocsRequest(
    method: string,
    path: string,
    params?: Record<string, string | number | boolean>,
    data?: Record<string, string | number | boolean | string[]>
  ): Promise<unknown> {
    try {
      const response = await this.http.request({
        method,
        url: `/ocs/v2.php/${path}`,
        params: { format: 'json', ...params },
        data,
        headers: {
          'OCS-APIREQUEST': 'true',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return response.data?.ocs?.data;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async caldavRequest(
    method: string,
    path: string,
    data?: string,
    headers?: Record<string, string>
  ): Promise<{ data: string; status: number }> {
    try {
      const response = await this.http.request({
        method,
        url: `/remote.php/dav/calendars/${this.config.username}${path}`,
        data,
        headers: {
          'Content-Type': 'application/xml',
          ...headers,
        },
        responseType: 'text',
      });
      return { data: response.data, status: response.status };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async carddavRequest(
    method: string,
    path: string,
    data?: string,
    headers?: Record<string, string>
  ): Promise<{ data: string; status: number }> {
    try {
      const response = await this.http.request({
        method,
        url: `/remote.php/dav/addressbooks/users/${this.config.username}${path}`,
        data,
        headers: {
          'Content-Type': 'application/xml',
          ...headers,
        },
        responseType: 'text',
      });
      return { data: response.data, status: response.status };
    } catch (err) {
      throw this.handleError(err);
    }
  }

  get username(): string {
    return this.config.username;
  }

  get baseUrl(): string {
    return this.config.url;
  }

  private truncate(s: string, max = 200): string {
    return s.length > max ? s.substring(0, max) + '... (truncated)' : s;
  }

  private handleError(err: unknown): Error {
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const statusText = err.response?.statusText;
      const message = err.response?.data
        ? typeof err.response.data === 'string'
          ? this.truncate(err.response.data)
          : this.truncate(JSON.stringify(err.response.data))
        : err.message;
      return new Error(`HTTP ${status} ${statusText}: ${message}`);
    }
    if (err instanceof Error) return err;
    return new Error(String(err));
  }
}

export function createClient(config: Config): NextcloudClient {
  return new NextcloudClient(config);
}
