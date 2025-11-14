import { useState, useEffect } from 'react';
import {
  BookOpen, Search, Plus, Edit2, Trash2, Eye, Calendar,
  Filter, X, Save, TrendingUp, FileText,
  Tag, CheckCircle, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface KBArticle {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  views: number;
  organization_id: string;
  author?: {
    first_name: string;
    last_name: string;
  };
}

const CATEGORIES = [
  { value: 'technical', label: 'Technical', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'hr', label: 'HR', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'payroll', label: 'Payroll', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'leave', label: 'Leave', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'attendance', label: 'Attendance', color: 'bg-pink-100 text-pink-700 border-pink-300' },
  { value: 'access', label: 'Access', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'general', label: 'General', color: 'bg-slate-100 text-slate-700 border-slate-300' }
];

export function KnowledgeBasePage() {
  const { membership, organization } = useAuth();
  const isAdmin = membership?.role && ['owner', 'admin', 'hr'].includes(membership.role);

  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<KBArticle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null);
  const [mostViewed, setMostViewed] = useState<KBArticle[]>([]);

  // Editor form state
  const [formData, setFormData] = useState({
    title: '',
    category: 'general',
    description: '',
    content: ''
  });

  const [alertModal, setAlertModal] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (organization?.id) {
      loadArticles();
    }
  }, [organization]);

  useEffect(() => {
    filterArticles();
  }, [articles, searchTerm, categoryFilter]);

  const loadArticles = async () => {
    if (!organization?.id) return;

    try {
      const { data, error } = await supabase
        .from('kb_articles')
        .select(`
          *,
          author:created_by (
            first_name,
            last_name
          )
        `)
        .eq('organization_id', organization.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);

      // Load most viewed
      const mostViewedData = [...(data || [])].sort((a, b) => b.views - a.views).slice(0, 5);
      setMostViewed(mostViewedData);
    } catch (error) {
      console.error('Error loading articles:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to load knowledge base articles.'
      });
    }
  };

  const filterArticles = () => {
    let filtered = [...articles];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(search) ||
        article.description.toLowerCase().includes(search) ||
        article.content.toLowerCase().includes(search)
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(article => article.category === categoryFilter);
    }

    setFilteredArticles(filtered);
  };

  const openArticle = async (article: KBArticle) => {
    setSelectedArticle(article);
    setShowDetailModal(true);

    // Increment view count
    try {
      await supabase
        .from('kb_articles')
        .update({ views: article.views + 1 })
        .eq('id', article.id);

      // Update local state
      setArticles(prev => prev.map(a => 
        a.id === article.id ? { ...a, views: a.views + 1 } : a
      ));
    } catch (error) {
      console.error('Error updating views:', error);
    }
  };

  const openEditor = (article?: KBArticle) => {
    if (article) {
      setEditingArticle(article);
      setFormData({
        title: article.title,
        category: article.category,
        description: article.description,
        content: article.content
      });
    } else {
      setEditingArticle(null);
      setFormData({
        title: '',
        category: 'general',
        description: '',
        content: ''
      });
    }
    setShowEditorModal(true);
  };

  const handleSaveArticle = async () => {
    if (!organization?.id || !membership?.employee_id) return;

    if (!formData.title.trim() || !formData.description.trim() || !formData.content.trim()) {
      setAlertModal({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please fill in all required fields.'
      });
      return;
    }

    try {
      if (editingArticle) {
        // Update existing article
        const { error } = await supabase
          .from('kb_articles')
          .update({
            title: formData.title,
            category: formData.category,
            description: formData.description,
            content: formData.content,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingArticle.id);

        if (error) throw error;

        setAlertModal({
          type: 'success',
          title: 'Article Updated',
          message: 'Knowledge base article has been updated successfully.'
        });
      } else {
        // Create new article
        const { error } = await supabase
          .from('kb_articles')
          .insert({
            title: formData.title,
            category: formData.category,
            description: formData.description,
            content: formData.content,
            organization_id: organization.id,
            created_by: membership.employee_id,
            views: 0
          });

        if (error) throw error;

        setAlertModal({
          type: 'success',
          title: 'Article Created',
          message: 'New knowledge base article has been created successfully.'
        });
      }

      setShowEditorModal(false);
      loadArticles();
    } catch (error) {
      console.error('Error saving article:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to save article. Please try again.'
      });
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('kb_articles')
        .delete()
        .eq('id', articleId);

      if (error) throw error;

      setAlertModal({
        type: 'success',
        title: 'Article Deleted',
        message: 'Knowledge base article has been deleted successfully.'
      });

      setShowDetailModal(false);
      loadArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete article. Please try again.'
      });
    }
  };

  const getCategoryConfig = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-pink-700 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <BookOpen className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Knowledge Base</h1>
              <p className="text-pink-100 mt-1">Find answers and helpful resources</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => openEditor()}
              className="flex items-center gap-2 px-6 py-3 bg-white text-pink-600 rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              <Plus className="h-5 w-5" />
              New Article
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search articles by title, description, or content..."
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-pink-500 transition-colors bg-white"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Most Viewed Articles Widget */}
      {mostViewed.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-md border-2 border-blue-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Most Viewed Articles</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {mostViewed.map(article => {
              const categoryConfig = getCategoryConfig(article.category);
              return (
                <button
                  key={article.id}
                  onClick={() => openArticle(article)}
                  className="text-left bg-white rounded-lg p-4 hover:shadow-md transition-all border-2 border-transparent hover:border-blue-300"
                >
                  <p className="font-semibold text-slate-900 text-sm line-clamp-2 mb-2">
                    {article.title}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${categoryConfig.color}`}>
                      {categoryConfig.label}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <Eye className="h-3 w-3" />
                      {article.views}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArticles.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 text-lg">
              {searchTerm || categoryFilter !== 'all' 
                ? 'No articles found matching your search.'
                : 'No articles available yet.'}
            </p>
          </div>
        ) : (
          filteredArticles.map(article => {
            const categoryConfig = getCategoryConfig(article.category);
            return (
              <div
                key={article.id}
                className="bg-white rounded-xl shadow-md border-2 border-slate-200 hover:border-pink-300 hover:shadow-xl transition-all overflow-hidden"
              >
                <div className="p-6">
                  {/* Category Badge */}
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${categoryConfig.color}`}>
                    <Tag className="h-3 w-3" />
                    {categoryConfig.label}
                  </span>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">
                    {article.title}
                  </h3>

                  {/* Description */}
                  <p className="text-slate-600 text-sm line-clamp-3 mb-4">
                    {article.description}
                  </p>

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(article.updated_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {article.views} views
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openArticle(article)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                    >
                      Read Article
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => openEditor(article)}
                        className="px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Article Detail Modal */}
      {showDetailModal && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-pink-600 to-pink-700 text-white p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border mb-2 ${getCategoryConfig(selectedArticle.category).color.replace('text-', 'text-white bg-white/20 border-white/30')}`}>
                    <Tag className="h-3 w-3" />
                    {getCategoryConfig(selectedArticle.category).label}
                  </span>
                  <h2 className="text-2xl font-bold">{selectedArticle.title}</h2>
                  <p className="text-pink-100 mt-2">{selectedArticle.description}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex items-center gap-6 text-sm text-pink-100">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Updated {formatDate(selectedArticle.updated_at)}
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {selectedArticle.views} views
                </div>
                {selectedArticle.author && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    By {selectedArticle.author.first_name} {selectedArticle.author.last_name}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-slate max-w-none">
                <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {selectedArticle.content}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 p-6 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
                >
                  Close
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        openEditor(selectedArticle);
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      <Edit2 className="h-5 w-5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteArticle(selectedArticle.id)}
                      className="px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      <Trash2 className="h-5 w-5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Article Editor Modal */}
      {showEditorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-pink-600 to-pink-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8" />
                  <div>
                    <h2 className="text-2xl font-bold">
                      {editingArticle ? 'Edit Article' : 'Create New Article'}
                    </h2>
                    <p className="text-pink-100 mt-1">
                      {editingArticle ? 'Update article information' : 'Add a new knowledge base article'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditorModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Article Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter article title..."
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-pink-500 transition-colors bg-white"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Short Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description shown in article preview..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-pink-500 transition-colors resize-none"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Article Content *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Full article content..."
                  rows={12}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-pink-500 transition-colors resize-none font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Tip: Use clear formatting with line breaks for better readability
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 p-6 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditorModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveArticle}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Save className="h-5 w-5" />
                  {editingArticle ? 'Update Article' : 'Create Article'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              {alertModal.type === 'success' && <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />}
              {alertModal.type === 'error' && <X className="h-16 w-16 text-red-500 mx-auto mb-4" />}
              {alertModal.type === 'warning' && <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />}
              {alertModal.type === 'info' && <AlertCircle className="h-16 w-16 text-blue-500 mx-auto mb-4" />}
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">{alertModal.title}</h3>
              <p className="text-slate-600 mb-6">{alertModal.message}</p>
              
              <button
                onClick={() => setAlertModal(null)}
                className="w-full px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
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
