import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const CATEGORIES = ["Software", "Hardware", "Network", "Inquiry / Help", "Database"];
const PRIORITIES = ["1 - Critical", "2 - High", "3 - Moderate", "4 - Low"];
const STATES = ["New", "In Progress", "On Hold", "Resolved", "Closed"];

type Credentials = { instance: string; username: string; password: string };

type GenerationState = {
  running: boolean;
  cancelRequested: boolean;
  status: "idle" | "running" | "completed" | "cancelled";
  total: number;
  created: number;
  failed: number;
  startedAt: number | null;
  completedAt: number | null;
  recentErrors: string[];
  milestones: string[];
  targetInstance: string | null;
};

const state: GenerationState = {
  running: false,
  cancelRequested: false,
  status: "idle",
  total: 0,
  created: 0,
  failed: 0,
  startedAt: null,
  completedAt: null,
  recentErrors: [],
  milestones: [],
  targetInstance: null,
};

function getEnvCredentials(): Credentials | null {
  const instance = process.env.SN_INSTANCE;
  const username = process.env.SN_ADMIN_USERNAME ?? process.env.SN_USERNAME;
  const password = process.env.SN_ADMIN_PASSWORD ?? process.env.SN_PASSWORD;
  if (!instance || !username || !password) return null;
  return { instance, username, password };
}

function normalizeInstance(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/+$/, "");
}

const ALLOWED_HOST_RE = /^[a-z0-9-]+\.service-now\.com$/i;

function validateOverrideInstance(raw: string): { ok: true; url: string; host: string } | { ok: false; error: string } {
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
  return { ok: true, url: `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`, host: parsed.hostname };
}

function hostnameOfEnv(instance: string): string {
  try {
    return new URL(instance).hostname;
  } catch {
    return instance;
  }
}

function stateSnapshot() {
  const durationMs =
    state.startedAt != null && state.completedAt != null
      ? state.completedAt - state.startedAt
      : null;
  return {
    running: state.running,
    status: state.status,
    total: state.total,
    created: state.created,
    failed: state.failed,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    durationMs,
    recentErrors: [...state.recentErrors],
    milestones: [...state.milestones],
    targetInstance: state.targetInstance,
  };
}

async function runGeneration(count: number, creds: Credentials, host: string): Promise<void> {
  const { instance, username, password } = creds;
  const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");
  const url = `${instance}/api/now/table/incident`;

  for (let i = 1; i <= count; i++) {
    if (!state.running || state.cancelRequested) break;

    const payload: Record<string, string> = {
      short_description: `Test incident ${i} - auto generated for API testing`,
      category: CATEGORIES[i % CATEGORIES.length],
      priority: PRIORITIES[i % PRIORITIES.length],
      state: STATES[i % STATES.length],
      caller_id: "admin",
      description: `This is test record number ${i} created for pagination testing.`,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      state.created++;

      if (state.created % 100 === 0) {
        const elapsed = ((Date.now() - (state.startedAt ?? Date.now())) / 1000).toFixed(1);
        const msg = `[${host}] Created ${state.created} / ${count} records — ${elapsed}s elapsed`;
        state.milestones.push(msg);
        logger.info({ created: state.created, total: count, elapsed: `${elapsed}s`, instance: host }, "Test data progress");
      }
    } catch (err) {
      state.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ i, err: msg, instance: host }, "Failed to create test incident");
      state.recentErrors.push(`[${host}] Record ${i}: ${msg}`);
      if (state.recentErrors.length > 20) {
        state.recentErrors.shift();
      }
    }
  }

  const wasCancelled = state.cancelRequested;
  state.running = false;
  state.cancelRequested = false;
  state.completedAt = Date.now();
  state.status = wasCancelled ? "cancelled" : "completed";
  const elapsed = ((state.completedAt - (state.startedAt ?? state.completedAt)) / 1000).toFixed(1);
  const doneMsg = wasCancelled
    ? `[${host}] Cancelled — ${state.created} / ${state.total} records created in ${elapsed}s`
    : `[${host}] Done — ${state.created} / ${state.total} records created in ${elapsed}s`;
  state.milestones.push(doneMsg);
  logger.info(
    { created: state.created, failed: state.failed, elapsed: `${elapsed}s`, cancelled: wasCancelled, instance: host },
    wasCancelled ? "Test data generation cancelled" : "Test data generation complete"
  );
}

router.post("/test-data/generate", async (req, res) => {
  if (state.running) {
    res.status(409).json({ error: "Generation already in progress." });
    return;
  }

  const raw = req.body?.count;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1 || count > 2000) {
    res.status(400).json({ error: "count must be an integer between 1 and 2000." });
    return;
  }

  const overrideInstanceRaw = typeof req.body?.instance === "string" ? req.body.instance.trim() : "";
  const overrideUsername = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const overridePassword = typeof req.body?.password === "string" ? req.body.password : "";
  const providedCount = [overrideInstanceRaw, overrideUsername, overridePassword].filter((v) => v.length > 0).length;

  let creds: Credentials;
  let host: string;
  if (providedCount === 0) {
    const envCreds = getEnvCredentials();
    if (!envCreds) {
      res.status(500).json({
        error:
          "ServiceNow credentials are not configured. Set SN_INSTANCE and either SN_ADMIN_USERNAME/SN_ADMIN_PASSWORD or SN_USERNAME/SN_PASSWORD, or supply instance/username/password in the request.",
      });
      return;
    }
    creds = envCreds;
    host = hostnameOfEnv(envCreds.instance);
  } else if (providedCount === 3) {
    const validated = validateOverrideInstance(overrideInstanceRaw);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }
    creds = { instance: validated.url, username: overrideUsername, password: overridePassword };
    host = validated.host;
  } else {
    res.status(400).json({
      error:
        "Provide all three of instance, username, and password to override credentials — or leave all three blank to use the configured credentials.",
    });
    return;
  }

  state.running = true;
  state.cancelRequested = false;
  state.status = "running";
  state.total = count;
  state.created = 0;
  state.failed = 0;
  state.startedAt = Date.now();
  state.completedAt = null;
  state.recentErrors = [];
  state.milestones = [];
  state.targetInstance = host;

  logger.info(
    { count, instance: state.targetInstance, usingOverride: providedCount === 3 },
    "Starting test data generation"
  );

  runGeneration(count, creds, host).catch((err) => {
    logger.error({ err, instance: state.targetInstance }, "Unhandled error in test data generation");
    state.running = false;
    state.cancelRequested = false;
    state.status = "completed";
    state.completedAt = Date.now();
  });

  res.status(202).json(stateSnapshot());
});

router.post("/test-data/cancel", (_req, res) => {
  if (!state.running) {
    res.status(409).json({ error: "No generation is currently running." });
    return;
  }
  state.cancelRequested = true;
  logger.info({ instance: state.targetInstance }, "Cancel requested for test data generation");
  res.json({ message: "Cancel requested. Generation will stop after the current record." });
});

router.get("/test-data/status", (_req, res) => {
  res.json(stateSnapshot());
});

export default router;
