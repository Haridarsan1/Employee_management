import { useState, useEffect } from 'react';
import { Clock, MapPin, Calendar as CalendarIcon, CheckCircle, XCircle, AlertCircle, MapPinned, Smartphone, Sparkles, Users, X, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useScope } from '../../contexts/ScopeContext';
import { ScopeBar } from '../../components/Scope/ScopeBar';
import { OverviewCard } from './OverviewCard';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

interface AlertModal {
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
}

export function AttendancePage() {
  const { membership, organization } = useAuth();
  const { selectedDepartmentId, selectedEmployeeId } = useScope();
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationStatus, setLocationStatus] = useState<'checking' | 'allowed' | 'denied' | null>(null);
  const [officeLocations, setOfficeLocations] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allAttendanceRecords, setAllAttendanceRecords] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'present'|'absent'>('all');
  const [overrideModal, setOverrideModal] = useState<{open: boolean; record: any|null}>({open:false, record:null});
  const [departments, setDepartments] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (membership?.employee_id) {
      loadTodayAttendance();
      checkLocationPermission();
    }
    if (organization?.id) {
      loadOfficeLocations();
      loadDepartments();
    }
    if (membership?.role && ['owner','admin', 'hr', 'manager'].includes(membership.role)) {
      setIsAdmin(true);
      loadAllAttendance();
    }
  }, [membership, organization, selectedDate]);

  const loadOfficeLocations = async () => {
    if (!organization?.id) return;
    try {
      const { data } = await supabase
        .from('office_locations')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true);
      setOfficeLocations(data || []);
    } catch (error) {
      console.error('Error loading office locations:', error);
    }
  };

  const loadAllAttendance = async () => {
    if (!organization?.id) return;
    try {
      const { data } = await supabase
        .from('attendance_records')
        .select(`
          *,
          employees (
            employee_code,
            first_name,
            last_name,
            company_email,
            department_id
          )
        `)
        .eq('attendance_date', selectedDate)
        .order('check_in_time', { ascending: false });

      setAllAttendanceRecords(data || []);
    } catch (error) {
      console.error('Error loading attendance records:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organization?.id || '');
      const map: Record<string, string> = {};
      (data || []).forEach((d: any) => { map[d.id] = d.name; });
      setDepartments(map);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const checkLocationPermission = async () => {
    setLocationStatus('checking');
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    try {
      const position = await getCurrentPosition();
      setLocationStatus('allowed');
    } catch (error) {
      setLocationStatus('denied');
    }
  };

  const loadTodayAttendance = async () => {
    if (!membership?.employee_id) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', membership.employee_id)
        .eq('attendance_date', today)
        .maybeSingle();

      setTodayAttendance(data);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'HRMS-Attendance-System'
          }
        }
      );
      const data = await response.json();
      return data.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    } catch (error) {
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
  };

  const getDeviceInfo = () => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timestamp: new Date().toISOString()
    };
  };

  const handleCheckIn = async () => {
    if (!membership?.employee_id) return;
    setLoading(true);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude, accuracy } = position.coords;

      const address = await reverseGeocode(latitude, longitude);

      let isWithinRadius = false;
      let nearestOffice = null;
      let minDistance = Infinity;

      for (const office of officeLocations) {
        const distance = calculateDistance(
          latitude,
          longitude,
          parseFloat(office.latitude),
          parseFloat(office.longitude)
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestOffice = office;
        }

        if (distance <= office.radius_meters) {
          isWithinRadius = true;
          break;
        }
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const { error } = await supabase
        .from('attendance_records')
        .insert({
          employee_id: membership.employee_id,
          attendance_date: today,
          check_in_time: now.toISOString(),
          check_in_latitude: latitude,
          check_in_longitude: longitude,
          check_in_accuracy: accuracy,
          check_in_address: address,
          is_within_office_radius: isWithinRadius,
          device_info: getDeviceInfo(),
          status: 'present',
          is_manual_entry: false
        });

      if (error) throw error;

      setAlertModal({
        type: isWithinRadius ? 'success' : 'warning',
        title: 'Check-in Successful!',
        message: isWithinRadius
          ? '✓ You are within office premises'
          : `⚠ You are outside office location (${Math.round(minDistance)}m away from ${nearestOffice?.location_name})`
      });
      await loadTodayAttendance();
    } catch (error: any) {
      console.error('Error checking in:', error);
      setAlertModal({
        type: 'error',
        title: 'Check-in Failed',
        message: 'Failed to check in. Please ensure location is enabled.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!membership?.employee_id || !todayAttendance) return;
    setLoading(true);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude, accuracy } = position.coords;

      const address = await reverseGeocode(latitude, longitude);

      const { error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: new Date().toISOString(),
          check_out_latitude: latitude,
          check_out_longitude: longitude,
          check_out_accuracy: accuracy,
          check_out_address: address
        })
        .eq('id', todayAttendance.id);

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Check-out Successful!',
        message: 'You have been checked out successfully.'
      });
      await loadTodayAttendance();
    } catch (error) {
      console.error('Error checking out:', error);
      setAlertModal({
        type: 'error',
        title: 'Check-out Failed',
        message: 'Failed to check out. Please ensure location is enabled.'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = allAttendanceRecords.filter((record) => {
    if (selectedEmployeeId && record.employees?.id !== selectedEmployeeId) return false;
    if (!selectedEmployeeId && selectedDepartmentId && record.employees?.department_id !== selectedDepartmentId) return false;

    if (statusFilter !== 'all') {
      const isPresent = record.status === 'present' || !!record.check_in_time;
      if (statusFilter === 'present' && !isPresent) return false;
      if (statusFilter === 'absent' && isPresent) return false;
    }

    if (searchTerm) {
      const hay = `${record.employees?.first_name || ''} ${record.employees?.last_name || ''} ${record.employees?.employee_code || ''} ${record.employees?.company_email || ''}`.toLowerCase();
      if (!hay.includes(searchTerm.toLowerCase())) return false;
    }
    return true;
  });

  const metrics = (() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter(r => r.check_in_time).length;
    const absent = Math.max(0, total - present);
    const inOffice = filteredRecords.filter(r => r.is_within_office_radius).length;
    const remote = present - inOffice;
    const late = filteredRecords.filter(r => {
      if (!r.check_in_time) return false;
      const t = new Date(r.check_in_time);
      return t.getHours() > 10 || (t.getHours() === 10 && t.getMinutes() > 15);
    }).length;
    return { total, present, absent, inOffice, remote, late };
  })();

  const handleExportCSV = () => {
    const rows = filteredRecords.map((r) => ({
      date: selectedDate,
      employee: `${r.employees?.first_name || ''} ${r.employees?.last_name || ''}`.trim(),
      code: r.employees?.employee_code || '',
      department: departments[r.employees?.department_id || ''] || '',
      check_in: r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : '',
      check_out: r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString() : '',
      in_office: r.is_within_office_radius ? 'Yes' : 'No',
      status: r.status || (r.check_in_time ? 'present' : 'absent')
    }));
    const headers = Object.keys(rows[0] || { date:'', employee:'', code:'', department:'', check_in:'', check_out:'', in_office:'', status:'' });
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String((r as any)[h] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openOverride = (record: any) => setOverrideModal({ open: true, record });
  const closeOverride = () => setOverrideModal({ open: false, record: null });
  const saveOverride = async () => {
    if (!overrideModal.record) return;
    try {
      const { id } = overrideModal.record;
      const payload: any = {
        status: overrideModal.record.status || 'present',
        is_manual_entry: true,
        check_in_time: overrideModal.record.check_in_time || null,
        check_out_time: overrideModal.record.check_out_time || null,
        is_within_office_radius: !!overrideModal.record.is_within_office_radius
      };
      const { error } = await supabase.from('attendance_records').update(payload).eq('id', id);
      if (error) throw error;
      setAlertModal({ type: 'success', title: 'Override Saved', message: 'Attendance updated successfully.' });
      closeOverride();
      await loadAllAttendance();
    } catch (err: any) {
      console.error('Override failed', err);
      setAlertModal({ type: 'error', title: 'Override Failed', message: err.message || 'Could not save override' });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <>
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn">
            <div className={`p-6 rounded-t-2xl ${
              alertModal.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
              alertModal.type === 'warning' ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
              'bg-gradient-to-r from-red-500 to-red-600'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {alertModal.type === 'success' && <CheckCircle className="h-8 w-8 text-white" />}
                  {alertModal.type === 'warning' && <AlertCircle className="h-8 w-8 text-white" />}
                  {alertModal.type === 'error' && <XCircle className="h-8 w-8 text-white" />}
                  <h3 className="text-xl font-bold text-white">{alertModal.title}</h3>
                </div>
                <button
                  onClick={() => setAlertModal(null)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 text-lg">{alertModal.message}</p>
              <button
                onClick={() => setAlertModal(null)}
                className={`mt-6 w-full py-3 rounded-xl font-semibold text-white transition-all ${
                  alertModal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' :
                  alertModal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                  'bg-red-500 hover:bg-red-600'
                }`}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    <ScopeBar />
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-600" />
            Attendance Management
          </h1>
          <p className="text-slate-600 mt-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Track attendance with location verification
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-slate-900">{formatTime(currentTime)}</div>
          <div className="text-sm text-slate-600 mt-1">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {isAdmin && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <OverviewCard label="Present" value={metrics.present} color="from-emerald-500 to-emerald-600" />
              <OverviewCard label="Absent" value={metrics.absent} color="from-red-500 to-red-600" />
              <OverviewCard label="Late" value={metrics.late} color="from-amber-500 to-amber-600" />
              <OverviewCard label="In Office" value={metrics.inOffice} color="from-blue-500 to-blue-600" />
              <OverviewCard label="Remote" value={metrics.remote} color="from-violet-500 to-violet-600" />
              <OverviewCard label="Total" value={metrics.total} color="from-slate-500 to-slate-600" />
            </div>
          )}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>

            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Clock className="h-7 w-7" />
                Quick Actions
              </h2>

              {locationStatus === 'denied' && (
                <div className="mb-6 bg-red-500/20 border border-red-300 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-6 w-6" />
                    <div>
                      <p className="font-semibold">Location Access Denied</p>
                      <p className="text-sm opacity-90">Please enable location to mark attendance</p>
                    </div>
                  </div>
                </div>
              )}

              {!todayAttendance ? (
                <button
                  onClick={handleCheckIn}
                  disabled={loading || locationStatus === 'denied'}
                  className="w-full bg-white text-blue-600 py-6 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                >
                  <CheckCircle className="h-6 w-6" />
                  {loading ? 'Checking In...' : 'Check In'}
                </button>
              ) : !todayAttendance.check_out_time ? (
                <div className="space-y-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="font-semibold">Checked In</span>
                      </div>
                      <span className="text-2xl font-bold">
                        {new Date(todayAttendance.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-sm opacity-90">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span className="break-all">{todayAttendance.check_in_address || 'Location unavailable'}</span>
                    </div>
                    {todayAttendance.is_within_office_radius ? (
                      <div className="mt-3 flex items-center gap-2 text-green-300 text-sm font-semibold">
                        <CheckCircle className="h-4 w-4" />
                        Within office premises
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-2 text-amber-300 text-sm font-semibold">
                        <AlertCircle className="h-4 w-4" />
                        Outside office location
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleCheckOut}
                    disabled={loading || locationStatus === 'denied'}
                    className="w-full bg-white text-blue-600 py-6 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                  >
                    <XCircle className="h-6 w-6" />
                    {loading ? 'Checking Out...' : 'Check Out'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        <span className="font-semibold">Check In</span>
                      </div>
                      <span className="text-xl font-bold">
                        {new Date(todayAttendance.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-sm opacity-90">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span className="break-all">{todayAttendance.check_in_address}</span>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-400" />
                        <span className="font-semibold">Check Out</span>
                      </div>
                      <span className="text-xl font-bold">
                        {new Date(todayAttendance.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-sm opacity-90">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span className="break-all">{todayAttendance.check_out_address}</span>
                    </div>
                  </div>
                  <div className="bg-green-500/20 border border-green-300 rounded-xl p-4 text-center">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-bold text-lg">Attendance Completed</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <MapPinned className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Office Locations</h3>
            </div>
            <div className="space-y-3">
              {officeLocations.map((location) => (
                <div key={location.id} className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
                  <h4 className="font-semibold text-slate-900 mb-2">{location.location_name}</h4>
                  <p className="text-sm text-slate-600 flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    {location.address}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Radius: {location.radius_meters}m
                  </p>
                </div>
              ))}
              {officeLocations.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No office locations configured</p>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold">Location Status</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                <span className="text-sm">GPS Status</span>
                <span className={`text-sm font-bold ${locationStatus === 'allowed' ? 'text-green-400' : 'text-red-400'}`}>
                  {locationStatus === 'allowed' ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                <span className="text-sm">Accuracy</span>
                <span className="text-sm font-bold text-blue-400">High</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Attendance Report</h2>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employee..."
                className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2 border-2 border-slate-200 rounded-xl"
              >
                <option value="all">All</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button onClick={handleExportCSV} className="inline-flex items-center gap-2 px-3 py-2 border-2 border-slate-200 rounded-xl hover:bg-slate-50">
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No attendance records for this date</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Employee</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Department</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Check In</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Check Out</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Location</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {record.employees?.first_name} {record.employees?.last_name}
                          </p>
                          <p className="text-xs text-slate-500">{record.employees?.employee_code}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-700">{departments[record.employees?.department_id || ''] || '-'}</td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="font-medium text-slate-900">
                            {record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="font-medium text-slate-900">
                            {record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-2 max-w-xs">
                          <MapPin className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="text-xs">
                            <p className="text-slate-700 line-clamp-2">{record.check_in_address || 'N/A'}</p>
                            {record.check_in_latitude && record.check_in_longitude && (
                              <a
                                href={`https://www.google.com/maps?q=${record.check_in_latitude},${record.check_in_longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline mt-1 inline-block"
                              >
                                View on map →
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            record.check_in_time
                              ? (record.is_within_office_radius ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200' : 'bg-amber-100 text-amber-700 ring-2 ring-amber-200')
                              : 'bg-red-100 text-red-700 ring-2 ring-red-200'
                          }`}>
                            {record.check_in_time ? (record.is_within_office_radius ? 'In Office' : 'Remote') : 'Absent'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => setOverrideModal({open: true, record})}
                          className="px-3 py-1.5 text-sm border-2 border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          Override
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {overrideModal.open && overrideModal.record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4">
            <div className="p-6 bg-gradient-to-r from-violet-500 to-violet-600 rounded-t-2xl text-white flex items-center justify-between">
              <h3 className="text-lg font-bold">Manual Override</h3>
              <button onClick={() => setOverrideModal({open:false, record:null})} className="p-1 hover:bg-white/20 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Check In</label>
                  <input
                    type="datetime-local"
                    value={overrideModal.record?.check_in_time ? new Date(overrideModal.record.check_in_time).toISOString().slice(0,16) : ''}
                    onChange={(e) => setOverrideModal(v => ({...v, record: {...(v.record as any), check_in_time: e.target.value ? new Date(e.target.value).toISOString() : null }}))}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Check Out</label>
                  <input
                    type="datetime-local"
                    value={overrideModal.record?.check_out_time ? new Date(overrideModal.record.check_out_time).toISOString().slice(0,16) : ''}
                    onChange={(e) => setOverrideModal(v => ({...v, record: {...(v.record as any), check_out_time: e.target.value ? new Date(e.target.value).toISOString() : null }}))}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                  <select
                    value={overrideModal.record?.status || 'present'}
                    onChange={(e) => setOverrideModal(v => ({...v, record: {...(v.record as any), status: e.target.value }}))}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="inOffice"
                    type="checkbox"
                    checked={!!overrideModal.record?.is_within_office_radius}
                    onChange={(e) => setOverrideModal(v => ({...v, record: {...(v.record as any), is_within_office_radius: e.target.checked }}))}
                    className="h-5 w-5 accent-violet-600"
                  />
                  <label htmlFor="inOffice" className="text-sm font-semibold text-slate-700">In Office</label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setOverrideModal({open:false, record:null})} className="flex-1 py-2 border-2 border-slate-200 rounded-xl">Cancel</button>
                <button onClick={saveOverride} className="flex-1 py-2 bg-violet-600 text-white rounded-xl">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
