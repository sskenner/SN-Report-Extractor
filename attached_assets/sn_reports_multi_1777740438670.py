# sn_reports_esddaitix.py
# automates downloading ServiceNow usere-created reports as CSV files

import os
import requests
import csv
import logging
from datetime import datetime
import time

# --- configuration ---

INSTANCE = "https://dev311767.service-now.com"

#TODO explore environment vars vs win cred mgr vs secrets vault
# USERNAME = "admin"
# PASSWORD = "Z6vit/mZQ5F$"
USERNAME = "svc.api.reports"
PASSWORD = "2y=,(tI7<$jzFto5Z_iyoPc2G-$WRdx4{lc7}m;b(@TkOYtjW}EU68u18Yb{9OtIfL*$j4C}bnr6Izw-fDKZ:yg[L>J()rDvJvO."

# add report sys_ids to scale up
REPORTS = {
    #TODO verify each reports table requirement ie incident, sys_report
    "ESD Daily Tickets": {
        # url sys_id that identifies report
        "sys_id": "77803133c34cc310a69db6fdd4013190",
        "filter": (
            # "opened_atONYesterday@javascript:gs.beginningOfYesterday()"
            # "opened_atONLast 7 days@javascript:gs.beginningOfLast7Days()@javascript:gs.endOfLast7Days()"
            # "numberLIKEINC^ORnumberLIKETASK^opened_atONLast 7 days@javascript:gs.beginningOfLast7Days()@javascript:gs.endOfLast7Days()"
            # "numberLIKETASK^opened_atONLast 7 days@javascript:gs.beginningOfLast7Days()@javascript:gs.endOfLast7Days()"
            # "numberLIKEINC^opened_atONLast 7 days@javascript:gs.beginningOfLast7Days()@javascript:gs.endOfLast7Days()"
            # "^opened_by.nameISNOTNetcool Integration"
        ),
        # fields required for specific report(s)
        "fields": (
            "number,sys_class_name,ref_incident.u_request_type,"
            "assignment_group,assigned_to,assigned_to.email,"
            "assigned_to.user_name,u_owner_group,u_owner,"
            "u_owner.email,u_owner.manager,state,"
            "reassignment_count,ref_incident.reopen_count,"
            "contact_type,cmdb_ci,opened_at,sys_created_by,"
            "opened_by,opened_by.email,opened_by.manager,"
            "ref_incident.resolved_by,"
            "ref_incident.resolved_by.user_name,"
            "sys_updated_on,u_owner.user_name"
        ),
    },
    "ESD Daily Tix": {
        # url sys_id that identifies report
        "sys_id": "a33f3860c3584b10a69db6fdd401311e",
        "filter": (
            # "opened_atONYesterday@javascript:gs.beginningOfYesterday()"
            # "opened_atONLast 7 days@javascript:gs.beginningOfLast7Days()@javascript:gs.endOfLast7Days()"
            # "numberLIKEINC^ORnumberLIKETASK^opened_atONLast 7 days@javascript:gs.beginningOfLast7Days()@javascript:gs.endOfLast7Days()"
            # "numberLIKETASK^opened_atONLast 7 days@javascript:gs.beginningOfLast7Days()@javascript:gs.endOfLast7Days()"
            "numberLIKEINC^opened_atONLast 7 days@javascript:gs.beginningOfLast7Days()@javascript:gs.endOfLast7Days()"
            # "^opened_by.nameISNOTNetcool Integration"
        ),
        # fields required for specific report(s)
        "fields": (
            "number,assignment_group,assigned_to,state,contact_type,cmdb_ci,opened_at,opened_by,reassignment_count,sys_class_name"
        ),
    },
    # "ESD Daily ???": {
    #     "sys_id": "???",
    #     "fields": (
    #         "???,???,..."
    #     ),
    # },
}

# --- logging setup ---

# log to both console and file for auditing/troubleshooting
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(), # print to console
        logging.FileHandler("sn_reports.log", mode="a") # append to log file
    ]
)
logger = logging.getLogger(__name__)

