import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Github, GitCommit, GitPullRequest, TrendingUp, Users, Award, Search } from 'lucide-react';

interface EmployeeStats {
  employee_id: string;
  employee_name: string;
  github_username: string;
  total_commits: number;
  total_prs: number;
  merged_prs: number;
  total_issues: number;
  productivity_score: number;
  last_active: string;
}

export function OwnerGitHubPage() {
  const { organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeStats[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [repos, setRepos] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'commits' | 'prs'>('score');

  useEffect(() => {
    if (organization?.id) {
      loadAnalytics();
    }
  }, [organization?.id, dateRange]);

  const loadAnalytics = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      await Promise.all([loadEmployeeStats(), loadTeamMetrics(), loadRepositories()]);
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeStats = async () => {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));

    // Get connected employees with their stats
    const { data: connections } = await supabase
      .from('github_employee_connections')
      .select('employee_id, github_username, last_synced_at')
      .eq('organization_id', organization!.id)
      .eq('connection_status', 'connected');

    if (!connections || connections.length === 0) {
      setEmployees([]);
      return;
    }

    const employeeIds = connections.map((c) => c.employee_id);

    // Get employee names
    const { data: empData } = await supabase
      .from('employees')
      .select('id, full_name')
      .in('id', employeeIds);

    const empMap = new Map(empData?.map((e) => [e.id, e.full_name]) || []);

    // Get commits count per employee
    const { data: commitCounts } = await supabase
      .from('github_commits')
      .select('employee_id')
      .eq('organization_id', organization!.id)
      .gte('committed_at', daysAgo.toISOString())
      .in('employee_id', employeeIds);

    // Get PRs count per employee
    const { data: prCounts } = await supabase
      .from('github_pull_requests')
      .select('employee_id, status')
      .eq('organization_id', organization!.id)
      .gte('created_at_github', daysAgo.toISOString())
      .in('employee_id', employeeIds);

    // Get issues count per employee
    const { data: issueCounts } = await supabase
      .from('github_issues')
      .select('employee_id')
      .eq('organization_id', organization!.id)
      .gte('created_at_github', daysAgo.toISOString())
      .in('employee_id', employeeIds);

    // Get productivity scores (weekly)
    const { data: scores } = await supabase
      .from('github_productivity_scores')
      .select('employee_id, overall_score, period_start')
      .eq('organization_id', organization!.id)
      .eq('period_type', 'week')
      .in('employee_id', employeeIds)
      .order('period_start', { ascending: false });

    const latestScores = new Map<string, number>();
    scores?.forEach((s) => {
      if (!latestScores.has(s.employee_id)) {
        latestScores.set(s.employee_id, s.overall_score);
      }
    });

    const stats: EmployeeStats[] = connections.map((conn) => {
      const commits = commitCounts?.filter((c) => c.employee_id === conn.employee_id).length || 0;
      const prs = prCounts?.filter((p) => p.employee_id === conn.employee_id) || [];
      const issues = issueCounts?.filter((i) => i.employee_id === conn.employee_id).length || 0;
      const merged = prs.filter((p) => p.status === 'merged').length;

      return {
        employee_id: conn.employee_id,
        employee_name: empMap.get(conn.employee_id) || 'Unknown',
        github_username: conn.github_username || '',
        total_commits: commits,
        total_prs: prs.length,
        merged_prs: merged,
        total_issues: issues,
        productivity_score: latestScores.get(conn.employee_id) || 0,
        last_active: conn.last_synced_at || '',
      };
    });

    setEmployees(stats);
  };

  const loadTeamMetrics = async () => {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));

    const { data } = await supabase
      .from('github_activity_metrics')
      .select('*')
      .eq('organization_id', organization!.id)
      .gte('activity_date', daysAgo.toISOString().split('T')[0])
      .order('activity_date', { ascending: true });

    setMetrics(data || []);
  };

  const loadRepositories = async () => {
    const { data } = await supabase
      .from('github_repositories')
      .select('*, github_employee_connections!inner(github_username)')
      .eq('organization_id', organization!.id)
      .order('stars_count', { ascending: false })
      .limit(10);

    setRepos(data || []);
  };

  const filteredEmployees = employees
    .filter((e) => e.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) || e.github_username.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'score') return b.productivity_score - a.productivity_score;
      if (sortBy === 'commits') return b.total_commits - a.total_commits;
      if (sortBy === 'prs') return b.total_prs - a.total_prs;
      return 0;
    });

  const totalCommits = employees.reduce((sum, e) => sum + e.total_commits, 0);
  const totalPRs = employees.reduce((sum, e) => sum + e.total_prs, 0);
  const totalMergedPRs = employees.reduce((sum, e) => sum + e.merged_prs, 0);
  const avgScore = employees.length > 0 ? employees.reduce((sum, e) => sum + e.productivity_score, 0) / employees.length : 0;

  const topContributor = filteredEmployees[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Github className="h-8 w-8 text-slate-900" />
            GitHub Analytics
          </h1>
          <p className="text-slate-600 mt-2">Team productivity and contribution metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-4 py-2 border rounded-xl bg-white"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-6">
          <Users className="h-6 w-6 mb-2 opacity-80" />
          <div className="text-3xl font-bold">{employees.length}</div>
          <div className="text-sm opacity-90">Connected Developers</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-6">
          <GitCommit className="h-6 w-6 mb-2 opacity-80" />
          <div className="text-3xl font-bold">{totalCommits}</div>
          <div className="text-sm opacity-90">Total Commits</div>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 text-white rounded-2xl p-6">
          <GitPullRequest className="h-6 w-6 mb-2 opacity-80" />
          <div className="text-3xl font-bold">{totalMergedPRs}/{totalPRs}</div>
          <div className="text-sm opacity-90">PRs Merged</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl p-6">
          <TrendingUp className="h-6 w-6 mb-2 opacity-80" />
          <div className="text-3xl font-bold">{avgScore.toFixed(0)}</div>
          <div className="text-sm opacity-90">Avg. Productivity Score</div>
        </div>
      </div>

      {/* Team Activity Graph */}
      {metrics.length > 0 && (
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="text-lg font-semibold mb-4">Team Activity Trend</h3>
          <div className="flex items-end gap-1 h-40">
            {metrics.slice(-parseInt(dateRange)).map((m, i) => {
              const dailyCommits = m.commits_count || 0;
              const maxCommits = Math.max(...metrics.map((x) => x.commits_count || 0), 1);
              const height = Math.max(5, (dailyCommits / maxCommits) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center group relative">
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    {new Date(m.activity_date).toLocaleDateString()}: {dailyCommits} commits
                  </div>
                  <div style={{ height: `${height}%` }} className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t"></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Contributor Highlight */}
      {topContributor && (
        <div className="bg-gradient-to-br from-violet-500 to-pink-500 text-white rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Award className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Top Contributor</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{topContributor.employee_name}</div>
              <div className="opacity-90">@{topContributor.github_username}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{topContributor.productivity_score.toFixed(0)}</div>
              <div className="text-sm opacity-90">Productivity Score</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/20">
            <div>
              <div className="text-xl font-semibold">{topContributor.total_commits}</div>
              <div className="text-sm opacity-90">Commits</div>
            </div>
            <div>
              <div className="text-xl font-semibold">{topContributor.merged_prs}/{topContributor.total_prs}</div>
              <div className="text-sm opacity-90">PRs Merged</div>
            </div>
            <div>
              <div className="text-xl font-semibold">{topContributor.total_issues}</div>
              <div className="text-sm opacity-90">Issues</div>
            </div>
          </div>
        </div>
      )}

      {/* Employee List */}
      <div className="bg-white rounded-2xl border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Developer Leaderboard</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search developers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border rounded-xl bg-white w-64"
                />
              </div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="px-4 py-2 border rounded-xl bg-white">
                <option value="score">Sort by Score</option>
                <option value="commits">Sort by Commits</option>
                <option value="prs">Sort by PRs</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y">
          {filteredEmployees.map((emp, idx) => (
            <div key={emp.employee_id} className="p-6 hover:bg-slate-50">
              <div className="flex items-center gap-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white font-bold text-lg">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{emp.employee_name}</div>
                  <div className="text-sm text-slate-600">@{emp.github_username}</div>
                </div>
                <div className="grid grid-cols-4 gap-8 text-center">
                  <div>
                    <div className="text-2xl font-bold text-violet-600">{emp.productivity_score.toFixed(0)}</div>
                    <div className="text-xs text-slate-600">Score</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-600">{emp.total_commits}</div>
                    <div className="text-xs text-slate-600">Commits</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {emp.merged_prs}/{emp.total_prs}
                    </div>
                    <div className="text-xs text-slate-600">PRs</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{emp.total_issues}</div>
                    <div className="text-xs text-slate-600">Issues</div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredEmployees.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <Github className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No developers found</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Repositories */}
      {repos.length > 0 && (
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="text-lg font-semibold mb-4">Top Repositories</h3>
          <div className="space-y-3">
            {repos.slice(0, 5).map((repo) => (
              <div key={repo.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-slate-50">
                <div>
                  <a href={repo.html_url} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">
                    {repo.repo_name}
                  </a>
                  <div className="text-xs text-slate-600 mt-1">
                    by @{(repo as any).github_employee_connections?.github_username}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  {repo.language && <span className="px-2 py-1 bg-slate-100 rounded">{repo.language}</span>}
                  <span>⭐ {repo.stars_count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
