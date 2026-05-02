import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const CATEGORIES = ["Software", "Hardware", "Network", "Inquiry / Help", "Database"];
const PRIORITIES = ["1 - Critical", "2 - High", "3 - Moderate", "4 - Low"];
const STATES = ["New", "In Progress", "On Hold"];

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
};

function getCredentials(): { instance: string; username: string; password: string } | null {
  const instance = process.env.SN_INSTANCE;
  const username = process.env.SN_ADMIN_USERNAME ?? process.env.SN_USERNAME;
  const password = process.env.SN_ADMIN_PASSWORD ?? process.env.SN_PASSWORD;
  if (!instance || !username || !password) return null;
  return { instance, username, password };
}

async function runGeneration(count: number, creds: ReturnType<typeof getCredentials>): Promise<void> {
  if (!creds) return;

  const { instance, username, password } = creds;
  const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");
  const url = `${instance}/api/now/table/incident?sysparm_input_display_value=true`;

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
        logger.info({ created: state.created, total: count, elapsed: `${elapsed}s` }, "Test data progress");
      }
    } catch (err) {
      state.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ i, err: msg }, "Failed to create test incident");
      if (state.recentErrors.length < 20) {
        state.recentErrors.push(`Record ${i}: ${msg}`);
      }
    }
  }

  const wasCancelled = state.cancelRequested;
  state.running = false;
  state.cancelRequested = false;
  state.completedAt = Date.now();
  state.status = wasCancelled ? "cancelled" : "completed";
  const elapsed = ((state.completedAt - (state.startedAt ?? state.completedAt)) / 1000).toFixed(1);
  logger.info(
    { created: state.created, failed: state.failed, elapsed: `${elapsed}s`, cancelled: wasCancelled },
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

  const creds = getCredentials();
  if (!creds) {
    res.status(500).json({
      error:
        "ServiceNow credentials are not configured. Set SN_INSTANCE and either SN_ADMIN_USERNAME/SN_ADMIN_PASSWORD or SN_USERNAME/SN_PASSWORD.",
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

  logger.info({ count, instance: creds.instance }, "Starting test data generation");

  runGeneration(count, creds).catch((err) => {
    logger.error({ err }, "Unhandled error in test data generation");
    state.running = false;
    state.cancelRequested = false;
    state.status = "completed";
    state.completedAt = Date.now();
  });

  res.status(202).json({
    running: state.running,
    status: state.status,
    total: state.total,
    created: state.created,
    failed: state.failed,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    recentErrors: state.recentErrors,
  });
});

router.post("/test-data/cancel", (_req, res) => {
  if (!state.running) {
    res.status(409).json({ error: "No generation is currently running." });
    return;
  }
  state.cancelRequested = true;
  logger.info("Cancel requested for test data generation");
  res.json({ message: "Cancel requested. Generation will stop after the current record." });
});

router.get("/test-data/status", (_req, res) => {
  res.json({
    running: state.running,
    status: state.status,
    total: state.total,
    created: state.created,
    failed: state.failed,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    recentErrors: state.recentErrors,
  });
});

export default router;
