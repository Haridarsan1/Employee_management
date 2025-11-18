import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, CheckCircle2, Loader2, Megaphone, Search } from 'lucide-react';

type Category = 'general' | 'holiday' | 'event' | 'hr_update' | 'alert';
type Priority = 'low' | 'normal' | 'high';

interface Announcement {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  category: Category;
  priority: Priority;
  status: 'draft'|'published';
  published_at: string | null;
  banner_image_url: string | null;
  attachments: Array<{ name: string; url: string; size?: number; type?: string }>; 
  created_at: string;
}

interface Filters {
  search: string;
  category: 'all' | Category;
  priority: 'all' | Priority;
  from: string | null;
  to: string | null;
}

export function EmployeeAnnouncementsPage() {
  const { organization, membership } = useAuth();
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({ search: '', category: 'all', priority: 'all', from: null, to: null });
  const [detail, setDetail] = useState<{ open: boolean; ann?: Announcement; createdBy?: string }>(()=>({ open:false }));

  useEffect(() => {
    if (!organization?.id) return;
    load();
    const channel = supabase
      .channel('realtime-announcements-employee')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, async () => { await load(); })
      .subscribe();
    return () => { try { channel.unsubscribe(); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const load = async () => {
    if (!organization?.id || !membership?.user_id) return;
    setLoading(true);
    try {
      const nowISO = new Date().toISOString();
      const { data: anns, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('status', 'published')
        .or(`published_at.is.null,published_at.lte.${nowISO}`)
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAnnouncements((anns as any) || []);

      const { data: reads, error: rErr } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', membership.user_id);
      if (rErr) throw rErr;
      setReadIds(new Set((reads || []).map((r: any) => r.announcement_id)));
    } catch (e) {
      console.error('Error loading announcements:', e);
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
    if (filters.from) list = list.filter(a => (a.published_at || a.created_at) >= `${filters.from}T00:00:00`);
    if (filters.to) list = list.filter(a => (a.published_at || a.created_at) <= `${filters.to}T23:59:59`);
    return list;
  }, [announcements, filters]);

  const markAsRead = async (id: string) => {
    if (!membership?.user_id) return;
    try {
      if (readIds.has(id)) return;
      const { error } = await supabase.from('announcement_reads').upsert({ announcement_id: id, user_id: membership.user_id });
      if (!error) setReadIds(prev => new Set(prev).add(id));
    } catch (e) { console.error('Failed to mark read', e); }
  };

  const unreadCount = useMemo(() => filtered.filter(a => !readIds.has(a.id)).length, [filtered, readIds]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-fuchsia-600" /> Announcements
          </h1>
          <p className="text-slate-600 mt-2">Latest updates from your organization</p>
        </div>
        <div className="flex items-center gap-2 text-slate-600"><Bell className="h-5 w-5"/> Unread: <span className="font-semibold">{unreadCount}</span></div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
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
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading && (
          <div className="flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/> Loading...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border p-8 text-center">
            <Megaphone className="h-10 w-10 text-fuchsia-300 mx-auto mb-3" />
            <div className="font-semibold text-slate-700">No announcements</div>
            <div className="text-slate-500 text-sm">New announcements will appear here instantly.</div>
          </div>
        )}
        {filtered.map(a => (
          <div key={a.id} className="bg-white rounded-2xl border p-5 cursor-pointer" onClick={async ()=>{
            await markAsRead(a.id);
            // load created_by name if available
            let createdBy: string | undefined = undefined;
            try {
              if (a as any && (a as any).created_by) {
                const createdByUser = (a as any).created_by as string;
                const { data: member } = await supabase
                  .from('organization_members')
                  .select('employee_id')
                  .eq('organization_id', organization!.id)
                  .eq('user_id', createdByUser)
                  .maybeSingle();
                if (member?.employee_id) {
                  const { data: emp } = await supabase
                    .from('employees')
                    .select('first_name,last_name')
                    .eq('id', member.employee_id)
                    .maybeSingle();
                  if (emp) createdBy = `${emp.first_name} ${emp.last_name}`;
                }
              }
            } catch {}
            setDetail({ open:true, ann: a, createdBy });
          }}>
            <div className="flex items-start gap-4">
              {a.banner_image_url && (
                <img src={a.banner_image_url} alt="banner" className="w-24 h-24 object-cover rounded-xl" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs mb-1">
                  {!readIds.has(a.id) && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"><Bell className="h-3 w-3"/>New</span>}
                  <span className={`px-2 py-0.5 rounded-full ${a.category==='alert'?'bg-red-100 text-red-700': a.category==='holiday'?'bg-emerald-100 text-emerald-700': 'bg-slate-100 text-slate-700'}`}>{a.category.replace('_',' ').toUpperCase()}</span>
                  <span className={`px-2 py-0.5 rounded-full ${a.priority==='high'?'bg-red-100 text-red-700': a.priority==='low'?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>{a.priority.toUpperCase()}</span>
                </div>
                <div className="text-lg font-semibold text-slate-900">{a.title}</div>
                <div className="text-slate-600" dangerouslySetInnerHTML={{ __html: a.content }} />
                <div className="text-xs text-slate-500 mt-2">{a.published_at ? new Date(a.published_at).toLocaleString() : new Date(a.created_at).toLocaleString()}</div>
                {readIds.has(a.id) && <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/> Read</div>}
                {a.attachments?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.attachments.map(att => (
                      <a key={att.url} className="text-sm text-blue-600 underline" href={att.url} target="_blank" rel="noreferrer">{att.name}</a>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
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
    </div>
  );
}
