export type Credentials = { instance: string; username: string; password: string };

const ALLOWED_HOST_RE = /^[a-z0-9-]+\.service-now\.com$/i;

export function normalizeInstance(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/+$/, "");
}

export function validateOverrideInstance(
  raw: string
): { ok: true; url: string; host: string } | { ok: false; error: string } {
  const normalized = normalizeInstance(raw);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, error: "instance must be a valid URL (e.g. https://devXXXXX.service-now.com)." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "instance must use https://." };
  }
  if (!ALLOWED_HOST_RE.test(parsed.hostname)) {
    return { ok: false, error: "instance must be a *.service-now.com hostname." };
  }
  return {
    ok: true,
    url: `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`,
    host: parsed.hostname,
  };
}

export function hostnameOf(instance: string): string {
  try {
    return new URL(instance).hostname;
  } catch {
    return instance;
  }
}

export function getEnvCredentials(): Credentials | null {
  const instance = process.env.SN_INSTANCE;
  const username = process.env.SN_USERNAME;
  const password = process.env.SN_PASSWORD;
  if (!instance || !username || !password) return null;
  return { instance, username, password };
}

export type ResolveResult =
  | { ok: true; creds: Credentials; host: string; usingOverride: boolean }
  | { ok: false; status: number; error: string };

/**
 * Resolve credentials from request body overrides or env vars.
 * All-or-nothing: must supply all three of instance/username/password to override,
 * or leave all three blank to use env-configured credentials.
 */
export function resolveCredentialsFromBody(body: unknown): ResolveResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const overrideInstanceRaw = typeof b.instance === "string" ? b.instance.trim() : "";
  const overrideUsername = typeof b.username === "string" ? b.username.trim() : "";
  const overridePassword = typeof b.password === "string" ? (b.password as string) : "";
  const providedCount = [overrideInstanceRaw, overrideUsername, overridePassword].filter(
    (v) => v.length > 0
  ).length;

  if (providedCount === 0) {
    const envCreds = getEnvCredentials();
    if (!envCreds) {
      return {
        ok: false,
        status: 500,
        error:
          "ServiceNow credentials are not configured. Set SN_INSTANCE, SN_USERNAME, and SN_PASSWORD, or supply instance/username/password in the request.",
      };
    }
    return { ok: true, creds: envCreds, host: hostnameOf(envCreds.instance), usingOverride: false };
  }

  if (providedCount === 3) {
    const validated = validateOverrideInstance(overrideInstanceRaw);
    if (!validated.ok) {
      return { ok: false, status: 400, error: validated.error };
    }
    return {
      ok: true,
      creds: { instance: validated.url, username: overrideUsername, password: overridePassword },
      host: validated.host,
      usingOverride: true,
    };
  }

  return {
    ok: false,
    status: 400,
    error:
      "Provide all three of instance, username, and password to override credentials — or leave all three blank to use the configured credentials.",
  };
}
