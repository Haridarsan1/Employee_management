import { useState, useEffect, type ReactNode } from 'react';
import { Menu, X, LogOut, Bell, User, LayoutDashboard, Users, Calendar, Clock, IndianRupee, FileText, Settings, Sparkles, CheckSquare, Receipt, Headphones, Award, BookOpen, Megaphone, Github, Library } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canAccessPage } from '../lib/permissions';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, organization, membership, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeToday, setActiveToday] = useState(0);

  useEffect(() => {
    const loadActiveToday = async () => {
      if (!organization?.id) return;
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id, employees!inner(organization_id)')
        .eq('employees.organization_id', organization.id)
        .eq('attendance_date', today)
        .eq('status', 'present');
      
      if (!error) {
        const count = data?.length || 0;
        console.log('Sidebar active today count:', count);
        setActiveToday(count);
      } else {
        console.error('Error loading sidebar active today:', error);
      }
    };

    loadActiveToday();

    // Set up real-time subscription for attendance changes
    if (organization?.id) {
      const today = new Date().toISOString().split('T')[0];
      const channel = supabase.channel('sidebar-attendance', {
        config: { broadcast: { self: true } }
      });

      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records', filter: `attendance_date=eq.${today}` },
        () => {
          loadActiveToday();
        }
      );

      channel.subscribe((status) => {
        console.log('Sidebar attendance real-time status:', status);
      });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [organization]);


  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'from-blue-500 to-blue-600', roles: ['admin', 'hr', 'finance', 'manager', 'employee'] },
    { id: 'profile', label: 'My Profile', icon: User, color: 'from-violet-500 to-violet-600', roles: ['admin', 'hr', 'finance', 'manager', 'employee'] },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, color: 'from-purple-500 to-purple-600', roles: ['admin', 'hr', 'manager', 'employee'] },
    { id: 'employees', label: 'Employees', icon: Users, color: 'from-emerald-500 to-emerald-600', roles: ['admin', 'hr', 'manager'] },
    { id: 'attendance', label: 'Attendance', icon: Clock, color: 'from-amber-500 to-amber-600', roles: ['admin', 'hr', 'manager', 'employee'] },
    { id: 'leave', label: 'Leave', icon: Calendar, color: 'from-teal-500 to-teal-600', roles: ['admin', 'hr', 'manager', 'employee'] },
    { id: 'expenses', label: 'Expenses', icon: Receipt, color: 'from-orange-500 to-orange-600', roles: ['admin', 'hr', 'finance', 'manager', 'employee'] },
    { id: 'payroll', label: 'Payroll', icon: IndianRupee, color: 'from-rose-500 to-rose-600', roles: ['admin', 'hr', 'finance'] },
    { id: 'performance', label: 'Performance', icon: Award, color: 'from-yellow-500 to-yellow-600', roles: ['admin', 'hr', 'manager', 'employee'] },
    { id: 'training', label: 'Training', icon: BookOpen, color: 'from-green-500 to-green-600', roles: ['admin', 'hr', 'manager', 'employee'] },
    { id: 'helpdesk', label: 'Helpdesk', icon: Headphones, color: 'from-pink-500 to-pink-600', roles: ['admin', 'hr', 'manager', 'employee'] },
    { id: 'knowledge-base', label: 'Knowledge Base', icon: Library, color: 'from-indigo-500 to-indigo-600', roles: ['admin', 'hr', 'manager', 'employee'] },
    { id: 'announcements', label: 'Announcements', icon: Megaphone, color: 'from-fuchsia-500 to-fuchsia-600', roles: ['admin', 'hr', 'manager', 'employee'] },
    { id: 'reports', label: 'Reports', icon: FileText, color: 'from-cyan-500 to-cyan-600', roles: ['admin', 'hr', 'finance'] },
    { id: 'github', label: 'GitHub', icon: Github, color: 'from-gray-500 to-gray-600', roles: ['admin', 'hr', 'manager'] },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'from-slate-500 to-slate-600', roles: ['admin', 'hr'] },
  ];

  const filteredMenuItems = menuItems.filter(item =>
    canAccessPage(membership?.role || null, item.id)
  );

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 fixed w-full z-30 top-0 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <div className="ml-4 flex items-center gap-2">
                <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                    {organization?.name || 'HRMS & Payroll'}
                  </h1>
                  <p className="text-xs text-slate-500">Human Resource Management</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-full animate-pulse"></span>
              </button>

              <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{user?.email}</p>
                  <p className="text-xs text-slate-500 capitalize flex items-center justify-end gap-1">
                    <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                    {membership?.role}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white shadow-lg ring-2 ring-blue-100">
                  <User className="h-5 w-5" />
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="p-2 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex pt-16">
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed left-0 z-20 w-72 h-[calc(100vh-4rem)] bg-white/80 backdrop-blur-xl border-r border-slate-200/50 transition-transform duration-300 ease-in-out overflow-y-auto shadow-xl`}
        >
          <div className="p-4">
            <div className="bg-gradient-to-br from-blue-600 via-violet-600 to-purple-600 rounded-2xl p-6 mb-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-xs font-medium">Welcome Back</p>
                    <p className="text-white font-bold text-lg capitalize">
                      {membership?.role || (loading ? '...' : 'Loading')}
                    </p>
                  </div>
                </div>
                <div className="h-px bg-white/20 my-3"></div>
                <div className="text-white/90 text-xs">
                  <p className="font-semibold mb-1">Quick Stats</p>
                  <div className="flex items-center justify-between">
                    <span>Active Today</span>
                    <span className="font-bold">{activeToday}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3 px-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Menu</p>
            </div>

            <nav className="space-y-1.5">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`group relative flex items-center w-full px-4 py-3.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r ' + item.color + ' text-white shadow-lg shadow-' + item.color.split('-')[1] + '-500/30'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`flex items-center justify-center h-9 w-9 rounded-lg mr-3 transition-all ${
                      isActive
                        ? 'bg-white/20 backdrop-blur-sm'
                        : 'bg-slate-100 group-hover:bg-slate-200'
                    }`}>
                      <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-600 group-hover:text-slate-900'}`} />
                    </div>
                    <span className="flex-1">{item.label}</span>
                    {isActive && (
                      <div className="absolute right-4 h-2 w-2 bg-white rounded-full shadow-lg"></div>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Pro Features box temporarily hidden for MVP. Uncomment to restore. */}
            {/*
            <div className="mt-6 mx-3 p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900 mb-1">Pro Features</p>
                  <p className="text-xs text-amber-700 mb-3">Upgrade for advanced analytics</p>
                  <button className="text-xs font-semibold text-amber-900 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition-colors">
                    Learn More
                  </button>
                </div>
              </div>
            </div>
            */}
          </div>
        </aside>

        <main
          className={`${
            sidebarOpen ? 'ml-72' : 'ml-0'
          } flex-1 transition-all duration-300 ease-in-out p-6 w-full`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
