# api_reach_test.py

import requests

INSTANCE = "https://dev311767.service-now.com"
# USERNAME = "admin"
# PASSWORD = "Z6vit/mZQ5F$"
USERNAME = "svc.api.reports"
PASSWORD = "2y=,(tI7<$jzFto5Z_iyoPc2G-$WRdx4{lc7}m;b(@TkOYtjW}EU68u18Yb{9OtIfL*$j4C}bnr6Izw-fDKZ:yg[L>J()rDvJvO."

response = requests.get(
    f"{INSTANCE}/api/now/table/incident",
    auth=(USERNAME, PASSWORD),
    headers={"Accept": "application/json"},
    params={"sysparm_limit": 1}
)

print(response.status_code)
print(response.json())

# response
'''
K:\minz\WebinarPython\Flask_Blog\WPy64-31131\scripts>python x:\ftrReport\api_reach_test.py
The directory name is invalid.
200
{'result': [{'promoted_by': '', 'parent': '', 'caused_by': '', 'watch_list': '', 'upon_reject': 'cancel', 'sys_updated_on': '2026-04-11 16:29:07', 'origin_table': '', 'approval_history': '', 'skills': '', 'number': 'INC0010414', 'proposed_by': '', 'lessons_learned': '', 'state': '7', 'sys_created_by': 'admin', 'knowledge': 'false', 'order': '', 'cmdb_ci': '', 'contract': '', 'impact': '3', 'active': 'false', 'work_notes_list': '', 'priority': '5', 'sys_domain_path': '/', 'business_duration': '1970-01-01 00:00:00', 'group_list': '', 'approval_set': '', 'major_incident_state': '', 'universal_request': '', 'short_description': 'Test incident 404 - auto generated for API testing', 'correlation_display': '', 'work_start': '', 'additional_assignee_list': '', 'notify': '1', 'service_offering': '', 'sys_class_name': 'incident', 'closed_by': {'link': 'https://dev311767.service-now.com/api/now/table/sys_user/6816f79cc0a8016401c5a33be04be441', 'value': '6816f79cc0a8016401c5a33be04be441'}, 'follow_up': '', 'parent_incident': '', 'reopened_by': '', 'reassignment_count': '0', 'assigned_to': '', 'sla_due': '', 'comments_and_work_notes': '', 'escalation': '0', 'upon_approval': 'proceed', 'correlation_id': '', 'timeline': '', 'made_sla': 'true', 'promoted_on': '', 'child_incidents': '0', 'hold_reason': '', 'task_effective_number': 'INC0010414', 'resolved_by': {'link': 'https://dev311767.service-now.com/api/now/table/sys_user/6816f79cc0a8016401c5a33be04be441', 'value': '6816f79cc0a8016401c5a33be04be441'}, 'sys_updated_by': 'admin', 'opened_by': {'link': 'https://dev311767.service-now.com/api/now/table/sys_user/6816f79cc0a8016401c5a33be04be441', 'value': '6816f79cc0a8016401c5a33be04be441'}, 'user_input': '', 'sys_created_on': '2026-04-11 16:29:07', 'sys_domain': {'link': 'https://dev311767.service-now.com/api/now/table/sys_user_group/global', 'value': 'global'}, 'proposed_on': '', 'actions_taken': '', 'route_reason': '', 'calendar_stc': '0', 'closed_at': '2026-04-11 16:29:07', 'business_service': '', 'business_impact': '', 'rfc': '', 'time_worked': '', 'expected_start': '', 'opened_at': '2026-04-11 16:29:07', 'work_end': '', 'caller_id': {'link': 'https://dev311767.service-now.com/api/now/table/sys_user/6816f79cc0a8016401c5a33be04be441', 'value': '6816f79cc0a8016401c5a33be04be441'}, 'reopened_time': '', 'resolved_at': '2026-04-11 16:29:07', 'subcategory': '', 'work_notes': '', 'close_code': 'Resolved by caller', 'assignment_group': '', 'business_stc': '0', 'cause': '', 'description': 'This is test record number 404 created for pagination testing.', 'origin_id': '', 'calendar_duration': '1970-01-01 00:00:00', 'close_notes': 'Closed by Caller', 'sys_id': '00206a37c3c00710a69db6fdd40131ef', 'contact_type': '', 'incident_state': '7', 'urgency': '3', 'problem_id': '', 'company': '', 'activity_due': '', 'severity': '3', 'overview': '', 'comments': '', 'approval': 'not requested', 'due_date': '', 'sys_mod_count': '0', 'reopen_count': '0', 'sys_tags': '', 'location': '', 'category': 'database'}]}
'''