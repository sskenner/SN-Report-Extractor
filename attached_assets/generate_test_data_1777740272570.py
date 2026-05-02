# generate_test_data.py
# Creates ~2000 sample incident records in your PDI for testing

import requests
import logging
import time

# --- Configuration ---
INSTANCE = "https://dev311767.service-now.com"
USERNAME = "admin"           # Use admin to create records
PASSWORD = "Z6vit/mZQ5F$"
# TOTAL_RECORDS = 50
TOTAL_RECORDS = 2000
BATCH_LOG_INTERVAL = 100     # Log progress every 100 records

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# --- Sample data to vary records ---
CATEGORIES = ["Software", "Hardware", "Network", "Inquiry / Help", "Database"]
PRIORITIES = ["1 - Critical", "2 - High", "3 - Moderate", "4 - Low"]
STATES = ["New", "In Progress", "On Hold", "Resolved", "Closed"]

def create_incident(i):
    # report_sys_id = "77803133c34cc310a69db6fdd4013190"
    """Create a single test incident record."""
    payload = {
        "short_description": f"Test incident {i} - auto generated for API testing",
        "category": CATEGORIES[i % len(CATEGORIES)],
        "priority": PRIORITIES[i % len(PRIORITIES)],
        "state": STATES[i % len(STATES)],
        "caller_id": "admin",
        "description": f"This is test record number {i} created for pagination testing."
    }

    response = requests.post(
        f"{INSTANCE}/api/now/table/incident",
        # f"{INSTANCE}/api/now/table/sys_report/{report_sys_id}",
        auth=(USERNAME, PASSWORD),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        json=payload,
        timeout=30
    )
    response.raise_for_status()
    return response.json().get("result", {}).get("number")

# --- Main ---
if __name__ == "__main__":
    logger.info(f"Starting generation of {TOTAL_RECORDS} test incidents...")
    script_start = time.time()
    created = 0

    for i in range(1, TOTAL_RECORDS + 1):
        try:
            number = create_incident(i)
            created += 1
            if created % BATCH_LOG_INTERVAL == 0:
                elapsed = time.time() - script_start
                logger.info(f"Created {created} records so far... ({elapsed:.1f}s elapsed)")
        except Exception as e:
            logger.error(f"Failed to create record {i}: {e}")

    total = time.time() - script_start
    logger.info(f"Done! Created {created} records in {total:.2f} seconds.")
