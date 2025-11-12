import { useEffect, useState } from 'react';
import { XCircle, Users, Search, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AttendanceManageModalProps {
  open: boolean;
  onClose: () => void;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  department_id: string | null;
  departments?: { name: string } | null;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
}

export function AttendanceManageModal({ open, onClose }: AttendanceManageModalProps) {
  console.log('AttendanceManageModal rendered');
  const { organization, membership } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');

  useEffect(() => {
    if (open && organization?.id) {
      loadData();

      // Set up real-time subscription for attendance changes
      const channel = supabase.channel(`attendance-modal-${date}`, {
        config: {
          broadcast: { self: true }
        }
      });

      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records' },
        (payload) => {
          console.log('Attendance record changed in modal:', payload);
          loadData(); // Reload data when attendance changes
        }
      );

      channel.subscribe((status) => {
        console.log('Attendance modal real-time status:', status);
      });

      return () => {
        supabase.removeChannel(channel);
      };
    }
    // eslint-disable-next-line
  }, [open, organization, date]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!organization?.id) return;

      // Load all active employees with departments
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, department_id, departments:departments!employees_department_id_fkey(name)')
        .eq('organization_id', organization.id)
        .eq('employment_status', 'active')
        .order('first_name');

      if (empError) throw empError;
      setEmployees(empData || []);

      // Load attendance records for the selected date
      const { data: attData, error: attError } = await supabase
        .from('attendance_records')
        .select('id, employee_id, status, check_in_time, check_out_time')
        .eq('attendance_date', date)
        .in('employee_id', (empData || []).map(e => e.id));

      if (attError) throw attError;
      setAttendanceRecords(attData || []);

      // Load departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organization.id)
        .order('name');

      if (deptError) throw deptError;
      setDepartments(deptData || []);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error loading data:', error.message, error.stack);
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        // Supabase/PostgrestError
        console.error('Error loading data:', (error as any).message, (error as any).details || '', (error as any).hint || '', (error as any).code || '');
      } else {
        console.error('Error loading data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceForEmployee = (empId: string) => {
    return attendanceRecords.find(r => r.employee_id === empId);
  };

  const handleMarkAttendance = async (employeeId: string, status: string) => {
    console.log('handleMarkAttendance called:', { organization, membership, employeeId, status });
    if (!organization?.id || !membership) {
      console.warn('❌ Cannot mark attendance - missing organization or membership:', { organization, membership });
      return;
    }
    setLoading(true);
    try {
      console.log('📝 Marking attendance for employee:', { employeeId, status, date });
      const existing = getAttendanceForEmployee(employeeId);
      
      if (existing) {
        // Update existing record
        console.log('Updating existing attendance record:', existing.id);
        const { error } = await supabase
          .from('attendance_records')
          .update({ status })
          .eq('id', existing.id);
        if (error) throw error;
        console.log('✅ Attendance updated successfully');
      } else {
        // Insert new record
        console.log('Creating new attendance record for employee:', employeeId);
        const { error } = await supabase
          .from('attendance_records')
          .insert({
            employee_id: employeeId,
            attendance_date: date,
            status,
            is_manual_entry: true,
            marked_by: membership.employee_id || membership.user_id
          });
        if (error) throw error;
        console.log('✅ Attendance created successfully for employee:', employeeId);
      }

      await loadData();
    } catch (error) {
      console.error('❌ Error marking attendance for employee:', employeeId, error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedEmployees.size === 0) return;
    setLoading(true);
    try {
      for (const empId of Array.from(selectedEmployees)) {
        await handleMarkAttendance(empId, bulkAction);
      }
      setSelectedEmployees(new Set());
      setBulkAction('');
    } catch (error) {
      console.error('Error in bulk action:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployeeSelection = (empId: string) => {
    const newSet = new Set(selectedEmployees);
    if (newSet.has(empId)) {
      newSet.delete(empId);
    } else {
      newSet.add(empId);
    }
    setSelectedEmployees(newSet);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = searchTerm === '' || 
      `${emp.first_name} ${emp.last_name} ${emp.employee_code}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDepartment === 'all' || emp.department_id === selectedDepartment;
    return matchesSearch && matchesDept;
  });

  const stats = {
    total: filteredEmployees.length,
    present: filteredEmployees.filter(e => getAttendanceForEmployee(e.id)?.status === 'present').length,
    absent: filteredEmployees.filter(e => getAttendanceForEmployee(e.id)?.status === 'absent').length,
    notMarked: filteredEmployees.filter(e => !getAttendanceForEmployee(e.id)).length,
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn overflow-y-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8 animate-scaleIn relative max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/80 transition-colors z-10">
            <XCircle className="h-6 w-6 text-slate-600" />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Manage Attendance</h2>
              <p className="text-sm text-slate-600">Mark and manage employee attendance</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Total Employees</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 shadow-sm border border-emerald-200">
              <p className="text-xs text-emerald-700 font-medium">Present</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.present}</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 shadow-sm border border-rose-200">
              <p className="text-xs text-rose-700 font-medium">Absent</p>
              <p className="text-2xl font-bold text-rose-700">{stats.absent}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 shadow-sm border border-amber-200">
              <p className="text-xs text-amber-700 font-medium">Not Marked</p>
              <p className="text-2xl font-bold text-amber-700">{stats.notMarked}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
              <select 
                value={selectedDepartment} 
                onChange={e => setSelectedDepartment(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search employees..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedEmployees.size > 0 && (
            <div className="mt-3 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <span className="text-sm font-semibold text-blue-900">{selectedEmployees.size} selected</span>
              <select 
                value={bulkAction} 
                onChange={e => setBulkAction(e.target.value)}
                className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select action...</option>
                <option value="present">Mark Present</option>
                <option value="absent">Mark Absent</option>
                <option value="half_day">Mark Half Day</option>
                <option value="work_from_home">Mark WFH</option>
              </select>
              <button 
                onClick={handleBulkAction}
                disabled={!bulkAction}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
              <button 
                onClick={() => setSelectedEmployees(new Set())}
                className="ml-auto text-sm text-slate-600 hover:text-slate-900"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>

        {/* Employee List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
              <p className="text-slate-500 mt-4">Loading employees...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No employees found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-left">
                      <input 
                        type="checkbox" 
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployees(new Set(filteredEmployees.map(emp => emp.id)));
                          } else {
                            setSelectedEmployees(new Set());
                          }
                        }}
                        checked={selectedEmployees.size === filteredEmployees.length && filteredEmployees.length > 0}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">Employee</th>
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">Department</th>
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">Check In</th>
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">Check Out</th>
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">Status</th>
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const attendance = getAttendanceForEmployee(emp.id);
                    const isSelected = selectedEmployees.has(emp.id);
                    return (
                      <tr key={emp.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                        <td className="py-3 px-4">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => toggleEmployeeSelection(emp.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-semibold text-slate-900">{emp.first_name} {emp.last_name}</p>
                            <p className="text-xs text-slate-500">{emp.employee_code}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{emp.departments?.name || '-'}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {attendance?.check_in_time ? new Date(attendance.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {attendance?.check_out_time ? new Date(attendance.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {attendance ? (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              attendance.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                              attendance.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                              attendance.status === 'half_day' ? 'bg-amber-100 text-amber-700' :
                              attendance.status === 'work_from_home' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {attendance.status.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">Not Marked</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            <button 
                              onClick={() => { console.log('Present button clicked for', emp.id); handleMarkAttendance(emp.id, 'present'); }}
                              className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 text-xs font-semibold"
                              title="Mark Present"
                            >
                              ✓
                            </button>
                            <button 
                              onClick={() => { console.log('Absent button clicked for', emp.id); handleMarkAttendance(emp.id, 'absent'); }}
                              className="px-2 py-1 bg-rose-100 text-rose-700 rounded hover:bg-rose-200 text-xs font-semibold"
                              title="Mark Absent"
                            >
                              ✗
                            </button>
                            <button 
                              onClick={() => { console.log('Half Day button clicked for', emp.id); handleMarkAttendance(emp.id, 'half_day'); }}
                              className="px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 text-xs font-semibold"
                              title="Half Day"
                            >
                              ½
                            </button>
                            <button 
                              onClick={() => { console.log('WFH button clicked for', emp.id); handleMarkAttendance(emp.id, 'work_from_home'); }}
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-semibold"
                              title="Work From Home"
                            >
                              🏠
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
