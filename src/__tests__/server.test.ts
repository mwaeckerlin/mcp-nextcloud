import { getConfig } from "../server";

describe("Server Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when NEXTCLOUD_URL is missing", () => {
    delete process.env["NEXTCLOUD_URL"];
    delete process.env["NEXTCLOUD_TOKEN"];
    expect(() => getConfig()).toThrow("NEXTCLOUD_URL");
  });

  it("throws when NEXTCLOUD_TOKEN is missing", () => {
    process.env["NEXTCLOUD_URL"] = "https://cloud.example.com";
    delete process.env["NEXTCLOUD_TOKEN"];
    expect(() => getConfig()).toThrow("NEXTCLOUD_TOKEN");
  });

  it("returns config when both env vars are set", () => {
    process.env["NEXTCLOUD_URL"] = "https://cloud.example.com";
    process.env["NEXTCLOUD_TOKEN"] = "my-secret-token";
    const config = getConfig();
    expect(config.url).toBe("https://cloud.example.com");
    expect(config.token).toBe("my-secret-token");
  });

  it("throws for invalid URL protocol", () => {
    process.env["NEXTCLOUD_URL"] = "ftp://cloud.example.com";
    process.env["NEXTCLOUD_TOKEN"] = "token";
    expect(() => getConfig()).toThrow("http or https");
  });

  it("accepts http URL", () => {
    process.env["NEXTCLOUD_URL"] = "http://cloud.example.com";
    process.env["NEXTCLOUD_TOKEN"] = "token";
    const config = getConfig();
    expect(config.url).toBe("http://cloud.example.com");
  });
});
