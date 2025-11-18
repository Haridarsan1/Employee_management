import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Filter, Loader2, Megaphone, Pencil, Plus, Search, Trash2, UploadCloud, X } from 'lucide-react';

type Category = 'general' | 'holiday' | 'event' | 'hr_update' | 'alert';
type Priority = 'low' | 'normal' | 'high';
type Status = 'draft' | 'published';

interface Announcement {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  category: Category;
  priority: Priority;
  status: Status;
  published_at: string | null;
  banner_image_url: string | null;
  attachments: Array<{ name: string; url: string; size?: number; type?: string }>; 
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Filters {
  search: string;
  category: 'all' | Category;
  priority: 'all' | Priority;
  status: 'all' | Status;
  from: string | null; // yyyy-mm-dd
  to: string | null;   // yyyy-mm-dd
}

export function OwnerAnnouncementsPage() {
  const { organization, membership } = useAuth();
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success'|'error'|'info'; title: string; message: string }|null>(null);

  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: 'all',
    priority: 'all',
    status: 'all',
    from: null,
    to: null,
  });

  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'general' as Category,
    priority: 'normal' as Priority,
    status: 'draft' as Status,
    published_at: '', // datetime-local
    banner_image_url: '' as string | null,
    attachments: [] as Array<{ name: string; url: string; size?: number; type?: string }>,
  });
  const [detail, setDetail] = useState<{ open: boolean; ann?: Announcement; createdBy?: string }>(()=>({ open:false }));

  const canManage = useMemo(() => membership?.role === 'owner', [membership?.role]);

  useEffect(() => {
    if (!organization?.id) return;
    loadAnnouncements();

    const channel = supabase
      .channel('realtime-announcements-owner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, async () => {
        await loadAnnouncements();
      })
      .subscribe();

    return () => { try { channel.unsubscribe(); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const loadAnnouncements = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('announcements')
        .select('*')
        .eq('organization_id', organization.id)
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setAnnouncements((data as any) || []);
    } catch (e: any) {
      console.error('Error loading announcements:', e);
      setAlert({ type: 'error', title: 'Load Failed', message: e.message || 'Could not load announcements' });
    } finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    let list = [...announcements];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q));
    }
    if (filters.category !== 'all') list = list.filter(a => a.category === filters.category);
    if (filters.priority !== 'all') list = list.filter(a => a.priority === filters.priority);
    if (filters.status !== 'all') list = list.filter(a => a.status === filters.status);
    if (filters.from) list = list.filter(a => (a.published_at || a.created_at) >= `${filters.from}T00:00:00`);
    if (filters.to) list = list.filter(a => (a.published_at || a.created_at) <= `${filters.to}T23:59:59`);
    return list;
  }, [announcements, filters]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', content: '', category: 'general', priority: 'normal', status: 'draft', published_at: '', banner_image_url: '', attachments: [] });
    setShowEditor(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title,
      content: a.content,
      category: a.category,
      priority: a.priority,
      status: a.status,
      published_at: a.published_at ? a.published_at.slice(0,16) : '',
      banner_image_url: a.banner_image_url || '',
      attachments: a.attachments || [],
    });
    setShowEditor(true);
  };

  const handleUpload = async (files: FileList, kind: 'banner'|'attachments') => {
    if (!organization?.id || !files || files.length === 0) return;
    setUploading(true);
    try {
      const bucket = 'announcements';
      const uploaded: Array<{ name: string; url: string; size?: number; type?: string }> = [];
      for (const file of Array.from(files)) {
        const path = `${organization.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        uploaded.push({ name: file.name, url: pub.publicUrl, size: file.size, type: file.type });
      }
      if (kind === 'banner') {
        setForm(f => ({ ...f, banner_image_url: uploaded[0]?.url || '' }));
      } else {
        setForm(f => ({ ...f, attachments: [...f.attachments, ...uploaded] }));
      }
    } catch (e: any) {
      console.error('Upload failed:', e);
      setAlert({ type: 'error', title: 'Upload Failed', message: e.message || 'Ensure storage bucket "announcements" exists and allows uploads.' });
    } finally { setUploading(false); }
  };

  const saveAnnouncement = async () => {
    if (!organization?.id || !canManage) return;
    if (!form.title.trim() || !form.content.trim()) {
      setAlert({ type: 'error', title: 'Validation', message: 'Title and content are required.' });
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        organization_id: organization.id,
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        priority: form.priority,
        status: form.status,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
        banner_image_url: form.banner_image_url || null,
        attachments: form.attachments || [],
        created_by: membership?.user_id || null,
      };

      if (editing) {
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', editing.id)
          .eq('organization_id', organization.id);
        if (error) throw error;
        setAlert({ type: 'success', title: 'Updated', message: 'Announcement updated.' });
      } else {
        const { error } = await supabase.from('announcements').insert(payload);
        if (error) throw error;
        setAlert({ type: 'success', title: 'Created', message: 'Announcement created.' });
      }
      setShowEditor(false);
      await loadAnnouncements();
    } catch (e: any) {
      console.error('Save failed:', e);
      setAlert({ type: 'error', title: 'Save Failed', message: e.message || 'Could not save announcement' });
    } finally { setLoading(false); }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!organization?.id || !canManage) return;
    if (!confirm('Delete this announcement?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id).eq('organization_id', organization.id);
      if (error) throw error;
      setAlert({ type: 'success', title: 'Deleted', message: 'Announcement deleted.' });
      await loadAnnouncements();
    } catch (e: any) {
      console.error('Delete failed:', e);
      setAlert({ type: 'error', title: 'Delete Failed', message: e.message || 'Could not delete announcement' });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-fuchsia-600" />
            Announcements (Owner)
          </h1>
          <p className="text-slate-600 mt-2">Create and manage company announcements</p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-fuchsia-700 text-white rounded-xl shadow-lg">
            <Plus className="h-5 w-5" /> New Announcement
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-50">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))} placeholder="Search title or content" className="bg-transparent outline-none w-full" />
        </div>
        <select className="px-3 py-2 rounded-xl border bg-white" value={filters.category} onChange={e=>setFilters(f=>({...f,category:e.target.value as any}))}>
          <option value="all">All Categories</option>
          <option value="general">General</option>
          <option value="holiday">Holiday</option>
          <option value="event">Event</option>
          <option value="hr_update">HR Update</option>
          <option value="alert">Alert</option>
        </select>
        <select className="px-3 py-2 rounded-xl border bg-white" value={filters.priority} onChange={e=>setFilters(f=>({...f,priority:e.target.value as any}))}>
          <option value="all">All Priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <select className="px-3 py-2 rounded-xl border bg-white" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value as any}))}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <div className="col-span-2 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input type="date" value={filters.from ?? ''} onChange={e=>setFilters(f=>({...f,from:e.target.value||null}))} className="bg-transparent outline-none w-full" />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input type="date" value={filters.to ?? ''} onChange={e=>setFilters(f=>({...f,to:e.target.value||null}))} className="bg-transparent outline-none w-full" />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
        {loading && (
          <div className="flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/> Loading...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border p-8 text-center">
            <Megaphone className="h-10 w-10 text-fuchsia-300 mx-auto mb-3" />
            <div className="font-semibold text-slate-700">No announcements</div>
            <div className="text-slate-500 text-sm">Create your first announcement to keep everyone informed.</div>
          </div>
        )}
        {filtered.map(a => (
          <div key={a.id} className="bg-white rounded-2xl border p-5 flex flex-col md:flex-row gap-4">
            {a.banner_image_url && (
              <img src={a.banner_image_url} alt="banner" className="w-full md:w-48 h-28 object-cover rounded-xl" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className={`px-2 py-0.5 rounded-full ${a.category==='alert'?'bg-red-100 text-red-700': a.category==='holiday'?'bg-emerald-100 text-emerald-700': 'bg-slate-100 text-slate-700'}`}>{a.category.replace('_',' ').toUpperCase()}</span>
                <span className={`px-2 py-0.5 rounded-full ${a.priority==='high'?'bg-red-100 text-red-700': a.priority==='low'?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>{a.priority.toUpperCase()}</span>
                <span className={`px-2 py-0.5 rounded-full ${a.status==='published'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-700'}`}>{a.status.toUpperCase()}</span>
              </div>
              <div className="text-lg font-semibold text-slate-900">{a.title}</div>
              <div className="text-slate-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: a.content }} />
              <div className="text-xs text-slate-500 mt-2">{a.published_at ? `Publishes: ${new Date(a.published_at).toLocaleString()}` : `Created: ${new Date(a.created_at).toLocaleString()}`}</div>
              {a.attachments?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {a.attachments.map(att => (
                    <a key={att.url} className="text-sm text-blue-600 underline" href={att.url} target="_blank" rel="noreferrer">{att.name}</a>
                  ))}
                </div>
              ) : null}
            </div>
            {canManage && (
              <div className="flex md:flex-col gap-2">
                <button onClick={()=>openEdit(a)} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1"><Pencil className="h-4 w-4"/>Edit</button>
                <button onClick={()=>deleteAnnouncement(a.id)} className="px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1"><Trash2 className="h-4 w-4"/>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {detail.open && detail.ann && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col mt-6 mb-6">
            <div className="p-4 border-b flex items-center justify-between flex-none">
              <div className="text-lg font-semibold">{detail.ann.title}</div>
              <button className="px-2 py-1 rounded hover:bg-slate-100" onClick={()=>setDetail({ open:false })}>Close</button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {detail.ann.banner_image_url && <img src={detail.ann.banner_image_url} alt="banner" className="w-full h-56 object-cover rounded-xl"/>}
              <div className="text-sm text-slate-500">{detail.createdBy ? `By ${detail.createdBy}` : ''} {detail.ann.published_at ? `• ${new Date(detail.ann.published_at).toLocaleString()}` : ''}</div>
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: detail.ann.content }} />
              {detail.ann.attachments?.length ? (
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-1">Attachments</div>
                  <div className="flex flex-wrap gap-2">
                    {detail.ann.attachments.map(att => (
                      <a key={att.url} className="text-sm text-blue-600 underline" href={att.url} target="_blank" rel="noreferrer">{att.name}</a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mt-6 mb-6">
            <div className="flex items-center justify-between p-4 border-b flex-none">
              <div className="font-semibold">{editing ? 'Edit Announcement' : 'New Announcement'}</div>
              <button onClick={()=>setShowEditor(false)} className="p-1 rounded hover:bg-slate-100"><X className="h-5 w-5"/></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-sm font-medium text-slate-700">Title</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="mt-1 w-full px-3 py-2 rounded-xl border bg-white" placeholder="Announcement title" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Content</label>
                <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} className="mt-1 w-full px-3 py-2 rounded-xl border bg-white h-40" placeholder="Write your announcement..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Category</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value as Category}))} className="mt-1 w-full px-3 py-2 rounded-xl border bg-white">
                    <option value="general">General</option>
                    <option value="holiday">Holiday</option>
                    <option value="event">Event</option>
                    <option value="hr_update">HR Update</option>
                    <option value="alert">Alert</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Priority</label>
                  <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value as Priority}))} className="mt-1 w-full px-3 py-2 rounded-xl border bg-white">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as Status}))} className="mt-1 w-full px-3 py-2 rounded-xl border bg-white">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Publish at (schedule)</label>
                  <input type="datetime-local" value={form.published_at} onChange={e=>setForm(f=>({...f,published_at:e.target.value}))} className="mt-1 w-full px-3 py-2 rounded-xl border bg-white" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Banner Image</label>
                  <div className="mt-1 flex items-center gap-3">
                    <input type="file" accept="image/*" onChange={e=>e.target.files && handleUpload(e.target.files,'banner')} />
                    {form.banner_image_url && <img src={form.banner_image_url} alt="banner" className="h-10 rounded"/>}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Attachments</label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="px-3 py-2 rounded-xl border bg-white cursor-pointer flex items-center gap-2"><UploadCloud className="h-4 w-4"/>Upload
                    <input type="file" multiple className="hidden" onChange={e=>e.target.files && handleUpload(e.target.files,'attachments')} />
                  </label>
                  <div className="text-sm text-slate-500">{form.attachments.length} files</div>
                </div>
                {form.attachments.length>0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.attachments.map((att,i)=>(
                      <a key={i} className="text-sm text-blue-600 underline" href={att.url} target="_blank" rel="noreferrer">{att.name}</a>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-3 flex-none bg-white">
              <button onClick={()=>setShowEditor(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700">Cancel</button>
              <button disabled={uploading||loading} onClick={saveAnnouncement} className="px-4 py-2 rounded-lg bg-fuchsia-600 text-white flex items-center gap-2 disabled:opacity-60">
                {(uploading||loading) && <Loader2 className="h-4 w-4 animate-spin"/>}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {alert && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
            <div className="font-semibold mb-2">{alert.title}</div>
            <div className="text-slate-600">{alert.message}</div>
            <div className="mt-4 text-right"><button onClick={()=>setAlert(null)} className="px-4 py-2 rounded-lg bg-fuchsia-600 text-white">OK</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