# Step 1 & 2: Fetch the report metadata (fields required to understand the report) from sys_report table
def get_report_definition(report_name, report_sys_id):
    """step 1 & 2: Fetch the report metadata from sys_report table"""

    logger.info(f"fetching report definition for: {report_name}")

    try:
        response = requests.get(
            f"{INSTANCE}/api/now/table/sys_report/{report_sys_id}",
            auth=(USERNAME, PASSWORD),
            headers={"Accept": "application/json"}, # Request JSON response
            # params= {
            #     #"sysparm_limit": 1
            # },
            params= {
                # Return fields required to understand the report
                "sysparm_fields": "sys_id,title,table,field,type,content"
            },
            timeout=30 # 30 secs
        )

        # check for auth or connection errors
        response.raise_for_status()

        '''
        example response:
        {
            "result": {
                "sys_id": "3D9c168ba11bcb79102e578622dd4bcb2a",
                "title": "ESD Daily Tickets - DNA Dashboard",
                "table": "task",
                "filter": "numberCONTAINSSCTASK^ORnumberCONTAINSINC^ORnumberCONTAINSREQ^opened_by!=netcool_integration",
                "type": "list",
                "field": ""
            }
        }
        '''
    
    # Error handling
    except requests.exceptions.Timeout:
        logger.error(f"request timed out for report: {report_name}")
        return None
    except requests.exceptions.ConnectionError:
        logger.error(f"cannot connect to {INSTANCE}. Check network/VPN")
        return None
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error for report {report_name}: {e}")
        return None
    
    print(response.status_code)
    print(response.text[:500])

    # Extract the report definition from the response
    report = response.json().get("result")
    if not report:
        logger.error(f"No report found with sys_id: {report_sys_id}")
        return None
    
    logger.info(f"report '{report.get('title')}' - table: {report.get('table')}")
    return report

# Step 3: pull all matching records using pagination
def fetch_report_data(table, filter_query, selected_fields):
    """step 3: pull all matching records using pagination"""

    all_records = [] # Store all records across pages
    limit = 100 # Max recs per request (SN max?)
    offset = 0 # Starting record index

    while True:
        try:
            # Query the report's table using the report's filter
            start = time.time()
            response = requests.get(
                f"{INSTANCE}/api/now/table/{table}",
                auth=(USERNAME, PASSWORD),
                headers={"Accept": "application/json"},
                params={
                    "sysparm_query": filter_query, # Saved report's filter
                    "sysparm_limit": limit, # Recs per page
                    "sysparm_offset": offset, # Pagination offset
                    "sysparm_display_value": "true", # Return readable values
                    "sysparm_exclude_reference_link": "true", # Skip ref URLs for cleaner data
                    "sysparm_fields": selected_fields, # Only return selected columns
                },
                # timeout=0.1
                timeout=60 # longer timeout for data queries
            )

            # check for errors
            response.raise_for_status()
            elapsed = time.time() - start
            logger.info(f"Page at offset {offset} fetched in {elapsed:.2f} seconds")

        # Error handling
        except requests.exceptions.Timeout:
            logger.error(f"data request timed out at offset {offset}")
            break
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error fetching data at offset {offset}: {e}")
            break

        # Parse JSON response
        results = response.json().get("result", [])

        # If no recs returned, reached the end
        if not results:
            break

        # Add this page of recs to full list
        all_records.extend(results)
        logger.info(f"Fetched {len(all_records)} records so far...")

        # Move to next page
        offset += limit

    logger.info(f"Tot recs fetched: {len(all_records)}")
    return all_records

# Step 4: Write records to timestamped CSV
def save_to_csv(records, report_title):
    """step 4: Write records to timestamped CSV"""
    if not records:
        logger.warning("no recs found - CSV not created")
        return None
    
    # build filename: sanitize title + add today's date??
    #TODO modify for yesterdays date filter
    safe_title = report_title.replace(" ", "_").replace("/", "-")
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"{safe_title}_{timestamp}.csv"

    # Get column headers from the first record's keys
    headers = list(records[0].keys())

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)

        # Write the header row
        writer.writeheader()

        # Write each record as a row
        writer.writerows(records)
    
    logger.info(f"CSV saved to: {filename}")
    return filename

# Main function: fetches report definition, pulls data, saves CSV
def run_report(report_name, report_sys_id, selected_fields):
    """main function: fetches report definition, pulls data, saves CSV"""

    logger.info(f"{'='*50}")
    logger.info(f"starting report: {report_name} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"{'='*50}")

    # step 1 & 2: get report definition??
    report = get_report_definition(report_name, report_sys_id)
    if not report:
        return
    
    # extract table and filter from report metadata
    table = report["table"]
    # table = config["table"] # ?? difference
    filter_query = config["filter"]
    # filter_query = report["filter"]

    # step 3: fetch actual data
    records = fetch_report_data(table, filter_query, selected_fields)
    # records = fetch_report_data(table, filter_query, config["fields"]) # difference

    # step 4: save to CSV
    save_to_csv(records, report.get("title", report_name))

# --- main entry point ---
if __name__ == "__main__":
    script_start = time.time()


    # run each report with its own selected columns
    for name, config in REPORTS.items():
        run_report(name, config["sys_id"], config["fields"])
    
    total = time.time() - script_start
    logger.info(f"All reports complete. Total execution time: {total:.2f} seconds")