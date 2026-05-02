# api_interaction_test.py

import requests

INSTANCE = "https://dev311767.service-now.com"
# USERNAME = "admin"
# PASSWORD = "Z6vit/mZQ5F$"
USERNAME = "svc.api.reports"
PASSWORD = "2y=,(tI7<$jzFto5Z_iyoPc2G-$WRdx4{lc7}m;b(@TkOYtjW}EU68u18Yb{9OtIfL*$j4C}bnr6Izw-fDKZ:yg[L>J()rDvJvO."

response = requests.get(
    f"{INSTANCE}/api/now/table/sys_report",
    auth=(USERNAME, PASSWORD),
    headers={"Accept": "application/json"},
    params={
        "sysparm_query": "titleLIKEESDDailyTix",
        "sysparm_fields": "sys_id,title,table,filter, type, content"
    }
    # params={"sysparm_limit": 1}
)

print(response.status_code)
print(response.json())

