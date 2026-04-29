export interface NextcloudConfig {
  url: string;
  username: string;
  token: string;
}

export interface ServerConfig extends NextcloudConfig {
  host: string;
  port: number;
  mcpAuthToken: string | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const url = env.NEXTCLOUD_URL;
  const username = env.NEXTCLOUD_USERNAME;
  const token = env.NEXTCLOUD_TOKEN;

  const missing: string[] = [];
  if (!url) missing.push("NEXTCLOUD_URL");
  if (!username) missing.push("NEXTCLOUD_USERNAME");
  if (!token) missing.push("NEXTCLOUD_TOKEN");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const host = env.MCP_NEXTCLOUD_HOST ?? "127.0.0.1";
  const portStr = env.MCP_NEXTCLOUD_PORT ?? "4000";
  const port = parseInt(portStr, 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid MCP_NEXTCLOUD_PORT: ${portStr}`);
  }

  return {
    url: url!,
    username: username!,
    token: token!,
    host,
    port,
    mcpAuthToken: env.MCP_AUTH_TOKEN
  };
}
