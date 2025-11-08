import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type DataType = 'departments' | 'designations' | 'branches';

interface MasterDataManagerProps {
  type: DataType;
  title: string;
}

export function MasterDataManager({ type, title }: MasterDataManagerProps) {
  const { organization } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization, type]);

  const loadData = async () => {
    if (!organization?.id) return;

    try {
      const { data, error } = await supabase
        .from(type)
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organization?.id) return;

    try {
      const dataToSave = {
        ...formData,
        organization_id: organization.id,
        is_active: true
      };

      if (editingId) {
        const { error } = await supabase
          .from(type)
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(type)
          .insert(dataToSave);

        if (error) throw error;
      }

      loadData();
      setShowForm(false);
      setEditingId(null);
      setFormData({});
    } catch (error: any) {
      console.error(`Error saving ${type}:`, error);
      alert('Error: ' + error.message);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData(item);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .from(type)
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const getFormFields = () => {
    switch (type) {
      case 'departments':
        return (
          <>
            <input
              type="text"
              placeholder="Department Name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Code (e.g., IT, HR)"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </>
        );
      case 'designations':
        return (
          <>
            <input
              type="text"
              placeholder="Designation Title"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Code (e.g., MGR, DEV)"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              placeholder="Level"
              value={formData.level || ''}
              onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </>
        );
      case 'branches':
        return (
          <>
            <input
              type="text"
              placeholder="Branch Name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Code"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="City"
              value={formData.city || ''}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="State"
              value={formData.state || ''}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </>
        );
    }
  };

  if (loading) {
    return <div className="animate-pulse h-32 bg-slate-100 rounded-lg"></div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({});
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add New'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-slate-50 rounded-lg space-y-3">
          {getFormFields()}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="h-4 w-4" />
            {editingId ? 'Update' : 'Save'}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-center text-slate-500 py-8">No items yet. Click "Add New" to create one.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {item.name || item.title}
                </p>
                <p className="text-sm text-slate-500">
                  Code: {item.code}
                  {item.city && ` • ${item.city}`}
                  {item.level && ` • Level ${item.level}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(item)}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
