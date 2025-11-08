import { useState, useEffect } from 'react';
import { Github, Plus, Search, Star, GitFork, Eye, Code, Calendar, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  created_at: string;
  updated_at: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubStats {
  totalRepos: number;
  totalStars: number;
  totalForks: number;
  totalWatchers: number;
  languages: { [key: string]: number };
  recentActivity: any[];
}

export function GitHubPage() {
  const { organization } = useAuth();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [stats, setStats] = useState<GitHubStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'stars' | 'updated'>('updated');

  useEffect(() => {
    fetchGitHubData();
  }, [organization]);

  const fetchGitHubData = async () => {
    if (!organization) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch GitHub integration settings from organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', organization.id)
        .single();

      if (orgError) {
        setError('Failed to fetch organization settings. Please try again.');
        setLoading(false);
        return;
      }

      const githubSettings = (orgData as any)?.settings;
      if (!githubSettings?.github_token) {
        setError('GitHub integration not configured. Please configure GitHub token in Settings.');
        setLoading(false);
        return;
      }

      // In a real implementation, you would make API calls to GitHub
      // For now, we'll simulate the data structure
      const mockRepos: GitHubRepo[] = [
        {
          id: 1,
          name: 'ems-frontend',
          full_name: 'company/ems-frontend',
          description: 'Employee Management System Frontend',
          html_url: 'https://github.com/company/ems-frontend',
          language: 'TypeScript',
          stargazers_count: 45,
          forks_count: 12,
          watchers_count: 8,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-12-15T14:30:00Z',
          private: false,
          owner: {
            login: 'company',
            avatar_url: 'https://github.com/images/error/company_happy.gif'
          }
        },
        {
          id: 2,
          name: 'ems-backend',
          full_name: 'company/ems-backend',
          description: 'Employee Management System Backend API',
          html_url: 'https://github.com/company/ems-backend',
          language: 'Python',
          stargazers_count: 32,
          forks_count: 8,
          watchers_count: 5,
          created_at: '2024-01-10T09:00:00Z',
          updated_at: '2024-12-14T16:45:00Z',
          private: false,
          owner: {
            login: 'company',
            avatar_url: 'https://github.com/images/error/company_happy.gif'
          }
        },
        {
          id: 3,
          name: 'hr-analytics',
          full_name: 'company/hr-analytics',
          description: 'HR Analytics and Reporting Dashboard',
          html_url: 'https://github.com/company/hr-analytics',
          language: 'JavaScript',
          stargazers_count: 28,
          forks_count: 15,
          watchers_count: 6,
          created_at: '2024-02-01T11:00:00Z',
          updated_at: '2024-12-13T12:20:00Z',
          private: false,
          owner: {
            login: 'company',
            avatar_url: 'https://github.com/images/error/company_happy.gif'
          }
        }
      ];

      const mockStats: GitHubStats = {
        totalRepos: mockRepos.length,
        totalStars: mockRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
        totalForks: mockRepos.reduce((sum, repo) => sum + repo.forks_count, 0),
        totalWatchers: mockRepos.reduce((sum, repo) => sum + repo.watchers_count, 0),
        languages: mockRepos.reduce((acc, repo) => {
          if (repo.language) {
            acc[repo.language] = (acc[repo.language] || 0) + 1;
          }
          return acc;
        }, {} as { [key: string]: number }),
        recentActivity: []
      };

      setRepos(mockRepos);
      setStats(mockStats);
    } catch (err) {
      console.error('Error fetching GitHub data:', err);
      setError('Failed to fetch GitHub data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRepos = repos
    .filter(repo =>
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .filter(repo => !filterLanguage || repo.language === filterLanguage)
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'stars':
          return b.stargazers_count - a.stargazers_count;
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default:
          return 0;
      }
    });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="text-lg font-semibold text-red-900">GitHub Integration Error</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchGitHubData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center shadow-lg">
            <Github className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">GitHub Integration</h1>
            <p className="text-slate-600">Repository management and developer analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchGitHubData}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Repository
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Code className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Repositories</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalRepos}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Stars</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalStars}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                <GitFork className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Forks</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalForks}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Eye className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Watchers</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalWatchers}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search repositories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Languages</option>
            {stats && Object.keys(stats.languages).map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'stars' | 'updated')}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="updated">Sort by Updated</option>
            <option value="name">Sort by Name</option>
            <option value="stars">Sort by Stars</option>
          </select>
        </div>
      </div>

      {/* Repositories List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Repositories</h2>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredRepos.map((repo) => (
            <div key={repo.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{repo.name}</h3>
                    {repo.private && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Private</span>
                    )}
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  {repo.description && (
                    <p className="text-slate-600 mb-3">{repo.description}</p>
                  )}

                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    {repo.language && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span>{repo.language}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      <span>{repo.stargazers_count}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <GitFork className="h-4 w-4" />
                      <span>{repo.forks_count}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{repo.watchers_count}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Updated {formatDate(repo.updated_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <img
                    src={repo.owner.avatar_url}
                    alt={repo.owner.login}
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-sm text-slate-600">{repo.owner.login}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredRepos.length === 0 && (
          <div className="p-12 text-center">
            <Github className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No repositories found</h3>
            <p className="text-slate-600">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}