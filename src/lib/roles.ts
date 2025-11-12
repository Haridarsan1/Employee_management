const roles = {
  OWNER: {
    permissions: [
      'manage_employees',
      'manage_tasks',
      'view_tasks',
      'approve_leave',
      'view_leave_records',
      'manage_payroll',
      'approve_expenses',
      'review_performance',
      'assign_training',
      'view_helpdesk_tickets',
      'manage_announcements',
      'monitor_github',
      'generate_reports',
      'manage_settings'
    ]
  },
  EMPLOYEE: {
    permissions: [
      'view_own_profile',
      'view_assigned_tasks',
      'request_leave',
      'view_payroll',
      'submit_expenses',
      'view_performance_review',
      'view_training',
      'raise_helpdesk_tickets',
      'view_announcements',
      'view_github_integration'
    ]
  }
};

export default roles;