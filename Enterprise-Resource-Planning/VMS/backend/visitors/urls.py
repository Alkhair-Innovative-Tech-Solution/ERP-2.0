from django.urls import path
from . import views

urlpatterns = [
    # QR / Public endpoints (no auth)
    path('qr/checkin/', views.qr_checkin),
    path('visits/status/<uuid:visit_id>/', views.visit_status),
    path('visits/verify/<str:identifier>/', views.visit_verify),

    # Visits — specific named paths MUST come before UUID catch-alls
    path('visits/receptionist-entry/', views.receptionist_entry),
    path('visits/schedule/', views.schedule_visit),
    path('visits/scheduled-entry/', views.scheduled_entry),
    path('visits/approve/<uuid:visit_id>/', views.approve_visit),
    path('visits/reject/<uuid:visit_id>/', views.reject_visit),
    path('visits/checkout/<uuid:visit_id>/', views.checkout_visit),
    path('visits/<uuid:visit_id>/update-host/', views.update_visit_host),
    path('visits/<uuid:visit_id>/overwrite/', views.overwrite_visit),
    path('visits/<uuid:visit_id>/send-card-email/', views.send_card_email),
    path('visits/<uuid:visit_id>/whatsapp-link/', views.whatsapp_card_link),
    path('visits/', views.visit_list),
    path('visits/<uuid:visit_id>/', views.visit_detail),

    # Visitors — specific paths before UUID catch-alls
    path('visitors/search/', views.search_visitor),
    path('visitors/check-cnic/', views.check_cnic_api),
    path('visitors/check-duplicate/', views.check_duplicate_api),
    path('visitors/blacklisted/', views.blacklisted_visitors),
    path('visitors/', views.visitor_list),
    path('visitors/<uuid:visitor_id>/history/', views.visitor_history),
    path('visitors/<uuid:visitor_id>/blacklist/', views.blacklist_visitor),
    path('visitors/<uuid:visitor_id>/unblacklist/', views.unblacklist_visitor),

    # Hosts & Employees
    path('hosts/from-employee/', views.create_host_from_employee),
    path('hosts/', views.host_list),
    path('employees/', views.employee_list),
    path('employees/<str:employee_id>/', views.employee_detail),  # str: supports IAK-0001 format
    path('departments/', views.department_list),

    # Dashboard / Reports
    path('dashboard/stats/', views.dashboard_stats),
    path('companies/', views.company_report),
    path('companies/<str:company_name>/', views.company_detail),
    path('export/visits/', views.export_visits_csv),
    path('utils/check-overnight/', views.check_overnight),
]
