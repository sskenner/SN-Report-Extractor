import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, reportConfigsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

router.get("/reports", async (req, res) => {
  try {
    const reports = await db
      .select()
      .from(reportConfigsTable)
      .orderBy(reportConfigsTable.createdAt);
    res.json(reports);
  } catch (err) {
    logger.error({ err }, "Failed to list reports");
    res.status(500).json({ error: "Failed to fetch report configurations." });
  }
});

router.post("/reports", async (req, res) => {
  const { name, sysId, filterQuery = "", fields = "" } = req.body ?? {};

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required." });
    return;
  }
  if (!sysId || typeof sysId !== "string" || !sysId.trim()) {
    res.status(400).json({ error: "sysId is required." });
    return;
  }

  try {
    const [created] = await db
      .insert(reportConfigsTable)
      .values({ name: name.trim(), sysId: sysId.trim(), filterQuery, fields })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "Failed to create report");
    res.status(500).json({ error: "Failed to create report configuration." });
  }
});

router.put("/reports/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid report id." });
    return;
  }

  const { name, sysId, filterQuery, fields } = req.body ?? {};
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) patch.name = name;
  if (sysId !== undefined) patch.sysId = sysId;
  if (filterQuery !== undefined) patch.filterQuery = filterQuery;
  if (fields !== undefined) patch.fields = fields;

  try {
    const [updated] = await db
      .update(reportConfigsTable)
      .set(patch)
      .where(eq(reportConfigsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: `Report ${id} not found.` });
      return;
    }
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Failed to update report");
    res.status(500).json({ error: "Failed to update report configuration." });
  }
});

router.delete("/reports/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid report id." });
    return;
  }

  try {
    const [deleted] = await db
      .delete(reportConfigsTable)
      .where(eq(reportConfigsTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: `Report ${id} not found.` });
      return;
    }
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete report");
    res.status(500).json({ error: "Failed to delete report configuration." });
  }
});

router.post("/reports/:id/verify", async (req, res) => {
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

  const instance = process.env.SN_INSTANCE;
  const username = process.env.SN_USERNAME;
  const password = process.env.SN_PASSWORD;

  if (!instance || !username || !password) {
    res.status(500).json({
      error: "ServiceNow credentials are not configured. Set SN_INSTANCE, SN_USERNAME, and SN_PASSWORD secrets.",
    });
    return;
  }

  try {
    const url = `${instance}/api/now/table/sys_report/${report.sysId}?sysparm_fields=sys_id,title,table,type`;
    const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn({ status: response.status, sysId: report.sysId }, "ServiceNow sys_report lookup failed");
      res.status(500).json({
        error: `ServiceNow returned HTTP ${response.status}: ${text.slice(0, 200)}`,
      });
      return;
    }

    const body = await response.json() as { result?: { title?: string; table?: string } };
    const result = body.result;

    if (!result) {
      res.status(500).json({ error: "ServiceNow returned an empty result. The sys_id may be invalid." });
      return;
    }

    const [updated] = await db
      .update(reportConfigsTable)
      .set({
        verifiedTitle: result.title ?? null,
        verifiedTable: result.table ?? null,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reportConfigsTable.id, id))
      .returning();

    logger.info({ id, title: result.title, table: result.table }, "Report verified");
    res.json(updated);
  } catch (err) {
    logger.error({ err, id }, "Failed to verify report");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to verify report against ServiceNow.",
    });
  }
});

export default router;
