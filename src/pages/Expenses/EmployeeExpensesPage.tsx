import { useState, useEffect } from 'react';
import { 
  Plus, Calendar, DollarSign, FileText, Upload, X, CheckCircle, 
  Clock, XCircle, Download, Filter, Eye, Trash2 
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

interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  requires_receipt: boolean;
  max_amount: number | null;
}

export function EmployeeExpensesPage() {
  const { employee, organization } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'draft' | 'submitted' | 'approved' | 'rejected'>('all');
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    items: [{
      category_id: '',
      expense_date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      merchant_name: '',
      notes: ''
    }]
  });

  useEffect(() => {
    if (employee?.id && organization?.id) {
      loadClaims();
      loadCategories();
    }
  }, [employee, organization]);

  const loadClaims = async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expense_claims')
        .select(`
          *,
          expense_items (
            *,
            expense_categories (name)
          ),
          approved_by_employee:employees!approved_by (
            first_name,
            last_name
          )
        `)
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClaims(data || []);
    } catch (error) {
      console.error('Error loading claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleCreateClaim = async () => {
    if (!employee?.id || !organization?.id) return;
    
    // Validation
    if (!createForm.title.trim()) {
      alert('Please enter a claim title');
      return;
    }

    const validItems = createForm.items.filter(item => 
      item.category_id && item.description.trim() && parseFloat(item.amount) > 0
    );

    if (validItems.length === 0) {
      alert('Please add at least one valid expense item');
      return;
    }

    setLoading(true);
    try {
      // Generate claim number
      const { data: claimNumber, error: claimNumberError } = await supabase
        .rpc('generate_expense_claim_number', { p_organization_id: organization.id });

      if (claimNumberError) throw claimNumberError;

      // Calculate total amount
      const totalAmount = validItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);

      // Create claim
      const { data: claim, error: claimError } = await supabase
        .from('expense_claims')
        .insert({
          employee_id: employee.id,
          organization_id: organization.id,
          claim_number: claimNumber,
          title: createForm.title,
          total_amount: totalAmount,
          status: 'draft'
        })
        .select()
        .single();

      if (claimError) throw claimError;

      // Create expense items
      const items = validItems.map(item => ({
        claim_id: claim.id,
        category_id: item.category_id,
        expense_date: item.expense_date,
        description: item.description,
        amount: parseFloat(item.amount),
        merchant_name: item.merchant_name || null,
        notes: item.notes || null
      }));

      const { error: itemsError } = await supabase
        .from('expense_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Reset form and reload
      setCreateForm({
        title: '',
        items: [{
          category_id: '',
          expense_date: new Date().toISOString().split('T')[0],
          description: '',
          amount: '',
          merchant_name: '',
          notes: ''
        }]
      });
      setShowCreateModal(false);
      loadClaims();
    } catch (error: any) {
      console.error('Error creating claim:', error);
      alert(error.message || 'Failed to create expense claim');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async (claimId: string) => {
    if (!confirm('Submit this expense claim for approval? You won\'t be able to edit it after submission.')) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('submit_expense_claim', { p_claim_id: claimId });

      if (error) throw error;
      loadClaims();
    } catch (error: any) {
      console.error('Error submitting claim:', error);
      alert(error.message || 'Failed to submit expense claim');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClaim = async (claimId: string) => {
    if (!confirm('Delete this expense claim? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('expense_claims')
        .delete()
        .eq('id', claimId);

      if (error) throw error;
      loadClaims();
    } catch (error: any) {
      console.error('Error deleting claim:', error);
      alert(error.message || 'Failed to delete expense claim');
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = (claim: ExpenseClaim) => {
    const text = `
===============================================
EXPENSE CLAIM RECEIPT
===============================================

Claim Number: ${claim.claim_number}
Title: ${claim.title}
Status: ${claim.status.toUpperCase()}
Date: ${new Date(claim.created_at).toLocaleDateString()}
${claim.submitted_at ? `Submitted: ${new Date(claim.submitted_at).toLocaleDateString()}` : ''}
${claim.approved_at ? `Approved: ${new Date(claim.approved_at).toLocaleDateString()}` : ''}

EXPENSE ITEMS:
-----------------------------------------------
${claim.expense_items.map((item, idx) => `
${idx + 1}. ${item.expense_categories.name}
   Date: ${new Date(item.expense_date).toLocaleDateString()}
   Description: ${item.description}
   ${item.merchant_name ? `Merchant: ${item.merchant_name}` : ''}
   Amount: ₹${item.amount.toFixed(2)}
`).join('\n')}

-----------------------------------------------
TOTAL AMOUNT: ₹${claim.total_amount.toFixed(2)}
===============================================

${claim.status === 'approved' ? `
Approved By: ${claim.approved_by_employee?.first_name} ${claim.approved_by_employee?.last_name}
${claim.approver_remarks ? `Remarks: ${claim.approver_remarks}` : ''}
` : ''}

${claim.status === 'rejected' ? `
Rejection Reason: ${claim.rejection_reason}
` : ''}

Generated on: ${new Date().toLocaleString()}
===============================================
    `.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense_claim_${claim.claim_number}.txt`;
    a.click();
  };

  const addExpenseItem = () => {
    setCreateForm({
      ...createForm,
      items: [
        ...createForm.items,
        {
          category_id: '',
          expense_date: new Date().toISOString().split('T')[0],
          description: '',
          amount: '',
          merchant_name: '',
          notes: ''
        }
      ]
    });
  };

  const removeExpenseItem = (index: number) => {
    setCreateForm({
      ...createForm,
      items: createForm.items.filter((_, i) => i !== index)
    });
  };

  const updateExpenseItem = (index: number, field: string, value: string) => {
    const newItems = [...createForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCreateForm({ ...createForm, items: newItems });
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

  const filteredClaims = activeTab === 'all' 
    ? claims 
    : claims.filter(c => c.status === activeTab);

  const stats = {
    total: claims.length,
    draft: claims.filter(c => c.status === 'draft').length,
    submitted: claims.filter(c => c.status === 'submitted').length,
    approved: claims.filter(c => c.status === 'approved' || c.status === 'paid').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
    totalAmount: claims.filter(c => c.status === 'approved' || c.status === 'paid').reduce((sum, c) => sum + c.total_amount, 0)
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Expenses</h1>
          <p className="text-slate-500 mt-1">Submit and track your expense claims</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          New Claim
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Total Claims</span>
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Pending</span>
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.submitted}</p>
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
            <span className="text-sm text-slate-500">Total Approved</span>
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">₹{stats.totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200 px-6">
          <div className="flex space-x-8">
            {[
              { id: 'all', label: 'All Claims' },
              { id: 'draft', label: 'Draft' },
              { id: 'submitted', label: 'Pending' },
              { id: 'approved', label: 'Approved' },
              { id: 'rejected', label: 'Rejected' }
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
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-700"
              >
                Create your first claim
              </button>
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600">
                        <div>
                          <span className="text-slate-400">Claim #:</span> {claim.claim_number}
                        </div>
                        <div>
                          <span className="text-slate-400">Amount:</span> ₹{claim.total_amount.toFixed(2)}
                        </div>
                        <div>
                          <span className="text-slate-400">Items:</span> {claim.expense_items.length}
                        </div>
                        <div>
                          <span className="text-slate-400">Created:</span> {new Date(claim.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {claim.submitted_at && (
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="text-slate-400">Submitted:</span> {new Date(claim.submitted_at).toLocaleDateString()}
                        </div>
                      )}
                      {claim.status === 'rejected' && claim.rejection_reason && (
                        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                          <strong>Rejection Reason:</strong> {claim.rejection_reason}
                        </div>
                      )}
                      {claim.status === 'approved' && claim.approver_remarks && (
                        <div className="mt-2 text-sm text-emerald-600 bg-emerald-50 p-2 rounded">
                          <strong>Approver Remarks:</strong> {claim.approver_remarks}
                        </div>
                      )}
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
                      {(claim.status === 'approved' || claim.status === 'paid') && (
                        <button
                          onClick={() => downloadReceipt(claim)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Download Receipt"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                      )}
                      {claim.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleSubmitClaim(claim.id)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Submit
                          </button>
                          <button
                            onClick={() => handleDeleteClaim(claim.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-5 w-5" />
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

      {/* Create Claim Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Create Expense Claim</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Claim Title *
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g., Business Trip to Mumbai - Jan 2024"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Expense Items</h3>
                  <button
                    onClick={addExpenseItem}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-4">
                  {createForm.items.map((item, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-medium text-slate-700">Item {index + 1}</h4>
                        {createForm.items.length > 1 && (
                          <button
                            onClick={() => removeExpenseItem(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Category *
                          </label>
                          <select
                            value={item.category_id}
                            onChange={(e) => updateExpenseItem(index, 'category_id', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select category</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Date *
                          </label>
                          <input
                            type="date"
                            value={item.expense_date}
                            onChange={(e) => updateExpenseItem(index, 'expense_date', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Amount (₹) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={(e) => updateExpenseItem(index, 'amount', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Merchant Name
                          </label>
                          <input
                            type="text"
                            value={item.merchant_name}
                            onChange={(e) => updateExpenseItem(index, 'merchant_name', e.target.value)}
                            placeholder="e.g., Uber, Hotel Taj"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Description *
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateExpenseItem(index, 'description', e.target.value)}
                            placeholder="Brief description of the expense"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Notes
                          </label>
                          <textarea
                            value={item.notes}
                            onChange={(e) => updateExpenseItem(index, 'notes', e.target.value)}
                            placeholder="Additional notes or comments"
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <div className="text-lg font-semibold text-slate-900">
                  Total: ₹
                  {createForm.items
                    .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
                    .toFixed(2)}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateClaim}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Claim'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Claim Modal */}
      {showViewModal && selectedClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
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
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">{selectedClaim.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(selectedClaim.status)}`}>
                    {getStatusIcon(selectedClaim.status)}
                    {selectedClaim.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Claim Number:</span>
                    <p className="font-medium">{selectedClaim.claim_number}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Amount:</span>
                    <p className="font-medium text-lg">₹{selectedClaim.total_amount.toFixed(2)}</p>
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

              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Expense Items</h4>
                <div className="space-y-3">
                  {selectedClaim.expense_items.map((item, idx) => (
                    <div key={item.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-sm font-medium text-blue-600">{item.expense_categories.name}</span>
                          <p className="text-slate-900 font-medium">{item.description}</p>
                        </div>
                        <span className="text-lg font-semibold text-slate-900">₹{item.amount.toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mt-2">
                        <div>
                          <span className="text-slate-400">Date:</span> {new Date(item.expense_date).toLocaleDateString()}
                        </div>
                        {item.merchant_name && (
                          <div>
                            <span className="text-slate-400">Merchant:</span> {item.merchant_name}
                          </div>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

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
                  <h4 className="font-semibold text-red-900 mb-2">Rejection Reason</h4>
                  <p className="text-sm text-red-800">{selectedClaim.rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
