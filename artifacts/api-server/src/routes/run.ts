import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, reportConfigsTable, reportRunsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function recordsToCsv(records: Record<string, unknown>[]): string {
  if (records.length === 0) return "";
  const headers = Object.keys(records[0]);
  const rows = [
    headers.map(csvEscape).join(","),
    ...records.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];
  return rows.join("\r\n");
}

function buildFilename(title: string): string {
  const safe = title.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
  const ts = new Date()
    .toISOString()
    .replace(/T/, "_")
    .replace(/:/g, "-")
    .slice(0, 19);
  return `${safe}_${ts}.csv`;
}

router.post("/reports/:id/run", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid report id." });
    return;
  }

  const [report] = await db
    .select()
    .from(reportConfigsTable)
    .where(eq(reportConfigsTable.id, id));

  if (!report) {
    res.status(404).json({ error: `Report ${id} not found.` });
    return;
  }

  if (!report.verifiedTable) {
    res.status(400).json({
      error: "Report must be verified before running. Use the Verify button first.",
    });
    return;
  }

  const instance = process.env.SN_INSTANCE;
  const username = process.env.SN_USERNAME;
  const password = process.env.SN_PASSWORD;

  if (!instance || !username || !password) {
    res.status(500).json({
      error: "ServiceNow credentials are not configured. Set SN_INSTANCE, SN_USERNAME, and SN_PASSWORD.",
    });
    return;
  }

  const filterOverride = typeof req.body?.filter === "string" ? req.body.filter : undefined;
  const filterQuery = filterOverride ?? report.filterQuery;
  const selectedFields = report.fields;
  const table = report.verifiedTable;
  const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

  const [run] = await db
    .insert(reportRunsTable)
    .values({
      reportConfigId: id,
      reportName: report.name,
      status: "running",
      recordCount: 0,
    })
    .returning();

  logger.info({ runId: run.id, report: report.name, table, filter: filterQuery }, "Starting report run");

  const allRecords: Record<string, unknown>[] = [];
  const limit = 100;
  let offset = 0;
  let fetchError: string | null = null;

  while (true) {
    const params = new URLSearchParams({
      sysparm_query: filterQuery,
      sysparm_limit: String(limit),
      sysparm_offset: String(offset),
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
      ...(selectedFields ? { sysparm_fields: selectedFields } : {}),
    });

    const url = `${instance}/api/now/table/${encodeURIComponent(table)}?${params.toString()}`;
    const pageStart = Date.now();

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${basicAuth}`,
        },
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        fetchError = `ServiceNow returned HTTP ${response.status} at offset ${offset}: ${text.slice(0, 300)}`;
        logger.warn({ runId: run.id, offset, status: response.status }, "SN page fetch failed");
        break;
      }

      const body = await response.json() as { result?: Record<string, unknown>[] };
      const pageRecords = body.result ?? [];
      const elapsed = ((Date.now() - pageStart) / 1000).toFixed(2);

      logger.info({ runId: run.id, offset, count: pageRecords.length, elapsed: `${elapsed}s` }, "Page fetched");

      if (pageRecords.length === 0) break;

      allRecords.push(...pageRecords);

      await db
        .update(reportRunsTable)
        .set({ recordCount: allRecords.length })
        .where(eq(reportRunsTable.id, run.id));

      if (pageRecords.length < limit) break;
      offset += limit;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fetchError = `Request failed at offset ${offset}: ${msg}`;
      logger.error({ runId: run.id, offset, err }, "SN fetch error");
      break;
    }
  }

  if (fetchError) {
    await db
      .update(reportRunsTable)
      .set({
        status: "error",
        errorMessage: fetchError,
        completedAt: new Date(),
      })
      .where(eq(reportRunsTable.id, run.id));

    res.status(500).json({ error: fetchError });
    return;
  }

  await db
    .update(reportRunsTable)
    .set({
      status: "success",
      recordCount: allRecords.length,
      completedAt: new Date(),
    })
    .where(eq(reportRunsTable.id, run.id));

  logger.info({ runId: run.id, total: allRecords.length }, "Report run complete");

  const title = report.verifiedTitle ?? report.name;
  const filename = buildFilename(title);
  const csv = recordsToCsv(allRecords);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

router.get("/reports/:id/runs", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid report id." });
    return;
  }

  const [report] = await db
    .select({ id: reportConfigsTable.id })
    .from(reportConfigsTable)
    .where(eq(reportConfigsTable.id, id));

  if (!report) {
    res.status(404).json({ error: `Report ${id} not found.` });
    return;
  }

  const runs = await db
    .select()
    .from(reportRunsTable)
    .where(eq(reportRunsTable.reportConfigId, id))
    .orderBy(desc(reportRunsTable.startedAt));

  res.json(runs);
});

router.get("/reports/:id/runs/latest", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid report id." });
    return;
  }

  const [report] = await db
    .select({ id: reportConfigsTable.id })
    .from(reportConfigsTable)
    .where(eq(reportConfigsTable.id, id));

  if (!report) {
    res.status(404).json({ error: `Report ${id} not found.` });
    return;
  }

  const [latest] = await db
    .select()
    .from(reportRunsTable)
    .where(eq(reportRunsTable.reportConfigId, id))
    .orderBy(desc(reportRunsTable.startedAt))
    .limit(1);

  if (!latest) {
    res.status(404).json({ error: "No runs found for this report." });
    return;
  }

  res.json(latest);
});

export default router;
