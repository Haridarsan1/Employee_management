import { useEffect, useState } from 'react';
import { CheckSquare, Plus, X, Send, Clock, Calendar, User, GitBranch, Github, TrendingUp, Filter, Search, Sparkles, AlertCircle, CheckCircle, Timer, MessageSquare, Paperclip } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useScope } from '../../contexts/ScopeContext';
import { ScopeBar } from '../../components/Scope/ScopeBar';

interface Task {
  id: string;
  title: string;
  description: string;
  task_type: string;
  priority: string;
  status: string;
  due_date: string;
  estimated_hours: number;
  actual_hours: number;
  github_repo: string;
  github_issue_number: number;
  github_pr_number: number;
  created_at: string;
  completed_at: string;
  assigned_employee: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
    department_id?: string;
  };
}

interface GitHubStats {
  id: string;
  github_username: string;
  repository: string;
  commits_count: number;
  pull_requests_count: number;
  issues_count: number;
  lines_added: number;
  lines_removed: number;
  last_commit_date: string;
  last_synced_at: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  email: string;
}

interface TaskFormData {
  title: string;
  description: string;
  task_type: string;
  priority: string;
  assigned_to: string;
  due_date: string;
  estimated_hours: number;
  github_repo: string;
  github_issue_number: string;
  github_pr_number: string;
}

