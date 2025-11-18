import { useState, useEffect } from 'react';
import {
  Award,
  Target,
  TrendingUp,
  Calendar,
  CheckCircle,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Users,
  BarChart3,
  Star,
  Search,
  Building2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useScope } from '../../contexts/ScopeContext';
import type { Goal, PerformanceReview, Employee, Department } from '../../lib/database.types';

interface GoalWithEmployee extends Goal {
  employee?: Employee;
}

interface ReviewWithEmployee extends PerformanceReview {
  employee?: Employee;
}

export function OwnerPerformancePage() {
  const { membership } = useAuth();
  const { selectedDepartmentId, selectedEmployeeId } = useScope();
  const [goals, setGoals] = useState<GoalWithEmployee[]>([]);
  const [reviews, setReviews] = useState<ReviewWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'goals' | 'reviews' | 'analytics'>('goals');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalWithEmployee | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewWithEmployee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const [goalForm, setGoalForm] = useState({
    employee_id: '',
    title: '',
    description: '',
    goal_type: 'okr' as const,
    target_value: '',
    unit: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    progress: 0
  });

  const [reviewForm, setReviewForm] = useState({
    employee_id: '',
    review_type: 'quarterly' as const,
    review_cycle: '',
    rating: 0,
    feedback: '',
    strengths: '',
    areas_for_improvement: '',
    goals_met: true
  });

  useEffect(() => {
    if (membership?.organization_id) {
      fetchPerformanceData();
      subscribeToChanges();
    }
  }, [membership?.organization_id, selectedDepartmentId, selectedEmployeeId]);

  const fetchPerformanceData = async () => {
    if (!membership?.organization_id) return;

    try {
      setLoading(true);

      // Fetch employees
      let employeesQuery = supabase
        .from('employees')
        .select('*')
        .eq('organization_id', membership.organization_id)
        .eq('employment_status', 'active');

      if (selectedDepartmentId) {
        employeesQuery = employeesQuery.eq('department_id', selectedDepartmentId);
      }

      if (selectedEmployeeId) {
        employeesQuery = employeesQuery.eq('id', selectedEmployeeId);
      }

      const { data: employeesData, error: employeesError } = await employeesQuery;
      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      const employeeIds = (employeesData || []).map(e => e.id);

      // Fetch goals
      if (employeeIds.length > 0) {
        const { data: goalsData, error: goalsError } = await supabase
          .from('goals')
          .select(`
            *,
            employee:employees(*)
          `)
          .in('employee_id', employeeIds)
          .order('created_at', { ascending: false });

        if (goalsError) throw goalsError;
        setGoals(goalsData || []);

        // Fetch reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('performance_reviews')
          .select(`
            *,
            employee:employees(*)
          `)
          .in('employee_id', employeeIds)
          .order('created_at', { ascending: false });

        if (reviewsError) throw reviewsError;
        setReviews(reviewsData || []);
      } else {
        setGoals([]);
        setReviews([]);
      }

      // Fetch departments
      const { data: departmentsData, error: departmentsError } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', membership.organization_id);

      if (departmentsError) throw departmentsError;
      setDepartments(departmentsData || []);

    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    if (!membership?.organization_id) return;

    const goalsSubscription = supabase
      .channel('owner-goals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
          filter: `organization_id=eq.${membership.organization_id}`
        },
        () => {
          fetchPerformanceData();
        }
      )
      .subscribe();

    const reviewsSubscription = supabase
      .channel('owner-reviews')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'performance_reviews',
          filter: `organization_id=eq.${membership.organization_id}`
        },
        () => {
          fetchPerformanceData();
        }
      )
      .subscribe();

    return () => {
      goalsSubscription.unsubscribe();
      reviewsSubscription.unsubscribe();
    };
  };

  const handleCreateGoal = async () => {
    if (!membership?.organization_id || !membership?.employee_id) return;

    try {
      const { error } = await supabase.from('goals').insert({
        organization_id: membership.organization_id,
        employee_id: goalForm.employee_id,
        title: goalForm.title,
        description: goalForm.description,
        goal_type: goalForm.goal_type,
        status: 'active',
        progress: goalForm.progress,
        target_value: goalForm.target_value ? parseFloat(goalForm.target_value) : null,
        current_value: 0,
        unit: goalForm.unit || null,
        start_date: goalForm.start_date,
        end_date: goalForm.end_date,
        created_by: membership.employee_id
      });

      if (error) throw error;

      setShowGoalModal(false);
      resetGoalForm();
      fetchPerformanceData();
      alert('Goal created successfully!');
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Failed to create goal');
    }
  };

  const handleUpdateGoal = async () => {
    if (!selectedGoal) return;

    try {
      const { error } = await supabase
        .from('goals')
        .update({
          title: goalForm.title,
          description: goalForm.description,
          goal_type: goalForm.goal_type,
          target_value: goalForm.target_value ? parseFloat(goalForm.target_value) : null,
          unit: goalForm.unit || null,
          end_date: goalForm.end_date,
          progress: goalForm.progress,
          status: goalForm.progress >= 100 ? 'completed' : 
                  new Date(goalForm.end_date) < new Date() && goalForm.progress < 100 ? 'overdue' : 'active',
          completed_at: goalForm.progress >= 100 ? new Date().toISOString() : null
        })
        .eq('id', selectedGoal.id);

      if (error) throw error;

      setShowGoalModal(false);
      setSelectedGoal(null);
      resetGoalForm();
      fetchPerformanceData();
      alert('Goal updated successfully!');
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('Failed to update goal');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;
      fetchPerformanceData();
      alert('Goal deleted successfully!');
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Failed to delete goal');
    }
  };

  const handleCreateReview = async () => {
    if (!membership?.organization_id || !membership?.employee_id) return;

    try {
      const { error } = await supabase.from('performance_reviews').insert({
        organization_id: membership.organization_id,
        employee_id: reviewForm.employee_id,
        reviewer_id: membership.employee_id,
        review_type: reviewForm.review_type,
        review_cycle: reviewForm.review_cycle,
        rating: reviewForm.rating || null,
        feedback: reviewForm.feedback || null,
        strengths: reviewForm.strengths || null,
        areas_for_improvement: reviewForm.areas_for_improvement || null,
        goals_met: reviewForm.goals_met,
        status: 'completed',
        review_date: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });

      if (error) throw error;

      setShowReviewModal(false);
      resetReviewForm();
      fetchPerformanceData();
      alert('Review created successfully!');
    } catch (error) {
      console.error('Error creating review:', error);
      alert('Failed to create review');
    }
  };

  const handleUpdateReview = async () => {
    if (!selectedReview) return;

    try {
      const { error } = await supabase
        .from('performance_reviews')
        .update({
          review_type: reviewForm.review_type,
          review_cycle: reviewForm.review_cycle,
          rating: reviewForm.rating || null,
          feedback: reviewForm.feedback || null,
          strengths: reviewForm.strengths || null,
          areas_for_improvement: reviewForm.areas_for_improvement || null,
          goals_met: reviewForm.goals_met,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedReview.id);

      if (error) throw error;

      setShowReviewModal(false);
      setSelectedReview(null);
      resetReviewForm();
      fetchPerformanceData();
      alert('Review updated successfully!');
    } catch (error) {
      console.error('Error updating review:', error);
      alert('Failed to update review');
    }
  };

  const resetGoalForm = () => {
    setGoalForm({
      employee_id: '',
      title: '',
      description: '',
      goal_type: 'okr',
      target_value: '',
      unit: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      progress: 0
    });
  };

  const resetReviewForm = () => {
    setReviewForm({
      employee_id: '',
      review_type: 'quarterly',
      review_cycle: '',
      rating: 0,
      feedback: '',
      strengths: '',
      areas_for_improvement: '',
      goals_met: true
    });
  };

  const openEditGoalModal = (goal: GoalWithEmployee) => {
    setSelectedGoal(goal);
    setGoalForm({
      employee_id: goal.employee_id,
      title: goal.title,
      description: goal.description || '',
      goal_type: goal.goal_type as any,
      target_value: goal.target_value?.toString() || '',
      unit: goal.unit || '',
      start_date: goal.start_date,
      end_date: goal.end_date,
      progress: goal.progress
    });
    setShowGoalModal(true);
  };

  const openEditReviewModal = (review: ReviewWithEmployee) => {
    setSelectedReview(review);
    setReviewForm({
      employee_id: review.employee_id,
      review_type: review.review_type as any,
      review_cycle: review.review_cycle,
      rating: review.rating || 0,
      feedback: review.feedback || '',
      strengths: review.strengths || '',
      areas_for_improvement: review.areas_for_improvement || '',
      goals_met: review.goals_met ?? true
    });
    setShowReviewModal(true);
  };

  const filteredGoals = goals.filter(goal => {
    if (filterStatus !== 'all' && goal.status !== filterStatus) return false;
    if (filterType !== 'all' && goal.goal_type !== filterType) return false;
    if (searchTerm && !goal.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !goal.employee?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !goal.employee?.last_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const filteredReviews = reviews.filter(review => {
    if (searchTerm && !review.employee?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !review.employee?.last_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Analytics calculations
  const analytics = {
    totalGoals: goals.length,
    activeGoals: goals.filter(g => g.status === 'active').length,
    completedGoals: goals.filter(g => g.status === 'completed').length,
    overdueGoals: goals.filter(g => g.status === 'overdue').length,
    avgProgress: goals.length > 0 
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
      : 0,
    avgRating: reviews.length > 0 && reviews.some(r => r.rating)
      ? (reviews.filter(r => r.rating).reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.filter(r => r.rating).length).toFixed(1)
      : 'N/A',
    totalReviews: reviews.length,
    completedReviews: reviews.filter(r => r.status === 'completed').length,
    employeesWithGoals: new Set(goals.map(g => g.employee_id)).size,
    employeesReviewed: new Set(reviews.map(r => r.employee_id)).size,
    goalsByType: {
      okr: goals.filter(g => g.goal_type === 'okr').length,
      kpi: goals.filter(g => g.goal_type === 'kpi').length,
      project: goals.filter(g => g.goal_type === 'project').length,
      personal: goals.filter(g => g.goal_type === 'personal').length,
      team: goals.filter(g => g.goal_type === 'team').length
    },
    goalsByDepartment: departments.map(dept => ({
      name: dept.name,
      count: goals.filter(g => g.employee?.department_id === dept.id).length
    }))
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Award className="h-8 w-8 text-yellow-600" />
            Performance Management
          </h1>
          <p className="text-slate-600 mt-2">Manage goals, reviews & organizational performance</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedGoal(null);
              resetGoalForm();
              setShowGoalModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-medium"
          >
            <Plus className="h-5 w-5" />
            New Goal
          </button>
          <button
            onClick={() => {
              setSelectedReview(null);
              resetReviewForm();
              setShowReviewModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-medium"
          >
            <Star className="h-5 w-5" />
            New Review
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Target className="h-8 w-8 opacity-80" />
            <span className="text-3xl font-bold">{analytics.totalGoals}</span>
          </div>
          <p className="text-blue-100 font-medium">Total Goals</p>
          <p className="text-xs text-blue-200 mt-1">{analytics.activeGoals} active</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="h-8 w-8 opacity-80" />
            <span className="text-3xl font-bold">{analytics.completedGoals}</span>
          </div>
          <p className="text-emerald-100 font-medium">Completed Goals</p>
          <p className="text-xs text-emerald-200 mt-1">
            {analytics.totalGoals > 0 ? Math.round((analytics.completedGoals / analytics.totalGoals) * 100) : 0}% completion rate
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="h-8 w-8 opacity-80" />
            <span className="text-3xl font-bold">{analytics.overdueGoals}</span>
          </div>
          <p className="text-red-100 font-medium">Overdue Goals</p>
          <p className="text-xs text-red-200 mt-1">Requires attention</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Star className="h-8 w-8 opacity-80" />
            <span className="text-3xl font-bold">{analytics.avgRating}</span>
          </div>
          <p className="text-yellow-100 font-medium">Avg Performance</p>
          <p className="text-xs text-yellow-200 mt-1">{analytics.totalReviews} reviews</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('goals')}
              className={`px-6 py-4 font-semibold transition-colors ${
                activeTab === 'goals'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Goals ({analytics.totalGoals})
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-6 py-4 font-semibold transition-colors ${
                activeTab === 'reviews'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reviews ({analytics.totalReviews})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-4 font-semibold transition-colors ${
                activeTab === 'analytics'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Analytics
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'goals' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search goals or employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="all">All Types</option>
                  <option value="okr">OKR</option>
                  <option value="kpi">KPI</option>
                  <option value="project">Project</option>
                  <option value="personal">Personal</option>
                  <option value="team">Team</option>
                </select>
              </div>

              {/* Goals List */}
              {filteredGoals.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No goals found</p>
                  <button
                    onClick={() => {
                      setSelectedGoal(null);
                      resetGoalForm();
                      setShowGoalModal(true);
                    }}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create First Goal
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-slate-900">{goal.title}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              goal.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              goal.status === 'overdue' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {goal.status.toUpperCase()}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                              {goal.goal_type.toUpperCase()}
                            </span>
                          </div>
                          {goal.description && (
                            <p className="text-slate-600 text-sm mb-3">{goal.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {goal.employee?.first_name} {goal.employee?.last_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Due: {new Date(goal.end_date).toLocaleDateString()}
                            </span>
                            {goal.target_value && (
                              <span className="flex items-center gap-1">
                                <BarChart3 className="h-4 w-4" />
                                Target: {goal.current_value || 0}/{goal.target_value} {goal.unit}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditGoalModal(goal)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Goal"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Goal"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-700">Progress</span>
                          <span className="text-sm font-bold text-slate-900">{goal.progress}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              goal.progress === 100 ? 'bg-emerald-500' :
                              goal.progress >= 75 ? 'bg-blue-500' :
                              goal.progress >= 50 ? 'bg-yellow-500' :
                              'bg-orange-500'
                            }`}
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Reviews List */}
              {filteredReviews.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No reviews found</p>
                  <button
                    onClick={() => {
                      setSelectedReview(null);
                      resetReviewForm();
                      setShowReviewModal(true);
                    }}
                    className="mt-4 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    Create First Review
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReviews.map((review) => (
                    <div
                      key={review.id}
                      className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-slate-900">
                              {review.employee?.first_name} {review.employee?.last_name}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              review.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              review.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {review.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-slate-600 text-sm mb-2">
                            {review.review_type.replace('_', ' ').toUpperCase()} - {review.review_cycle}
                          </p>
                          {review.rating && (
                            <div className="flex items-center gap-2 mb-3">
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-5 w-5 ${
                                      i < review.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-sm font-bold text-slate-900">
                                {review.rating}/5
                              </span>
                            </div>
                          )}
                          {review.feedback && (
                            <p className="text-sm text-slate-600 line-clamp-2">{review.feedback}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditReviewModal(review)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Review"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {review.review_date && (
                        <p className="text-xs text-slate-400">
                          Reviewed on {new Date(review.review_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-blue-900">{analytics.employeesWithGoals}</p>
                      <p className="text-sm text-blue-700 font-medium">Employees with Goals</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600">
                    {employees.length > 0 ? Math.round((analytics.employeesWithGoals / employees.length) * 100) : 0}% of total employees
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="h-12 w-12 bg-purple-600 rounded-xl flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-purple-900">{analytics.avgProgress}%</p>
                      <p className="text-sm text-purple-700 font-medium">Avg Goal Progress</p>
                    </div>
                  </div>
                  <p className="text-xs text-purple-600">Across all active goals</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="h-12 w-12 bg-yellow-600 rounded-xl flex items-center justify-center">
                      <Star className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-yellow-900">{analytics.employeesReviewed}</p>
                      <p className="text-sm text-yellow-700 font-medium">Employees Reviewed</p>
                    </div>
                  </div>
                  <p className="text-xs text-yellow-600">
                    {employees.length > 0 ? Math.round((analytics.employeesReviewed / employees.length) * 100) : 0}% coverage
                  </p>
                </div>
              </div>

              {/* Goals by Type */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Goals by Type</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.goalsByType).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700 w-24 capitalize">{type}</span>
                      <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-end pr-3"
                          style={{ width: `${analytics.totalGoals > 0 ? (count / analytics.totalGoals) * 100 : 0}%` }}
                        >
                          <span className="text-xs font-bold text-white">{count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Goals by Department */}
              {analytics.goalsByDepartment.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Goals by Department
                  </h3>
                  <div className="space-y-3">
                    {analytics.goalsByDepartment.map((dept) => (
                      <div key={dept.name} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-700 w-32 truncate">{dept.name}</span>
                        <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-end pr-3"
                            style={{ width: `${analytics.totalGoals > 0 ? (dept.count / analytics.totalGoals) * 100 : 0}%` }}
                          >
                            <span className="text-xs font-bold text-white">{dept.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Performance Distribution */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Performance Overview</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="h-20 w-20 mx-auto mb-2 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{analytics.completedGoals}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">Completed</p>
                    <p className="text-xs text-slate-500">
                      {analytics.totalGoals > 0 ? Math.round((analytics.completedGoals / analytics.totalGoals) * 100) : 0}%
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="h-20 w-20 mx-auto mb-2 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{analytics.activeGoals}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">Active</p>
                    <p className="text-xs text-slate-500">
                      {analytics.totalGoals > 0 ? Math.round((analytics.activeGoals / analytics.totalGoals) * 100) : 0}%
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="h-20 w-20 mx-auto mb-2 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{analytics.overdueGoals}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">Overdue</p>
                    <p className="text-xs text-slate-500">
                      {analytics.totalGoals > 0 ? Math.round((analytics.overdueGoals / analytics.totalGoals) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold">
                {selectedGoal ? 'Edit Goal' : 'Create New Goal'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Employee *
                </label>
                <select
                  value={goalForm.employee_id}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, employee_id: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!!selectedGoal}
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.designation_id || 'No designation'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Goal Title *
                </label>
                <input
                  type="text"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Increase sales by 20%"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={goalForm.description}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the goal objectives..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Goal Type *
                  </label>
                  <select
                    value={goalForm.goal_type}
                    onChange={(e) => setGoalForm(prev => ({ ...prev, goal_type: e.target.value as any }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="okr">OKR</option>
                    <option value="kpi">KPI</option>
                    <option value="project">Project</option>
                    <option value="personal">Personal</option>
                    <option value="team">Team</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Progress (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={goalForm.progress}
                    onChange={(e) => setGoalForm(prev => ({ ...prev, progress: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Target Value
                  </label>
                  <input
                    type="number"
                    value={goalForm.target_value}
                    onChange={(e) => setGoalForm(prev => ({ ...prev, target_value: e.target.value }))}
                    placeholder="100"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={goalForm.unit}
                    onChange={(e) => setGoalForm(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="sales, hours, etc."
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={goalForm.start_date}
                    onChange={(e) => setGoalForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={goalForm.end_date}
                    onChange={(e) => setGoalForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowGoalModal(false);
                  setSelectedGoal(null);
                  resetGoalForm();
                }}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={selectedGoal ? handleUpdateGoal : handleCreateGoal}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                {selectedGoal ? 'Update Goal' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold">
                {selectedReview ? 'Edit Performance Review' : 'Create Performance Review'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Employee *
                </label>
                <select
                  value={reviewForm.employee_id}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, employee_id: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!!selectedReview}
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Review Type *
                  </label>
                  <select
                    value={reviewForm.review_type}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, review_type: e.target.value as any }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="quarterly">Quarterly</option>
                    <option value="half_yearly">Half Yearly</option>
                    <option value="annual">Annual</option>
                    <option value="probation">Probation</option>
                    <option value="performance_improvement">Performance Improvement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Review Cycle *
                  </label>
                  <input
                    type="text"
                    value={reviewForm.review_cycle}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, review_cycle: e.target.value }))}
                    placeholder="Q1 2025"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Rating (1-5)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setReviewForm(prev => ({ ...prev, rating }))}
                      className="p-2"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          rating <= reviewForm.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-lg font-bold text-slate-900">
                    {reviewForm.rating}/5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Overall Feedback
                </label>
                <textarea
                  value={reviewForm.feedback}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, feedback: e.target.value }))}
                  placeholder="Provide general performance feedback..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Strengths
                </label>
                <textarea
                  value={reviewForm.strengths}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, strengths: e.target.value }))}
                  placeholder="What are the employee's key strengths?"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Areas for Improvement
                </label>
                <textarea
                  value={reviewForm.areas_for_improvement}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, areas_for_improvement: e.target.value }))}
                  placeholder="What areas need development?"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reviewForm.goals_met}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, goals_met: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">Goals Met</span>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedReview(null);
                  resetReviewForm();
                }}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={selectedReview ? handleUpdateReview : handleCreateReview}
                className="px-6 py-2 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 transition-colors font-medium"
              >
                {selectedReview ? 'Update Review' : 'Create Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
