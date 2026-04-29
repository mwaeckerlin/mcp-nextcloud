export interface Config {
  url: string;
  username: string;
  password: string;
}

export function getConfig(): Config {
  const url = process.env.NEXTCLOUD_URL;
  const username = process.env.NEXTCLOUD_USERNAME;
  const password = process.env.NEXTCLOUD_PASSWORD;

  const missing: string[] = [];
  if (!url) missing.push('NEXTCLOUD_URL');
  if (!username) missing.push('NEXTCLOUD_USERNAME');
  if (!password) missing.push('NEXTCLOUD_PASSWORD');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return { url: url!, username: username!, password: password! };
}
