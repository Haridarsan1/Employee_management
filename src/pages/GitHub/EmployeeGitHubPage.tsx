import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { syncEmployeeGitHubData, calculateProductivityScore } from '../../lib/github';
import { AlertCircle, Github, GitCommit, GitPullRequest, GitBranch, Code, Star, RefreshCw, Loader2 } from 'lucide-react';

export function EmployeeGitHubPage() {
  const { organization, membership } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connection, setConnection] = useState<any>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [score, setScore] = useState<any>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'repos' | 'commits' | 'prs' | 'issues'>('overview');

  useEffect(() => {
    if (organization?.id && membership?.employee_id) {
      loadGitHubData();
    }
  }, [organization?.id, membership?.employee_id]);

  const loadGitHubData = async () => {
    if (!organization?.id || !membership?.employee_id) return;
    setLoading(true);
    try {
      const { data: conn } = await supabase
        .from('github_employee_connections')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('employee_id', membership.employee_id)
        .maybeSingle();

      setConnection(conn);

      if (conn && conn.connection_status === 'connected') {
        await Promise.all([
          loadRepos(),
          loadCommits(),
          loadPRs(),
          loadIssues(),
          loadMetrics(),
          loadScore(),
        ]);
      }
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadRepos = async () => {
    const { data } = await supabase
      .from('github_repositories')
      .select('*')
      .eq('organization_id', organization!.id)
      .eq('employee_id', membership!.employee_id)
      .order('stars_count', { ascending: false });
    setRepos(data || []);
  };

  const loadCommits = async () => {
    const { data } = await supabase
      .from('github_commits')
      .select('*, github_repositories(repo_name)')
      .eq('organization_id', organization!.id)
      .eq('employee_id', membership!.employee_id)
      .order('committed_at', { ascending: false })
      .limit(50);
    setCommits(data || []);
  };

  const loadPRs = async () => {
    const { data } = await supabase
      .from('github_pull_requests')
      .select('*, github_repositories(repo_name)')
      .eq('organization_id', organization!.id)
      .eq('employee_id', membership!.employee_id)
      .order('created_at_github', { ascending: false })
      .limit(30);
    setPrs(data || []);
  };

  const loadIssues = async () => {
    const { data } = await supabase
      .from('github_issues')
      .select('*, github_repositories(repo_name)')
      .eq('organization_id', organization!.id)
      .eq('employee_id', membership!.employee_id)
      .order('created_at_github', { ascending: false })
      .limit(30);
    setIssues(data || []);
  };

  const loadMetrics = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data } = await supabase
      .from('github_activity_metrics')
      .select('*')
      .eq('organization_id', organization!.id)
      .eq('employee_id', membership!.employee_id)
      .gte('activity_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('activity_date', { ascending: true });
    setMetrics(data || []);
  };

  const loadScore = async () => {
    const { data } = await supabase
      .from('github_productivity_scores')
      .select('*')
      .eq('organization_id', organization!.id)
      .eq('employee_id', membership!.employee_id)
      .eq('period_type', 'week')
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    setScore(data);
  };

  const handleConnect = async () => {
    if (!tokenInput.trim() || !organization?.id || !membership?.employee_id || !membership?.user_id) {
      setAlert({ type: 'error', message: 'Please enter a valid GitHub token' });
      return;
    }
    setSyncing(true);
    setAlert(null);
    try {
      await syncEmployeeGitHubData(organization.id, membership.employee_id, membership.user_id, tokenInput);
      await calculateProductivityScore(organization.id, membership.employee_id, 'week');
      await calculateProductivityScore(organization.id, membership.employee_id, 'month');
      setAlert({ type: 'success', message: 'GitHub connected and synced successfully!' });
      setShowConnect(false);
      setTokenInput('');
      await loadGitHubData();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to connect GitHub' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    if (!connection || !organization?.id || !membership?.employee_id || !membership?.user_id) return;
    setSyncing(true);
    setAlert(null);
    try {
      await syncEmployeeGitHubData(organization.id, membership.employee_id, membership.user_id, connection.github_token);
      await calculateProductivityScore(organization.id, membership.employee_id, 'week');
      await calculateProductivityScore(organization.id, membership.employee_id, 'month');
      setAlert({ type: 'success', message: 'GitHub data synced successfully!' });
      await loadGitHubData();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!connection || connection.connection_status !== 'connected') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Github className="h-8 w-8 text-slate-900" />
              GitHub Integration
            </h1>
            <p className="text-slate-600 mt-2">Connect your GitHub account to track activity and contributions</p>
          </div>
        </div>

        {alert && (
          <div className={`p-4 rounded-xl ${alert.type === 'error' ? 'bg-red-50 text-red-700' : alert.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
            {alert.message}
          </div>
        )}

        <div className="bg-white rounded-2xl border p-8 text-center">
          <Github className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connect Your GitHub Account</h2>
          <p className="text-slate-600 mb-6">
            Connect your GitHub account to sync repositories, commits, pull requests, and track your developer productivity.
          </p>

          {!showConnect ? (
            <button
              onClick={() => setShowConnect(true)}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 flex items-center gap-2 mx-auto"
            >
              <Github className="h-5 w-5" />
              Connect GitHub
            </button>
          ) : (
            <div className="max-w-md mx-auto space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">GitHub Personal Access Token</label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="w-full px-4 py-2 rounded-xl border bg-white"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Generate a token at{' '}
                  <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    github.com/settings/tokens
                  </a>{' '}
                  with <code className="bg-slate-100 px-1 rounded">repo</code> and <code className="bg-slate-100 px-1 rounded">user</code> scopes.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleConnect}
                  disabled={syncing}
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-60"
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Connect'}
                </button>
                <button onClick={() => setShowConnect(false)} className="px-4 py-2 border rounded-xl hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const totalCommits = commits.length;
  const totalPRs = prs.length;
  const mergedPRs = prs.filter((p) => p.status === 'merged').length;
  const totalIssues = issues.length;
  const openIssues = issues.filter((i) => i.status === 'open').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Github className="h-8 w-8 text-slate-900" />
            GitHub Dashboard
          </h1>
          <p className="text-slate-600 mt-2">
            Connected as <span className="font-semibold">{connection.github_username}</span>
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          Sync Now
        </button>
      </div>

      {alert && (
        <div className={`p-4 rounded-xl ${alert.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {alert.message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-5">
          <Code className="h-6 w-6 mb-2 opacity-80" />
          <div className="text-2xl font-bold">{repos.length}</div>
          <div className="text-sm opacity-90">Repositories</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-5">
          <GitCommit className="h-6 w-6 mb-2 opacity-80" />
          <div className="text-2xl font-bold">{totalCommits}</div>
          <div className="text-sm opacity-90">Commits</div>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 text-white rounded-2xl p-5">
          <GitPullRequest className="h-6 w-6 mb-2 opacity-80" />
          <div className="text-2xl font-bold">{mergedPRs}/{totalPRs}</div>
          <div className="text-sm opacity-90">PRs Merged</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl p-5">
          <AlertCircle className="h-6 w-6 mb-2 opacity-80" />
          <div className="text-2xl font-bold">{openIssues}/{totalIssues}</div>
          <div className="text-sm opacity-90">Open Issues</div>
        </div>
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-2xl p-5">
          <Star className="h-6 w-6 mb-2 opacity-80" />
          <div className="text-2xl font-bold">{score?.overall_score?.toFixed(0) || 0}</div>
          <div className="text-sm opacity-90">Productivity Score</div>
        </div>
      </div>

      {/* Activity Graph */}
      {metrics.length > 0 && (
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="text-lg font-semibold mb-4">30-Day Activity</h3>
          <div className="flex items-end gap-1 h-32">
            {metrics.map((m, i) => {
              const height = Math.max(5, (m.commits_count / Math.max(...metrics.map((x) => x.commits_count))) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center group relative">
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    {new Date(m.activity_date).toLocaleDateString()}: {m.commits_count} commits
                  </div>
                  <div style={{ height: `${height}%` }} className="w-full bg-emerald-500 rounded-t"></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl border">
        <div className="border-b flex gap-4 px-6">
          {(['overview', 'repos', 'commits', 'prs', 'issues'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium ${activeTab === tab ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-500'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'repos' && (
            <div className="space-y-3">
              {repos.map((repo) => (
                <div key={repo.id} className="border rounded-xl p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <a href={repo.html_url} target="_blank" rel="noreferrer" className="text-lg font-semibold text-blue-600 hover:underline">
                        {repo.repo_name}
                      </a>
                      {repo.description && <p className="text-slate-600 text-sm mt-1">{repo.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        {repo.language && <span className="flex items-center gap-1"><Code className="h-3 w-3" />{repo.language}</span>}
                        <span className="flex items-center gap-1"><Star className="h-3 w-3" />{repo.stars_count}</span>
                        <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />{repo.forks_count}</span>
                        {repo.is_private && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded">Private</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'commits' && (
            <div className="space-y-3">
              {commits.slice(0, 20).map((commit) => (
                <div key={commit.id} className="border rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <GitCommit className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <a href={commit.html_url} target="_blank" rel="noreferrer" className="font-medium text-slate-900 hover:text-blue-600">
                        {commit.message.split('\n')[0]}
                      </a>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{(commit as any).github_repositories?.repo_name}</span>
                        <span>{new Date(commit.committed_at).toLocaleString()}</span>
                        <span className="text-emerald-600">+{commit.additions}</span>
                        <span className="text-red-600">-{commit.deletions}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'prs' && (
            <div className="space-y-3">
              {prs.map((pr) => (
                <div key={pr.id} className="border rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <GitPullRequest className={`h-5 w-5 flex-shrink-0 mt-1 ${pr.status === 'merged' ? 'text-violet-600' : pr.status === 'open' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <a href={pr.html_url} target="_blank" rel="noreferrer" className="font-medium text-slate-900 hover:text-blue-600">
                        #{pr.pr_number} {pr.title}
                      </a>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{(pr as any).github_repositories?.repo_name}</span>
                        <span className={`px-2 py-0.5 rounded ${pr.status === 'merged' ? 'bg-violet-100 text-violet-700' : pr.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                          {pr.status}
                        </span>
                        <span className="text-emerald-600">+{pr.additions}</span>
                        <span className="text-red-600">-{pr.deletions}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="space-y-3">
              {issues.map((issue) => (
                <div key={issue.id} className="border rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-1 ${issue.status === 'open' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <a href={issue.html_url} target="_blank" rel="noreferrer" className="font-medium text-slate-900 hover:text-blue-600">
                        #{issue.issue_number} {issue.title}
                      </a>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{(issue as any).github_repositories?.repo_name}</span>
                        <span className={`px-2 py-0.5 rounded ${issue.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                          {issue.status}
                        </span>
                        {issue.comments_count > 0 && <span>{issue.comments_count} comments</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
