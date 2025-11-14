import { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, 
  Clock, AlertTriangle, CheckCircle, Circle, X,
  PieChart, BarChart3, Target, Award
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SupportTicket {
  id: string;
  ticket_number: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  employee_id: string;
  assigned_to: string | null;
  created_at: string;
  sla_due_date: string | null;
  is_overdue: boolean;
  employees: {
    first_name: string;
    last_name: string;
    employee_code: string;
    department_id: string;
    departments?: {
      name: string;
    };
  };
  assigned_employee?: {
    first_name: string;
    last_name: string;
  };
}

interface DayTickets {
  date: Date;
  tickets: SupportTicket[];
  onTime: number;
  dueSoon: number;
  overdue: number;
}

const STATUS_CONFIG = {
  open: { label: 'Open', icon: Circle, color: 'text-blue-600 bg-blue-100' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
  waiting_on_customer: { label: 'Waiting on You', icon: AlertTriangle, color: 'text-orange-600 bg-orange-100' },
  resolved: { label: 'Resolved', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  closed: { label: 'Closed', icon: Circle, color: 'text-slate-600 bg-slate-100' },
  reopened: { label: 'Reopened', icon: AlertTriangle, color: 'text-red-600 bg-red-100' }
};

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700 border-red-300' }
];

interface HelpdeskCalendarProps {
  onTicketClick?: (ticketId: string) => void;
}

export function HelpdeskCalendar({ onTicketClick }: HelpdeskCalendarProps = {}) {
  const { membership, organization } = useAuth();
  const isAdmin = membership?.role && ['owner', 'admin', 'hr'].includes(membership.role);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayTickets, setSelectedDayTickets] = useState<SupportTicket[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [slaFilter, setSlaFilter] = useState('all');

  // Admin data
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);

  // SLA Analytics
  const [slaAnalytics, setSlaAnalytics] = useState({
    totalTickets: 0,
    onTime: 0,
    dueSoon: 0,
    overdue: 0,
    avgResolutionTime: 0,
    complianceRate: 0,
    byPriority: [] as { priority: string; onTime: number; overdue: number }[]
  });

  useEffect(() => {
    if (membership?.employee_id && organization?.id) {
      loadTickets();
      if (isAdmin) {
        loadAdminData();
      }
    }
  }, [membership, organization, isAdmin, currentDate]);

  const loadAdminData = async () => {
    if (!organization?.id) return;

    try {
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organization.id)
        .order('name');

      setDepartments(deptData || []);

      const { data: empData } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('organization_id', organization.id)
        .in('employment_status', ['active', 'probation'])
        .order('first_name');

      setEmployees(empData || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const loadTickets = async () => {
    if (!membership?.employee_id || !organization?.id) return;

    try {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          employees:employee_id (
            first_name,
            last_name,
            employee_code,
            department_id,
            departments (name)
          ),
          assigned_employee:assigned_to (
            first_name,
            last_name
          )
        `)
        .not('sla_due_date', 'is', null);

      if (isAdmin) {
        query = query.eq('organization_id', organization.id);
      } else {
        query = query.eq('employee_id', membership.employee_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data || []);
      calculateSLAAnalytics(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  };

  const calculateSLAAnalytics = (ticketData: SupportTicket[]) => {
    const now = new Date();
    const activeTickets = ticketData.filter(t => !['resolved', 'closed'].includes(t.status));

    let onTime = 0;
    let dueSoon = 0;
    let overdue = 0;

    activeTickets.forEach(t => {
      if (t.sla_due_date) {
        const dueDate = new Date(t.sla_due_date);
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilDue < 0) {
          overdue++;
        } else if (hoursUntilDue <= 24) {
          dueSoon++;
        } else {
          onTime++;
        }
      }
    });

    // Calculate avg resolution time
    const resolvedTickets = ticketData.filter(t => t.status === 'resolved' && t.sla_due_date);
    const totalResolutionTime = resolvedTickets.reduce((sum, t) => {
      const created = new Date(t.created_at).getTime();
      const due = new Date(t.sla_due_date!).getTime();
      return sum + (due - created);
    }, 0);
    const avgResolutionTime = resolvedTickets.length > 0
      ? totalResolutionTime / resolvedTickets.length / (1000 * 60 * 60)
      : 0;

    // Compliance rate
    const complianceRate = activeTickets.length > 0
      ? ((onTime + dueSoon) / activeTickets.length) * 100
      : 100;

    // By priority
    const priorityMap = new Map<string, { onTime: number; overdue: number }>();
    activeTickets.forEach(t => {
      if (!priorityMap.has(t.priority)) {
        priorityMap.set(t.priority, { onTime: 0, overdue: 0 });
      }
      const stats = priorityMap.get(t.priority)!;
      if (t.is_overdue) {
        stats.overdue++;
      } else {
        stats.onTime++;
      }
    });

    const byPriority = Array.from(priorityMap.entries()).map(([priority, stats]) => ({
      priority,
      ...stats
    }));

    setSlaAnalytics({
      totalTickets: activeTickets.length,
      onTime,
      dueSoon,
      overdue,
      avgResolutionTime,
      complianceRate,
      byPriority
    });
  };

  const getFilteredTickets = () => {
    return tickets.filter(ticket => {
      const matchesDepartment = !isAdmin || departmentFilter === 'all' || ticket.employees.department_id === departmentFilter;
      const matchesEmployee = !isAdmin || employeeFilter === 'all' || ticket.employee_id === employeeFilter;
      const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

      let matchesSLA = true;
      if (slaFilter !== 'all' && ticket.sla_due_date) {
        const now = new Date();
        const dueDate = new Date(ticket.sla_due_date);
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (slaFilter === 'overdue') {
          matchesSLA = hoursUntilDue < 0;
        } else if (slaFilter === 'due_soon') {
          matchesSLA = hoursUntilDue >= 0 && hoursUntilDue <= 24;
        } else if (slaFilter === 'on_time') {
          matchesSLA = hoursUntilDue > 24;
        }
      }

      return matchesDepartment && matchesEmployee && matchesCategory && matchesPriority && matchesSLA;
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: DayTickets[] = [];

    // Add empty days for alignment
    for (let i = 0; i < startingDayOfWeek; i++) {
      const emptyDate = new Date(year, month, -startingDayOfWeek + i + 1);
      days.push({ date: emptyDate, tickets: [], onTime: 0, dueSoon: 0, overdue: 0 });
    }

    // Add actual days
    const filteredTickets = getFilteredTickets();
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const dayTickets = filteredTickets.filter(t => {
        if (!t.sla_due_date) return false;
        const dueDate = new Date(t.sla_due_date);
        return dueDate.toDateString() === dayDate.toDateString();
      });

      const now = new Date();
      let onTime = 0;
      let dueSoon = 0;
      let overdue = 0;

      dayTickets.forEach(t => {
        if (t.sla_due_date) {
          const dueDate = new Date(t.sla_due_date);
          const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (hoursUntilDue < 0) {
            overdue++;
          } else if (hoursUntilDue <= 24) {
            dueSoon++;
          } else {
            onTime++;
          }
        }
      });

      days.push({ date: dayDate, tickets: dayTickets, onTime, dueSoon, overdue });
    }

    return days;
  };

  const handleDateClick = (day: DayTickets) => {
    if (day.tickets.length > 0) {
      setSelectedDate(day.date);
      setSelectedDayTickets(day.tickets);
      setShowSidebar(true);
    }
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getPriorityBadge = (priority: string) => {
    return PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* SLA Dashboard */}
      <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl shadow-md border border-pink-200 p-6">
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Target className="h-6 w-6 text-pink-600" />
          SLA Performance Dashboard
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-600">Active Tickets</p>
              <BarChart3 className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{slaAnalytics.totalTickets}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-green-600">On Time</p>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-green-600">{slaAnalytics.onTime}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-yellow-600">Due Soon</p>
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold text-yellow-600">{slaAnalytics.dueSoon}</p>
            <p className="text-xs text-slate-500 mt-1">Within 24 hours</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-red-600">Overdue</p>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-red-600">{slaAnalytics.overdue}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-blue-600">Compliance</p>
              <Award className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-blue-600">{slaAnalytics.complianceRate.toFixed(0)}%</p>
            <p className="text-xs text-slate-500 mt-1">SLA met</p>
          </div>
        </div>

        {/* SLA by Priority */}
        {slaAnalytics.byPriority.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              SLA Performance by Priority
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {slaAnalytics.byPriority.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-2">{item.priority}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-600">{item.onTime}</p>
                      <p className="text-xs text-slate-500">On Time</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-red-600">{item.overdue}</p>
                      <p className="text-xs text-slate-500">Overdue</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-5 w-5 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-700">Calendar Filters</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>

            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All Categories</option>
              <option value="technical">Technical/IT</option>
              <option value="hr">HR Related</option>
              <option value="admin">Admin/Facility</option>
              <option value="payroll">Payroll</option>
              <option value="leave">Leave</option>
              <option value="attendance">Attendance</option>
              <option value="access">Access</option>
              <option value="other">Other</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All SLA Status</option>
              <option value="on_time">On Time</option>
              <option value="due_soon">Due Soon (24h)</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-pink-600" />
            {formatDate(currentDate)}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={today}
              className="px-4 py-2 bg-pink-100 text-pink-700 rounded-lg text-sm font-semibold hover:bg-pink-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mb-4 p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-slate-700">On Time</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-slate-700">Due Soon (24h)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm text-slate-700">Overdue</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Weekday Headers */}
          {weekDays.map(day => (
            <div key={day} className="text-center font-semibold text-slate-600 text-sm py-2">
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {days.map((day, idx) => {
            const isCurrentMonth = day.date.getMonth() === currentDate.getMonth();
            const isToday = day.date.toDateString() === new Date().toDateString();
            const hasTickets = day.tickets.length > 0;

            return (
              <div
                key={idx}
                onClick={() => handleDateClick(day)}
                className={`
                  min-h-[100px] p-2 border rounded-lg transition-all
                  ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'}
                  ${isToday ? 'border-pink-500 border-2' : 'border-slate-200'}
                  ${hasTickets ? 'cursor-pointer hover:shadow-md hover:border-pink-300' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isToday ? 'text-pink-600' : 'text-slate-700'}`}>
                    {day.date.getDate()}
                  </span>
                  {hasTickets && (
                    <span className="text-xs font-bold text-slate-500">
                      {day.tickets.length}
                    </span>
                  )}
                </div>

                {/* SLA Indicators */}
                {hasTickets && (
                  <div className="flex flex-wrap gap-1">
                    {day.onTime > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-slate-600">{day.onTime}</span>
                      </div>
                    )}
                    {day.dueSoon > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="text-xs text-slate-600">{day.dueSoon}</span>
                      </div>
                    )}
                    {day.overdue > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-xs text-slate-600">{day.overdue}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar for Selected Date Tickets */}
      {showSidebar && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end z-50">
          <div className="bg-white w-full md:w-[500px] h-full shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <p className="text-sm text-slate-600">{selectedDayTickets.length} tickets due</p>
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {selectedDayTickets.map(ticket => {
                const StatusIcon = getStatusConfig(ticket.status).icon;
                const priorityBadge = getPriorityBadge(ticket.priority);
                const now = new Date();
                const dueDate = new Date(ticket.sla_due_date!);
                const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

                let slaColor = 'bg-green-100 border-green-300';
                let slaLabel = 'On Time';
                if (hoursUntilDue < 0) {
                  slaColor = 'bg-red-100 border-red-300';
                  slaLabel = 'Overdue';
                } else if (hoursUntilDue <= 24) {
                  slaColor = 'bg-yellow-100 border-yellow-300';
                  slaLabel = 'Due Soon';
                }

                return (
                  <div key={ticket.id} className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200 hover:border-pink-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-pink-600 text-sm">{ticket.ticket_number}</p>
                        <p className="font-semibold text-slate-900 mt-1">{ticket.subject}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${slaColor}`}>
                        {slaLabel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusConfig(ticket.status).color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {getStatusConfig(ticket.status).label}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${priorityBadge.color}`}>
                        {priorityBadge.label}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 mb-3">
                      <p><span className="font-semibold">Employee:</span> {ticket.employees.first_name} {ticket.employees.last_name}</p>
                      {isAdmin && ticket.employees.departments && (
                        <p><span className="font-semibold">Department:</span> {ticket.employees.departments.name}</p>
                      )}
                      {ticket.assigned_employee && (
                        <p><span className="font-semibold">Assigned:</span> {ticket.assigned_employee.first_name} {ticket.assigned_employee.last_name}</p>
                      )}
                      <p><span className="font-semibold">Due:</span> {dueDate.toLocaleString()}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (onTicketClick) {
                            onTicketClick(ticket.id);
                          }
                          setShowSidebar(false);
                        }}
                        className="flex-1 px-3 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 transition-colors"
                      >
                        View Details
                      </button>
                      {isAdmin && (
                        <button
                          className="px-3 py-2 border-2 border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                        >
                          Quick Action
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
