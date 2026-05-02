import { db, reportConfigsTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_REPORTS = [
  {
    name: "ESD Daily Tickets",
    sysId: "77803133c34cc310a69db6fdd4013190",
    filterQuery: "",
    fields:
      "number,sys_class_name,ref_incident.u_request_type," +
      "assignment_group,assigned_to,assigned_to.email," +
      "assigned_to.user_name,u_owner_group,u_owner," +
      "u_owner.email,u_owner.manager,state," +
      "reassignment_count,ref_incident.reopen_count," +
      "contact_type,cmdb_ci,opened_at,sys_created_by," +
      "opened_by,opened_by.email,opened_by.manager," +
      "ref_incident.resolved_by," +
      "ref_incident.resolved_by.user_name," +
      "sys_updated_on,u_owner.user_name",
  },
  {
    name: "ESD Daily Tix",
    sysId: "a33f3860c3584b10a69db6fdd401311e",
    filterQuery:
      "numberLIKEINC^opened_atONLast 7 days@javascript:gs.beginningOfLast7Days()@javascript:gs.endOfLast7Days()",
    fields:
      "number,assignment_group,assigned_to,state,contact_type,cmdb_ci,opened_at,opened_by,reassignment_count,sys_class_name",
  },
];

export async function seedDefaultReports(): Promise<void> {
  try {
    const existing = await db.select().from(reportConfigsTable);
    if (existing.length > 0) {
      logger.info({ count: existing.length }, "report_configs already has data — skipping seed");
      return;
    }

    await db.insert(reportConfigsTable).values(DEFAULT_REPORTS);
    logger.info({ count: DEFAULT_REPORTS.length }, "Seeded default report configurations");
  } catch (err) {
    logger.error({ err }, "Failed to seed default reports");
  }
}