interface AlertModal {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export function TasksPage() {
  const { membership, organization } = useAuth();
  const { selectedDepartmentId, selectedEmployeeId, employeesInSelectedDept } = useScope();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [githubStats, setGithubStats] = useState<GitHubStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    task_type: 'feature',
    priority: 'medium',
    assigned_to: '',
    due_date: '',
    estimated_hours: 0,
    github_repo: '',
    github_issue_number: '',
    github_pr_number: ''
  });

  const isAdmin = membership?.role && ['owner','admin', 'hr', 'manager'].includes(membership.role);

  useEffect(() => {
    loadData();
  }, [membership, organization]);

  const loadData = async () => {
    try {
      await Promise.all([
        loadTasks(),
        isAdmin && loadGithubStats()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assigned_employee:employees!assigned_to(id, first_name, last_name, employee_code, department_id)
        `)
        .eq('organization_id', organization?.id)
        .order('created_at', { ascending: false });

      if (!isAdmin && membership?.employee_id) {
        query = query.eq('assigned_to', membership.employee_id);
      }

      const { data } = await query;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadEmployees = async () => {
    if (!organization?.id) return;
    try {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, email')
        .eq('organization_id', organization.id)
        .eq('employment_status', 'active')
        .order('first_name');
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadGithubStats = async () => {
    if (!organization?.id) return;
    try {
      const { data } = await supabase
        .from('github_stats')
        .select(`
          *,
          employee:employees(first_name, last_name, employee_code)
        `)
        .order('last_synced_at', { ascending: false });
      setGithubStats(data || []);
    } catch (error) {
      console.error('Error loading GitHub stats:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!formData.title || !formData.assigned_to) {
      setAlertModal({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fill in title and assign to an employee'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          organization_id: organization?.id,
          title: formData.title,
          description: formData.description,
          task_type: formData.task_type,
          priority: formData.priority,
          assigned_to: formData.assigned_to,
          due_date: formData.due_date || null,
          estimated_hours: formData.estimated_hours,
          github_repo: formData.github_repo || null,
          github_issue_number: formData.github_issue_number ? parseInt(formData.github_issue_number) : null,
          github_pr_number: formData.github_pr_number ? parseInt(formData.github_pr_number) : null,
          created_by: membership?.user_id,
          status: 'todo'
        });

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Task Created',
        message: 'Task has been created and assigned successfully'
      });

      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        task_type: 'feature',
        priority: 'medium',
        assigned_to: '',
        due_date: '',
        estimated_hours: 0,
        github_repo: '',
        github_issue_number: '',
        github_pr_number: ''
      });

      await loadTasks();
    } catch (error: any) {
      console.error('Error creating task:', error);
      setAlertModal({
        type: 'error',
        title: 'Creation Failed',
        message: error.message || 'Failed to create task'
      });
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Status Updated',
        message: `Task status changed to ${newStatus.replace('_', ' ')}`
      });

      await loadTasks();
    } catch (error: any) {
      console.error('Error updating task:', error);
      setAlertModal({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update task'
      });
    }
  };

  const getFilteredTasks = () => {
    let filtered = tasks;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    // Apply scope filters: employee first, then department
    if (selectedEmployeeId) {
      filtered = filtered.filter(t => t.assigned_employee?.id === selectedEmployeeId);
    } else if (selectedDepartmentId) {
      filtered = filtered.filter(t => t.assigned_employee?.department_id === selectedDepartmentId);
    }

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const getTaskStats = () => {
    const stats = {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      in_review: tasks.filter(t => t.status === 'in_review').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length
    };
    return stats;
  };

  const getTaskTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      bug: 'from-red-500 to-red-600',
      feature: 'from-blue-500 to-blue-600',
      enhancement: 'from-emerald-500 to-emerald-600',
      documentation: 'from-violet-500 to-violet-600',
      research: 'from-amber-500 to-amber-600',
      maintenance: 'from-slate-500 to-slate-600'
    };
    return colors[type] || colors.feature;
  };

  const getPriorityBadge = (priority: string) => {
    const badges: { [key: string]: string } = {
      low: 'bg-slate-100 text-slate-700 border-slate-200',
      medium: 'bg-blue-100 text-blue-700 border-blue-200',
      high: 'bg-amber-100 text-amber-700 border-amber-200',
      critical: 'bg-red-100 text-red-700 border-red-200'
    };
    return badges[priority] || badges.medium;
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { color: string; icon: any } } = {
      todo: { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
      in_progress: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: TrendingUp },
      in_review: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle },
      completed: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
      cancelled: { color: 'bg-red-100 text-red-700 border-red-200', icon: X }
    };
    const badge = badges[status] || badges.todo;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border-2 ${badge.color}`}>
        <Icon className="h-3 w-3" />
        {status.toUpperCase().replace('_', ' ')}
      </span>
    );
  };

  const stats = getTaskStats();
  const filteredTasks = getFilteredTasks();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
          <CheckSquare className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <>
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn">
            <div className={`p-6 rounded-t-2xl ${
              alertModal.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
              alertModal.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' :
              'bg-gradient-to-r from-blue-500 to-blue-600'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">{alertModal.title}</h3>
                <button onClick={() => setAlertModal(null)} className="p-1 hover:bg-white/20 rounded-lg">
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 text-lg">{alertModal.message}</p>
              <button
                onClick={() => setAlertModal(null)}
                className={`mt-6 w-full py-3 rounded-xl font-semibold text-white ${
                  alertModal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' :
                  alertModal.type === 'error' ? 'bg-red-500 hover:bg-red-600' :
                  'bg-blue-500 hover:bg-blue-600'
                }`}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
            <div className="p-6 bg-gradient-to-r from-purple-500 to-purple-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-8 w-8 text-white" />
                  <h3 className="text-xl font-bold text-white">Create New Task</h3>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-white/20 rounded-lg">
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter task title"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Describe the task in detail"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Task Type</label>
                  <select
                    value={formData.task_type}
                    onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="feature">Feature</option>
                    <option value="bug">Bug</option>
                    <option value="enhancement">Enhancement</option>
                    <option value="documentation">Documentation</option>
                    <option value="research">Research</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Assign To <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select Employee</option>
                    {employeesInSelectedDept.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Estimated Hours</label>
                <input
                  type="number"
                  value={formData.estimated_hours}
                  onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) })}
                  min="0"
                  step="0.5"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="border-t-2 border-slate-200 pt-4">
                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Github className="h-5 w-5 text-purple-600" />
                  GitHub Integration (Optional)
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Repository URL</label>
                    <input
                      type="text"
                      value={formData.github_repo}
                      onChange={(e) => setFormData({ ...formData, github_repo: e.target.value })}
                      placeholder="https://github.com/username/repo"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Issue Number</label>
                      <input
                        type="number"
                        value={formData.github_issue_number}
                        onChange={(e) => setFormData({ ...formData, github_issue_number: e.target.value })}
                        placeholder="#123"
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">PR Number</label>
                      <input
                        type="number"
                        value={formData.github_pr_number}
                        onChange={(e) => setFormData({ ...formData, github_pr_number: e.target.value })}
                        placeholder="#456"
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Create Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ScopeBar />
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-3">
              <CheckSquare className="h-8 w-8 text-purple-600" />
              Task Management
            </h1>
            <p className="text-slate-600 mt-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              {isAdmin ? 'Manage and track team tasks with GitHub integration' : 'View and update your assigned tasks'}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowGithubModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl hover:from-slate-800 hover:to-slate-900 shadow-lg"
              >
                <Github className="h-5 w-5" />
                GitHub Stats
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 shadow-lg"
              >
                <Plus className="h-5 w-5" />
                Create Task
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <StatsCard label="Total Tasks" value={stats.total} color="from-blue-500 to-blue-600" />
          <StatsCard label="To Do" value={stats.todo} color="from-slate-500 to-slate-600" />
          <StatsCard label="In Progress" value={stats.in_progress} color="from-violet-500 to-violet-600" />
          <StatsCard label="In Review" value={stats.in_review} color="from-amber-500 to-amber-600" />
          <StatsCard label="Completed" value={stats.completed} color="from-emerald-500 to-emerald-600" />
          <StatsCard label="Overdue" value={stats.overdue} color="from-red-500 to-red-600" />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full pl-10 pr-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
            </select>

            {/* Per-page employee filter removed; use ScopeBar instead */}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-semibold">No tasks found</p>
              <p className="text-sm text-slate-500 mt-1">
                {isAdmin ? 'Create your first task to get started' : 'No tasks assigned to you yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isAdmin={isAdmin}
                  onStatusChange={handleUpdateTaskStatus}
                  getTaskTypeColor={getTaskTypeColor}
                  getPriorityBadge={getPriorityBadge}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatsCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 hover:shadow-xl transition-all hover:scale-105">
      <div className={`h-12 w-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-3 shadow-lg`}>
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
    </div>
  );
}

function TaskCard({ task, isAdmin, onStatusChange, getTaskTypeColor, getPriorityBadge, getStatusBadge }: any) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <div className={`p-5 border-2 rounded-xl transition-all hover:shadow-md ${
      isOverdue ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-purple-300'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`px-3 py-1 bg-gradient-to-r ${getTaskTypeColor(task.task_type)} rounded-lg text-xs font-bold text-white`}>
              {task.task_type.toUpperCase()}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getPriorityBadge(task.priority)}`}>
              {task.priority.toUpperCase()}
            </span>
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-1">{task.title}</h3>
          {task.description && (
            <p className="text-sm text-slate-600 mb-2">{task.description}</p>
          )}
        </div>
        <div className="text-right ml-4">
          {getStatusBadge(task.status)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {task.assigned_employee && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-slate-400" />
            <span className="text-slate-600">{task.assigned_employee.first_name} {task.assigned_employee.last_name}</span>
          </div>
        )}
        {task.due_date && (
          <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
            <Calendar className="h-4 w-4" />
            <span>{new Date(task.due_date).toLocaleDateString()}</span>
          </div>
        )}
        {task.estimated_hours > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>{task.estimated_hours}h est.</span>
          </div>
        )}
        {task.github_repo && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Github className="h-4 w-4 text-slate-400" />
            <a href={task.github_repo} target="_blank" rel="noopener noreferrer" className="hover:text-purple-600">
              View Repo
            </a>
          </div>
        )}
      </div>

      {!isAdmin && task.status !== 'completed' && task.status !== 'cancelled' && (
        <div className="flex gap-2 pt-3 border-t border-slate-200">
          {task.status === 'todo' && (
            <button
              onClick={() => onStatusChange(task.id, 'in_progress')}
              className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 text-sm"
            >
              Start Task
            </button>
          )}
          {task.status === 'in_progress' && (
            <button
              onClick={() => onStatusChange(task.id, 'in_review')}
              className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 text-sm"
            >
              Submit for Review
            </button>
          )}
          {task.status === 'in_review' && (
            <button
              onClick={() => onStatusChange(task.id, 'completed')}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 text-sm"
            >
              Mark Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
