import { useEffect, useState } from 'react';
import { DollarSign, Plus, X, Send, Clock, Check, XCircle, Receipt, IndianRupee, Filter, Search, Sparkles, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ExpenseClaim {
  id: string;
  claim_number: string;
  title: string;
  total_amount: number;
  status: string;
  submitted_at: string;
  created_at: string;
  employee: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  expense_items: ExpenseItem[];
}

interface ExpenseItem {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  merchant_name: string;
  category: {
    name: string;
  };
}

interface ExpenseCategory {
  id: string;
  name: string;
  max_amount: number;
}

export function ExpensesPage() {
  const { membership, organization } = useAuth();
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    items: [{ expense_date: '', category_id: '', description: '', amount: 0, merchant_name: '' }]
  });

  const isAdmin = membership?.role && ['admin', 'hr', 'finance'].includes(membership.role);

  useEffect(() => {
    loadData();
  }, [membership, organization]);

  const loadData = async () => {
    try {
      await Promise.all([loadClaims(), loadCategories()]);
    } finally {
      setLoading(false);
    }
  };

  const loadClaims = async () => {
    let query = supabase
      .from('expense_claims')
      .select(`
        *,
        employee:employees!employee_id(first_name, last_name, employee_code),
        expense_items(*, category:expense_categories(name))
      `)
      .order('created_at', { ascending: false });

    if (!isAdmin && membership?.employee_id) {
      query = query.eq('employee_id', membership.employee_id);
    }

    const { data } = await query;
    setClaims(data || []);
  };

  const loadCategories = async () => {
    if (!organization?.id) return;
    const { data } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('is_active', true);
    setCategories(data || []);
  };

  const handleCreateClaim = async () => {
    if (!formData.title) return;

    const totalAmount = formData.items.reduce((sum, item) => sum + item.amount, 0);
    const claimNumber = `EXP-${Date.now()}`;

    const { data: claim, error: claimError } = await supabase
      .from('expense_claims')
      .insert({
        employee_id: membership?.employee_id,
        claim_number: claimNumber,
        title: formData.title,
        total_amount: totalAmount,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (claimError) throw claimError;

    const items = formData.items.map(item => ({
      claim_id: claim.id,
      category_id: item.category_id,
      expense_date: item.expense_date,
      description: item.description,
      amount: item.amount,
      merchant_name: item.merchant_name
    }));

    await supabase.from('expense_items').insert(items);

    setShowCreateModal(false);
    setFormData({ title: '', items: [{ expense_date: '', category_id: '', description: '', amount: 0, merchant_name: '' }] });
    await loadClaims();
  };

  const handleApprove = async (claimId: string) => {
    await supabase
      .from('expense_claims')
      .update({ status: 'approved', approved_by: membership?.employee_id, approved_at: new Date().toISOString() })
      .eq('id', claimId);
    await loadClaims();
  };

  const handleReject = async (claimId: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    await supabase
      .from('expense_claims')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', claimId);
    await loadClaims();
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { expense_date: '', category_id: '', description: '', amount: 0, merchant_name: '' }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const filteredClaims = claims.filter(claim => {
    if (filterStatus !== 'all' && claim.status !== filterStatus) return false;
    if (searchQuery && !claim.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: claims.length,
    submitted: claims.filter(c => c.status === 'submitted').length,
    approved: claims.filter(c => c.status === 'approved').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
    totalAmount: claims.reduce((sum, c) => sum + c.total_amount, 0)
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-rose-600"></div>
    </div>;
  }

  return (
    <>
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8">
            <div className="p-6 bg-gradient-to-r from-rose-500 to-rose-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <IndianRupee className="h-6 w-6" />
                  New Expense Claim
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-white/20 rounded-lg">
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Claim Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Client Meeting Expenses"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="border-t-2 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-900">Expense Items</h4>
                  <button onClick={addItem} className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </button>
                </div>

                {formData.items.map((item, index) => (
                  <div key={index} className="p-4 border-2 border-slate-200 rounded-xl mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-700">Item {index + 1}</span>
                      {formData.items.length > 1 && (
                        <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                        <input
                          type="date"
                          value={item.expense_date}
                          onChange={(e) => updateItem(index, 'expense_date', e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                        <select
                          value={item.category_id}
                          onChange={(e) => updateItem(index, 'category_id', e.target.value)}
                          className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg"
                        >
                          <option value="">Select</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Amount (₹)</label>
                        <input
                          type="number"
                          value={item.amount || ''}
                          onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Merchant</label>
                        <input
                          type="text"
                          value={item.merchant_name}
                          onChange={(e) => updateItem(index, 'merchant_name', e.target.value)}
                          className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateClaim}
                  className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-xl font-semibold"
                >
                  Submit Claim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <IndianRupee className="h-8 w-8 text-rose-600" />
              Expense Management
            </h1>
            <p className="text-slate-600 mt-2">Track and manage expense claims</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-xl hover:from-rose-700 hover:to-rose-800 shadow-lg"
          >
            <Plus className="h-5 w-5" />
            New Claim
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
            <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-slate-600">Total Claims</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
            <div className="h-12 w-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center mb-3">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <p className="text-2xl font-bold">{stats.submitted}</p>
            <p className="text-sm text-slate-600">Pending</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
            <div className="h-12 w-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mb-3">
              <Check className="h-6 w-6 text-white" />
            </div>
            <p className="text-2xl font-bold">{stats.approved}</p>
            <p className="text-sm text-slate-600">Approved</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
            <div className="h-12 w-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mb-3">
              <XCircle className="h-6 w-6 text-white" />
            </div>
            <p className="text-2xl font-bold">{stats.rejected}</p>
            <p className="text-sm text-slate-600">Rejected</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
            <div className="h-12 w-12 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center mb-3">
              <IndianRupee className="h-6 w-6 text-white" />
            </div>
            <p className="text-2xl font-bold">₹{stats.totalAmount.toLocaleString('en-IN')}</p>
            <p className="text-sm text-slate-600">Total Amount</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search claims..."
                className="w-full pl-10 pr-4 py-2 border-2 border-slate-200 rounded-xl"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border-2 border-slate-200 rounded-xl"
            >
              <option value="all">All Status</option>
              <option value="submitted">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <div className="space-y-3">
            {filteredClaims.map(claim => (
              <div key={claim.id} className="p-5 border-2 border-slate-200 rounded-xl hover:border-rose-300 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-slate-900 text-lg">{claim.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        claim.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        claim.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        claim.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {claim.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{claim.employee?.first_name} {claim.employee?.last_name} ({claim.employee?.employee_code})</p>
                    <p className="text-sm text-slate-500">{claim.claim_number} • {new Date(claim.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-rose-600">₹{claim.total_amount.toLocaleString('en-IN')}</p>
                    <p className="text-sm text-slate-500">{claim.expense_items?.length || 0} items</p>
                  </div>
                </div>

                {claim.expense_items && claim.expense_items.length > 0 && (
                  <div className="border-t-2 border-slate-100 pt-3 mt-3">
                    <div className="space-y-2">
                      {claim.expense_items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <div className="flex-1">
                            <span className="font-semibold text-slate-700">{item.description}</span>
                            <span className="text-slate-500 ml-2">• {item.category?.name}</span>
                            {item.merchant_name && <span className="text-slate-400 ml-2">• {item.merchant_name}</span>}
                          </div>
                          <span className="font-bold text-slate-900">₹{item.amount.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isAdmin && claim.status === 'submitted' && (
                  <div className="flex gap-2 pt-3 border-t-2 border-slate-100 mt-3">
                    <button
                      onClick={() => handleApprove(claim.id)}
                      className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(claim.id)}
                      className="flex-1 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
