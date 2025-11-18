import { useState, useEffect } from 'react';
import {
  Award,
  Target,
  TrendingUp,
  Calendar,
  CheckCircle,
  AlertCircle,
  Edit,
  Eye,
  BarChart3,
  Star,
  MessageSquare
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Goal, PerformanceReview, GoalUpdate, Employee } from '../../lib/database.types';

interface GoalWithUpdates extends Goal {
  employee?: Employee;
  updates?: GoalUpdate[];
  latest_update?: GoalUpdate;
}

interface ReviewWithReviewer extends PerformanceReview {
  reviewer?: Employee;
}

export function EmployeePerformancePage() {
  const { membership } = useAuth();
  const [goals, setGoals] = useState<GoalWithUpdates[]>([]);
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<GoalWithUpdates | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewWithReviewer | null>(null);
  const [progressUpdate, setProgressUpdate] = useState({ progress: 0, notes: '' });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (membership?.employee_id) {
      fetchPerformanceData();
      subscribeToChanges();
    }
  }, [membership?.employee_id]);

  const fetchPerformanceData = async () => {
    if (!membership?.employee_id) return;

    try {
      setLoading(true);

      // Fetch goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select(`
          *,
          employee:employees(*)
        `)
        .eq('employee_id', membership.employee_id)
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      // Fetch updates for each goal
      const goalsWithUpdates = await Promise.all(
        (goalsData || []).map(async (goal) => {
          const { data: updates } = await supabase
            .from('goal_updates')
            .select('*')
            .eq('goal_id', goal.id)
            .order('created_at', { ascending: false });

          return {
            ...goal,
            updates: updates || [],
            latest_update: updates?.[0]
          };
        })
      );

      setGoals(goalsWithUpdates);

      // Fetch performance reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('performance_reviews')
        .select(`
          *,
          reviewer:reviewer_id(*)
        `)
        .eq('employee_id', membership.employee_id)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;
      setReviews(reviewsData || []);

    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    if (!membership?.employee_id) return;

    // Subscribe to goal changes
    const goalsSubscription = supabase
      .channel('employee-goals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
          filter: `employee_id=eq.${membership.employee_id}`
        },
        () => {
          fetchPerformanceData();
        }
      )
      .subscribe();

    // Subscribe to review changes
    const reviewsSubscription = supabase
      .channel('employee-reviews')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'performance_reviews',
          filter: `employee_id=eq.${membership.employee_id}`
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

  const handleProgressUpdate = async () => {
    if (!selectedGoal || !membership?.employee_id) return;

    try {
      // Create goal update
      const { error: updateError } = await supabase
        .from('goal_updates')
        .insert({
          goal_id: selectedGoal.id,
          updated_by: membership.employee_id,
          progress: progressUpdate.progress,
          notes: progressUpdate.notes
        });

      if (updateError) throw updateError;

      // Update goal progress
      const { error: goalError } = await supabase
        .from('goals')
        .update({
          progress: progressUpdate.progress,
          status: progressUpdate.progress >= 100 ? 'completed' : 
                  new Date(selectedGoal.end_date) < new Date() && progressUpdate.progress < 100 ? 'overdue' : 'active',
          completed_at: progressUpdate.progress >= 100 ? new Date().toISOString() : null
        })
        .eq('id', selectedGoal.id);

      if (goalError) throw goalError;

      setSelectedGoal(null);
      setProgressUpdate({ progress: 0, notes: '' });
      fetchPerformanceData();
    } catch (error) {
      console.error('Error updating progress:', error);
      alert('Failed to update progress');
    }
  };

  const handleRequestCompletion = async (goal: Goal) => {
    if (!membership?.employee_id) return;

    try {
      const { error } = await supabase
        .from('goal_updates')
        .insert({
          goal_id: goal.id,
          updated_by: membership.employee_id,
          progress: 100,
          notes: 'Completion request submitted for review'
        });

      if (error) throw error;

      await supabase
        .from('goals')
        .update({ progress: 100 })
        .eq('id', goal.id);

      fetchPerformanceData();
      alert('Completion request submitted successfully');
    } catch (error) {
      console.error('Error requesting completion:', error);
      alert('Failed to submit completion request');
    }
  };

  const filteredGoals = goals.filter(goal => {
    if (filterStatus !== 'all' && goal.status !== filterStatus) return false;
    if (filterType !== 'all' && goal.goal_type !== filterType) return false;
    return true;
  });

  const stats = {
    activeGoals: goals.filter(g => g.status === 'active').length,
    completedGoals: goals.filter(g => g.status === 'completed').length,
    overdueGoals: goals.filter(g => g.status === 'overdue').length,
    avgProgress: goals.length > 0 
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
      : 0,
    avgRating: reviews.length > 0 && reviews.some(r => r.rating)
      ? (reviews.filter(r => r.rating).reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.filter(r => r.rating).length).toFixed(1)
      : 'N/A'
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
            My Performance
          </h1>
          <p className="text-slate-600 mt-2">Track your goals and performance reviews</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Target className="h-8 w-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.activeGoals}</span>
          </div>
          <p className="text-blue-100 font-medium">Active Goals</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="h-8 w-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.completedGoals}</span>
          </div>
          <p className="text-emerald-100 font-medium">Completed</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="h-8 w-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.overdueGoals}</span>
          </div>
          <p className="text-red-100 font-medium">Overdue</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-8 w-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.avgProgress}%</span>
          </div>
          <p className="text-purple-100 font-medium">Avg Progress</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Star className="h-8 w-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.avgRating}</span>
          </div>
          <p className="text-yellow-100 font-medium">Avg Rating</p>
        </div>
      </div>

      {/* Goals Section */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-blue-600" />
              My Goals
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="all">All Types</option>
                <option value="okr">OKR</option>
                <option value="kpi">KPI</option>
                <option value="project">Project</option>
                <option value="personal">Personal</option>
                <option value="team">Team</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6">
          {filteredGoals.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No goals assigned yet</p>
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
                      {goal.status !== 'completed' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedGoal(goal);
                              setProgressUpdate({ progress: goal.progress, notes: '' });
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
                          >
                            <Edit className="h-4 w-4" />
                            Update Progress
                          </button>
                          {goal.progress >= 90 && goal.progress < 100 && (
                            <button
                              onClick={() => handleRequestCompletion(goal)}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm font-medium"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Request Completion
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
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

                  {/* Latest Update */}
                  {goal.latest_update && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-slate-400 mt-1" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-600">{goal.latest_update.notes}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Updated {new Date(goal.latest_update.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance Reviews Section */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-600" />
            Performance Reviews
          </h2>
        </div>

        <div className="p-6">
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No performance reviews yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-slate-900">
                          {review.review_type.replace('_', ' ').toUpperCase()} Review
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
                        Review Cycle: {review.review_cycle}
                      </p>
                      {review.rating && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-medium text-slate-700">Rating:</span>
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
                    </div>
                    <button
                      onClick={() => setSelectedReview(review)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </button>
                  </div>

                  {review.feedback && (
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-slate-700 mb-1">Feedback:</h4>
                      <p className="text-sm text-slate-600">{review.feedback}</p>
                    </div>
                  )}

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
      </div>

      {/* Update Progress Modal */}
      {selectedGoal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold">Update Goal Progress</h2>
              <p className="text-slate-600 mt-1">{selectedGoal.title}</p>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Progress (%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressUpdate.progress}
                  onChange={(e) => setProgressUpdate(prev => ({ ...prev, progress: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-slate-600 mt-1">
                  <span>0%</span>
                  <span className="font-bold text-lg">{progressUpdate.progress}%</span>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Update Notes
                </label>
                <textarea
                  value={progressUpdate.notes}
                  onChange={(e) => setProgressUpdate(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Describe what you've accomplished..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                />
              </div>

              {/* Progress History */}
              {selectedGoal.updates && selectedGoal.updates.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Progress History</h3>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {selectedGoal.updates.map((update) => (
                      <div key={update.id} className="border-l-2 border-blue-500 pl-4 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900">{update.progress}%</span>
                          <span className="text-xs text-slate-400">
                            {new Date(update.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {update.notes && (
                          <p className="text-sm text-slate-600">{update.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedGoal(null);
                  setProgressUpdate({ progress: 0, notes: '' });
                }}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleProgressUpdate}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
              >
                <CheckCircle className="h-5 w-5" />
                Update Progress
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Details Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold">Performance Review Details</h2>
              <p className="text-slate-600 mt-1">
                {selectedReview.review_type.replace('_', ' ').toUpperCase()} - {selectedReview.review_cycle}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {selectedReview.rating && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Overall Rating</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-8 w-8 ${
                            i < selectedReview.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-2xl font-bold text-slate-900">
                      {selectedReview.rating}/5
                    </span>
                  </div>
                </div>
              )}

              {selectedReview.feedback && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Feedback</h3>
                  <p className="text-slate-600 bg-slate-50 p-4 rounded-xl">{selectedReview.feedback}</p>
                </div>
              )}

              {selectedReview.strengths && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Strengths</h3>
                  <p className="text-slate-600 bg-emerald-50 p-4 rounded-xl">{selectedReview.strengths}</p>
                </div>
              )}

              {selectedReview.areas_for_improvement && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Areas for Improvement</h3>
                  <p className="text-slate-600 bg-orange-50 p-4 rounded-xl">{selectedReview.areas_for_improvement}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Review Date</h3>
                  <p className="text-slate-600">
                    {selectedReview.review_date 
                      ? new Date(selectedReview.review_date).toLocaleDateString()
                      : 'Not completed yet'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Status</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedReview.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    selectedReview.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedReview.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedReview(null)}
                className="px-6 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
