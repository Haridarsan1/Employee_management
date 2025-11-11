import type { UserRole } from './database.types';

export interface Permissions {
  // Dashboard
  viewDashboard: boolean;
  viewAllEmployees: boolean;
  viewEmployeeDetails: boolean;
  addEmployee: boolean;
  editEmployee: boolean;
  deleteEmployee: boolean;

  // Attendance
  viewAttendance: boolean;
  markAttendance: boolean;
  editAttendance: boolean;

  // Leave
  viewLeaveRequests: boolean;
  approveLeave: boolean;
  rejectLeave: boolean;
  requestLeave: boolean;

  // Payroll
  viewPayroll: boolean;
  processPayroll: boolean;
  viewOwnPayslip: boolean;

  // Tasks
  viewAllTasks: boolean;
  assignTasks: boolean;
  viewOwnTasks: boolean;

  // Reports
  viewReports: boolean;
  generateReports: boolean;

  // Settings
  manageSettings: boolean;
  manageRoles: boolean;
}

const rolePermissions: Record<UserRole, Permissions> = {
  admin: {
    // Full access
    viewDashboard: true,
    viewAllEmployees: true,
    viewEmployeeDetails: true,
    addEmployee: true,
    editEmployee: true,
    deleteEmployee: true,
    viewAttendance: true,
    markAttendance: true,
    editAttendance: true,
    viewLeaveRequests: true,
    approveLeave: true,
    rejectLeave: true,
    requestLeave: true,
    viewPayroll: true,
    processPayroll: true,
    viewOwnPayslip: true,
    viewAllTasks: true,
    assignTasks: true,
    viewOwnTasks: true,
    viewReports: true,
    generateReports: true,
    manageSettings: true,
    manageRoles: true,
  },
  owner: {
    // Full access (same as admin)
    viewDashboard: true,
    viewAllEmployees: true,
    viewEmployeeDetails: true,
    addEmployee: true,
    editEmployee: true,
    deleteEmployee: true,
    viewAttendance: true,
    markAttendance: true,
    editAttendance: true,
    viewLeaveRequests: true,
    approveLeave: true,
    rejectLeave: true,
    requestLeave: true,
    viewPayroll: true,
    processPayroll: true,
    viewOwnPayslip: true,
    viewAllTasks: true,
    assignTasks: true,
    viewOwnTasks: true,
    viewReports: true,
    generateReports: true,
    manageSettings: true,
    manageRoles: true,
  },
  hr: {
    // HR focused permissions
    viewDashboard: true,
    viewAllEmployees: true,
    viewEmployeeDetails: true,
    addEmployee: true,
    editEmployee: true,
    deleteEmployee: false, // HR can't delete
    viewAttendance: true,
    markAttendance: false,
    editAttendance: true,
    viewLeaveRequests: true,
    approveLeave: true,
    rejectLeave: true,
    requestLeave: true,
    viewPayroll: true,
    processPayroll: false,
    viewOwnPayslip: true,
    viewAllTasks: true,
    assignTasks: true,
    viewOwnTasks: true,
    viewReports: true,
    generateReports: true,
    manageSettings: false,
    manageRoles: false,
  },
  finance: {
    // Finance focused permissions
    viewDashboard: true,
    viewAllEmployees: false,
    viewEmployeeDetails: false,
    addEmployee: false,
    editEmployee: false,
    deleteEmployee: false,
    viewAttendance: false,
    markAttendance: false,
    editAttendance: false,
    viewLeaveRequests: false,
    approveLeave: false,
    rejectLeave: false,
    requestLeave: true,
    viewPayroll: true,
    processPayroll: true,
    viewOwnPayslip: true,
    viewAllTasks: false,
    assignTasks: false,
    viewOwnTasks: true,
    viewReports: true,
    generateReports: true,
    manageSettings: false,
    manageRoles: false,
  },
  manager: {
    // Manager permissions
    viewDashboard: true,
    viewAllEmployees: true, // Can view team
    viewEmployeeDetails: true,
    addEmployee: false,
    editEmployee: false,
    deleteEmployee: false,
    viewAttendance: true,
    markAttendance: false,
    editAttendance: false,
    viewLeaveRequests: true,
    approveLeave: true,
    rejectLeave: true,
    requestLeave: true,
    viewPayroll: false,
    processPayroll: false,
    viewOwnPayslip: true,
    viewAllTasks: true,
    assignTasks: true,
    viewOwnTasks: true,
    viewReports: false,
    generateReports: false,
    manageSettings: false,
    manageRoles: false,
  },
  employee: {
    // Basic employee permissions
    viewDashboard: true,
    viewAllEmployees: false,
    viewEmployeeDetails: false,
    addEmployee: false,
    editEmployee: false,
    deleteEmployee: false,
    viewAttendance: false,
    markAttendance: true,
    editAttendance: false,
    viewLeaveRequests: false,
    approveLeave: false,
    rejectLeave: false,
    requestLeave: true,
    viewPayroll: false,
    processPayroll: false,
    viewOwnPayslip: true,
    viewAllTasks: false,
    assignTasks: false,
    viewOwnTasks: true,
    viewReports: false,
    generateReports: false,
    manageSettings: false,
    manageRoles: false,
  },
};

export function getPermissions(role: UserRole | null): Permissions {
  if (!role) {
    // Default to employee permissions for safety
    return rolePermissions.employee;
  }
  return rolePermissions[role] || rolePermissions.employee;
}

export function hasPermission(role: UserRole | null, permission: keyof Permissions): boolean {
  const permissions = getPermissions(role);
  return permissions[permission];
}

export function canAccessPage(role: UserRole | null, page: string): boolean {
  const permissions = getPermissions(role);

  switch (page) {
    case 'dashboard':
      return permissions.viewDashboard;
    case 'employees':
      return permissions.viewAllEmployees;
    case 'attendance':
      return permissions.viewAttendance;
    case 'leave':
      return permissions.viewLeaveRequests || permissions.requestLeave;
    case 'payroll':
      return permissions.viewPayroll || permissions.viewOwnPayslip;
    case 'tasks':
      return permissions.viewAllTasks || permissions.viewOwnTasks;
    case 'reports':
      return permissions.viewReports;
    case 'settings':
      return permissions.manageSettings;
    default:
      return true;
  }
}