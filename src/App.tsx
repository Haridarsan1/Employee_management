import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './components/Auth/LoginPage';
import { RegisterPage } from './components/Auth/RegisterPage';
import { EmployeeRegisterPage } from './components/Auth/EmployeeRegisterPage';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { EmployeesPage } from './pages/Employees/EmployeesPage';
import { AttendancePage } from './pages/Attendance/AttendancePage';
import { LeavePage } from './pages/Leave/LeavePage';
import { PayrollPage } from './pages/Payroll/PayrollPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { EmployeeProfilePage } from './pages/EmployeeProfile/EmployeeProfilePage';
import { TasksPage } from './pages/Tasks/TasksPage';
import { ExpensesPage } from './pages/Expenses/ExpensesPage';
import { HelpdeskPage } from './pages/Helpdesk/HelpdeskPage';
import { PerformancePage } from './pages/Performance/PerformancePage';
import { TrainingPage } from './pages/Training/TrainingPage';
import { AnnouncementsPage } from './pages/Announcements/AnnouncementsPage';
import { GitHubPage } from './pages/GitHub/GitHubPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register' | 'employee-register'>('landing');

  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    if (path === '/employee-register' || params.get('code')) {
      setAuthMode('employee-register');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    if (authMode === 'employee-register') {
      return <EmployeeRegisterPage />;
    }

    if (authMode === 'landing') {
      return (
        <LandingPage
          onGetStarted={() => setAuthMode('register')}
          onLogin={() => setAuthMode('login')}
        />
      );
    }

    return authMode === 'login' ? (
      <LoginPage onSwitchToRegister={() => setAuthMode('register')} />
    ) : (
      <RegisterPage onSwitchToLogin={() => setAuthMode('login')} />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'tasks':
        return <TasksPage />;
      case 'employees':
        return <EmployeesPage />;
      case 'attendance':
        return <AttendancePage />;
      case 'leave':
        return <LeavePage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'payroll':
        return <PayrollPage />;
      case 'performance':
        return <PerformancePage />;
      case 'training':
        return <TrainingPage />;
      case 'helpdesk':
        return <HelpdeskPage />;
      case 'announcements':
        return <AnnouncementsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'github':
        return <GitHubPage />;
      case 'settings':
        return <SettingsPage />;
      case 'profile':
        return <EmployeeProfilePage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
