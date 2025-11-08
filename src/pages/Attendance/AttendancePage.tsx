import { useState, useEffect } from 'react';
import { Clock, MapPin, Calendar as CalendarIcon, CheckCircle, XCircle, AlertCircle, MapPinned, Smartphone, Sparkles, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationStatus, setLocationStatus] = useState<'checking' | 'allowed' | 'denied' | null>(null);
  const [officeLocations, setOfficeLocations] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allAttendanceRecords, setAllAttendanceRecords] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);

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
    }
    if (membership?.role && ['admin', 'hr', 'manager'].includes(membership.role)) {
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
            company_email
          )
        `)
        .eq('attendance_date', selectedDate)
        .order('check_in_time', { ascending: false });

      setAllAttendanceRecords(data || []);
    } catch (error) {
      console.error('Error loading attendance records:', error);
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
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {allAttendanceRecords.length === 0 ? (
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
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Check In</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Check Out</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Location</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allAttendanceRecords.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {record.employees?.first_name} {record.employees?.last_name}
                          </p>
                          <p className="text-xs text-slate-500">{record.employees?.employee_code}</p>
                        </div>
                      </td>
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
                            record.is_within_office_radius
                              ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200'
                              : 'bg-amber-100 text-amber-700 ring-2 ring-amber-200'
                          }`}>
                            {record.is_within_office_radius ? 'In Office' : 'Remote'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
