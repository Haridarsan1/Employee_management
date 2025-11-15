import { useState, useEffect } from 'react';
import { 
  DollarSign, Calendar, Users, FileText, CheckCircle, XCircle, Clock, 
  Download, Filter, X, Eye, Search, TrendingUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ExpenseClaim {
  id: string;
  claim_number: string;
  title: string;
  total_amount: number;
  currency: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  approver_remarks: string | null;
  payment_date: string | null;
  created_at: string;
  attachments: any[];
  employee_id: string;
  employees: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
    departments: { name: string } | null;
  };
  expense_items: ExpenseItem[];
  approved_by_employee?: {
    first_name: string;
    last_name: string;
  };
}

interface ExpenseItem {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  merchant_name: string | null;
  notes: string | null;
  receipt_url: string | null;
  expense_categories: {
    name: string;
  };
}

interface Department {
  id: string;
  name: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

export function OwnerExpensesPage() {
  const { organization, employee } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('submitted');
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [approveRemarks, setApproveRemarks] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [filters, setFilters] = useState({
    department: '',
    category: '',
    employeeSearch: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    if (organization?.id) {
      loadClaims();
      loadDepartments();
      loadCategories();
    }
  }, [organization]);

  const loadClaims = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expense_claims')
        .select(`
          *,
          employees (
            id,
            first_name,
            last_name,
            employee_code,
            departments (name)
          ),
          expense_items (
            *,
            expense_categories (name)
          ),
          approved_by_employee:employees!approved_by (
            first_name,
            last_name
          )
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClaims(data || []);
    } catch (error) {
      console.error('Error loading claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organization.id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadCategories = async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleApproveClaim = async () => {
    if (!selectedClaim || !employee?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('approve_expense_claims', {
          p_claim_ids: [selectedClaim.id],
          p_approver_id: employee.id,
          p_remarks: approveRemarks || null
        });

      if (error) throw error;

      setShowApproveModal(false);
      setApproveRemarks('');
      setSelectedClaim(null);
      loadClaims();
    } catch (error: any) {
      console.error('Error approving claim:', error);
      alert(error.message || 'Failed to approve expense claim');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClaim = async () => {
    if (!selectedClaim || !employee?.id) return;

    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('reject_expense_claims', {
          p_claim_ids: [selectedClaim.id],
          p_approver_id: employee.id,
          p_reason: rejectReason
        });

      if (error) throw error;

      setShowRejectModal(false);
      setRejectReason('');
      setSelectedClaim(null);
      loadClaims();
    } catch (error: any) {
      console.error('Error rejecting claim:', error);
      alert(error.message || 'Failed to reject expense claim');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const csvData = filteredClaims.map(claim => ({
      'Claim Number': claim.claim_number,
      'Employee': `${claim.employees.first_name} ${claim.employees.last_name}`,
      'Employee Code': claim.employees.employee_code,
      'Department': claim.employees.departments?.name || 'N/A',
      'Title': claim.title,
      'Total Amount': claim.total_amount,
      'Status': claim.status,
      'Created': new Date(claim.created_at).toLocaleDateString(),
      'Submitted': claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString() : 'N/A',
      'Approved': claim.approved_at ? new Date(claim.approved_at).toLocaleDateString() : 'N/A'
    }));

    const headers = Object.keys(csvData[0] || {}).join(',');
    const rows = csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense_claims_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-700',
      submitted: 'bg-blue-100 text-blue-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
      paid: 'bg-green-100 text-green-700'
    };
    return colors[status] || colors.draft;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'submitted':
        return <Clock className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Apply filters
  let filteredClaims = claims;

  // Tab filter
  if (activeTab !== 'all') {
    filteredClaims = filteredClaims.filter(c => c.status === activeTab);
  }

  // Department filter
  if (filters.department) {
    filteredClaims = filteredClaims.filter(c => 
      c.employees.departments?.name === filters.department
    );
  }

  // Employee search
  if (filters.employeeSearch) {
    const search = filters.employeeSearch.toLowerCase();
    filteredClaims = filteredClaims.filter(c => 
      c.employees.first_name.toLowerCase().includes(search) ||
      c.employees.last_name.toLowerCase().includes(search) ||
      c.employees.employee_code.toLowerCase().includes(search)
    );
  }

  // Category filter
  if (filters.category) {
    filteredClaims = filteredClaims.filter(c =>
      c.expense_items.some(item => item.expense_categories.name === filters.category)
    );
  }

  // Date range filter
  if (filters.dateFrom) {
    filteredClaims = filteredClaims.filter(c => 
      new Date(c.created_at) >= new Date(filters.dateFrom)
    );
  }
  if (filters.dateTo) {
    filteredClaims = filteredClaims.filter(c => 
      new Date(c.created_at) <= new Date(filters.dateTo)
    );
  }

  // Calculate stats
  const stats = {
    totalClaims: claims.length,
    pending: claims.filter(c => c.status === 'submitted').length,
    approved: claims.filter(c => c.status === 'approved' || c.status === 'paid').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
    totalAmount: claims.filter(c => c.status === 'approved' || c.status === 'paid').reduce((sum, c) => sum + c.total_amount, 0),
    pendingAmount: claims.filter(c => c.status === 'submitted').reduce((sum, c) => sum + c.total_amount, 0)
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Expense Management</h1>
          <p className="text-slate-500 mt-1">Review and approve employee expense claims</p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={filteredClaims.length === 0}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="h-5 w-5" />
          Export CSV
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Total Claims</span>
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalClaims}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Pending</span>
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Approved</span>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Rejected</span>
            <XCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.rejected}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Pending Amount</span>
            <DollarSign className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">₹{stats.pendingAmount.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Total Approved</span>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">₹{stats.totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={filters.employeeSearch}
                onChange={(e) => setFilters({ ...filters, employeeSearch: e.target.value })}
                placeholder="Search employee..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        {(filters.department || filters.category || filters.employeeSearch || filters.dateFrom || filters.dateTo) && (
          <button
            onClick={() => setFilters({ department: '', category: '', employeeSearch: '', dateFrom: '', dateTo: '' })}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200 px-6">
          <div className="flex space-x-8">
            {[
              { id: 'submitted', label: 'Pending Approval' },
              { id: 'approved', label: 'Approved' },
              { id: 'rejected', label: 'Rejected' },
              { id: 'all', label: 'All Claims' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Claims List */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading claims...</div>
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No expense claims found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">{claim.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(claim.status)}`}>
                          {getStatusIcon(claim.status)}
                          {claim.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-slate-600 mb-2">
                        <div>
                          <span className="text-slate-400">Employee:</span> {claim.employees.first_name} {claim.employees.last_name}
                        </div>
                        <div>
                          <span className="text-slate-400">Dept:</span> {claim.employees.departments?.name || 'N/A'}
                        </div>
                        <div>
                          <span className="text-slate-400">Claim #:</span> {claim.claim_number}
                        </div>
                        <div>
                          <span className="text-slate-400">Amount:</span> ₹{claim.total_amount.toFixed(2)}
                        </div>
                        <div>
                          <span className="text-slate-400">Items:</span> {claim.expense_items.length}
                        </div>
                      </div>
                      <div className="text-sm text-slate-600">
                        <span className="text-slate-400">Submitted:</span> {claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString() : 'Not yet submitted'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedClaim(claim);
                          setShowViewModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      {claim.status === 'submitted' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedClaim(claim);
                              setShowApproveModal(true);
                            }}
                            className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedClaim(claim);
                              setShowRejectModal(true);
                            }}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View Claim Modal */}
      {showViewModal && selectedClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Claim Details</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Claim Header */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">{selectedClaim.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(selectedClaim.status)}`}>
                    {getStatusIcon(selectedClaim.status)}
                    {selectedClaim.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm bg-slate-50 p-4 rounded-lg">
                  <div>
                    <span className="text-slate-500">Claim Number:</span>
                    <p className="font-medium">{selectedClaim.claim_number}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Employee:</span>
                    <p className="font-medium">{selectedClaim.employees.first_name} {selectedClaim.employees.last_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Employee Code:</span>
                    <p className="font-medium">{selectedClaim.employees.employee_code}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Department:</span>
                    <p className="font-medium">{selectedClaim.employees.departments?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Amount:</span>
                    <p className="font-medium text-lg text-blue-600">₹{selectedClaim.total_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Created:</span>
                    <p className="font-medium">{new Date(selectedClaim.created_at).toLocaleDateString()}</p>
                  </div>
                  {selectedClaim.submitted_at && (
                    <div>
                      <span className="text-slate-500">Submitted:</span>
                      <p className="font-medium">{new Date(selectedClaim.submitted_at).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Expense Items */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Expense Items</h4>
                <div className="space-y-3">
                  {selectedClaim.expense_items.map((item, idx) => (
                    <div key={item.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-blue-600">{item.expense_categories.name}</span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">{new Date(item.expense_date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-900 font-medium mb-1">{item.description}</p>
                          {item.merchant_name && (
                            <p className="text-sm text-slate-600">Merchant: {item.merchant_name}</p>
                          )}
                        </div>
                        <span className="text-lg font-semibold text-slate-900">₹{item.amount.toFixed(2)}</span>
                      </div>
                      {item.notes && (
                        <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-semibold text-slate-900">Total Amount:</span>
                  <span className="text-2xl font-bold text-blue-600">₹{selectedClaim.total_amount.toFixed(2)}</span>
                </div>
              </div>

              {/* Approval/Rejection Details */}
              {selectedClaim.status === 'approved' && selectedClaim.approved_by_employee && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <h4 className="font-semibold text-emerald-900 mb-2">Approval Details</h4>
                  <div className="text-sm text-emerald-800">
                    <p>Approved by: {selectedClaim.approved_by_employee.first_name} {selectedClaim.approved_by_employee.last_name}</p>
                    {selectedClaim.approved_at && (
                      <p>Date: {new Date(selectedClaim.approved_at).toLocaleDateString()}</p>
                    )}
                    {selectedClaim.approver_remarks && (
                      <p className="mt-2">Remarks: {selectedClaim.approver_remarks}</p>
                    )}
                  </div>
                </div>
              )}

              {selectedClaim.status === 'rejected' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-2">Rejection Details</h4>
                  <div className="text-sm text-red-800">
                    {selectedClaim.approved_by_employee && (
                      <p>Rejected by: {selectedClaim.approved_by_employee.first_name} {selectedClaim.approved_by_employee.last_name}</p>
                    )}
                    {selectedClaim.approved_at && (
                      <p>Date: {new Date(selectedClaim.approved_at).toLocaleDateString()}</p>
                    )}
                    {selectedClaim.rejection_reason && (
                      <p className="mt-2">Reason: {selectedClaim.rejection_reason}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedClaim.status === 'submitted' && (
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      setShowApproveModal(true);
                    }}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Approve Claim
                  </button>
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      setShowRejectModal(true);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Reject Claim
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Approve Expense Claim</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-800">
                  <strong>Claim:</strong> {selectedClaim.claim_number}<br />
                  <strong>Employee:</strong> {selectedClaim.employees.first_name} {selectedClaim.employees.last_name}<br />
                  <strong>Amount:</strong> ₹{selectedClaim.total_amount.toFixed(2)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Remarks (Optional)
                </label>
                <textarea
                  value={approveRemarks}
                  onChange={(e) => setApproveRemarks(e.target.value)}
                  placeholder="Add any comments or notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowApproveModal(false);
                    setApproveRemarks('');
                  }}
                  className="flex-1 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveClaim}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Reject Expense Claim</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>Claim:</strong> {selectedClaim.claim_number}<br />
                  <strong>Employee:</strong> {selectedClaim.employees.first_name} {selectedClaim.employees.last_name}<br />
                  <strong>Amount:</strong> ₹{selectedClaim.total_amount.toFixed(2)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a clear reason for rejection..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                  }}
                  className="flex-1 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectClaim}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
