import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

router.get("/servicenow/config", (req, res) => {
  const instance = process.env.SN_INSTANCE;
  if (!instance) {
    res.status(500).json({ error: "SN_INSTANCE secret is not configured." });
    return;
  }
  res.json({ instance });
});

router.get("/servicenow/ping", async (req, res) => {
  const instance = process.env.SN_INSTANCE;
  const username = process.env.SN_USERNAME;
  const password = process.env.SN_PASSWORD;

  if (!instance || !username || !password) {
    res.status(500).json({
      error:
        "ServiceNow credentials are not configured. Set SN_INSTANCE, SN_USERNAME, and SN_PASSWORD secrets.",
    });
    return;
  }

  const start = Date.now();

  try {
    const url = `${instance}/api/now/table/incident?sysparm_limit=1`;
    const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      logger.warn(
        { status: response.status, instance },
        "ServiceNow ping failed with non-OK status"
      );
      res.json({
        ok: false,
        instance,
        latencyMs,
        error: `HTTP ${response.status}: ${response.statusText}`,
      });
      return;
    }

    logger.info({ instance, latencyMs }, "ServiceNow ping succeeded");
    res.json({ ok: true, instance, latencyMs });
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const message =
      err instanceof Error ? err.message : "Unknown connection error";
    logger.error({ err, instance }, "ServiceNow ping error");
    res.json({ ok: false, instance: instance ?? "", latencyMs, error: message });
  }
});

export default router;
