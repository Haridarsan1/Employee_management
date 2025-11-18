import { useEffect, useMemo, useState } from 'react';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, CheckCircle2, Filter, Loader2, RefreshCcw, Trash2 } from 'lucide-react';

export function NotificationsPage() {
  const { list, unread, loading, markRead, markAllRead, remove, refresh } = useNotifications();
  const { organization } = useAuth();
  const [filters, setFilters] = useState<{ status: 'all'|'unread'|'read'; type: 'all'|'leave'|'announcement'|'payroll'|'task'|'goal'|'expense'|'performance'|'system'; from: string|null; to: string|null; search: string }>({ status:'all', type:'all', from:null, to:null, search:'' });

  useEffect(() => { refresh(); }, [organization?.id]);

  const filtered = useMemo(() => {
    let items = list;
    if (filters.status === 'unread') items = items.filter(n => !n.read_status);
    if (filters.status === 'read') items = items.filter(n => n.read_status);
    if (filters.type !== 'all') items = items.filter(n => n.type === filters.type);
    if (filters.from) items = items.filter(n => n.created_at >= `${filters.from}T00:00:00`);
    if (filters.to) items = items.filter(n => n.created_at <= `${filters.to}T23:59:59`);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(n => n.title.toLowerCase().includes(q) || (n.message || '').toLowerCase().includes(q));
    }
    return items;
  }, [list, filters]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Bell className="h-8 w-8 text-blue-600"/> Notifications</h1>
          <p className="text-slate-600 mt-2">Stay on top of updates across your organization</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 flex items-center gap-2"><RefreshCcw className="h-4 w-4"/> Refresh</button>
          {unread.length>0 && <button onClick={markAllRead} className="px-3 py-2 rounded-lg bg-blue-600 text-white flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> Mark all as read</button>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-50"><Filter className="h-4 w-4 text-slate-400"/>
          <select className="bg-transparent outline-none" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value as any}))}>
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
        <select className="px-3 py-2 rounded-xl border bg-white" value={filters.type} onChange={e=>setFilters(f=>({...f,type:e.target.value as any}))}>
          <option value="all">All Types</option>
          <option value="leave">Leave</option>
          <option value="announcement">Announcement</option>
          <option value="payroll">Payroll</option>
          <option value="task">Task</option>
          <option value="goal">Goal</option>
          <option value="expense">Expense</option>
          <option value="performance">Performance</option>
          <option value="system">System</option>
        </select>
        <input className="px-3 py-2 rounded-xl border bg-white" placeholder="From" type="date" value={filters.from ?? ''} onChange={e=>setFilters(f=>({...f,from:e.target.value||null}))}/>
        <input className="px-3 py-2 rounded-xl border bg-white" placeholder="To" type="date" value={filters.to ?? ''} onChange={e=>setFilters(f=>({...f,to:e.target.value||null}))}/>
        <input className="px-3 py-2 rounded-xl border bg-white" placeholder="Search" value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))}/>
      </div>

      <div className="bg-white rounded-2xl border">
        {loading && (<div className="p-6 text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading...</div>)}
        {!loading && filtered.length === 0 && (<div className="p-8 text-center text-slate-500">No notifications</div>)}
        <div>
          {filtered.map(n => (
            <div key={n.id} className={`p-4 border-b last:border-b-0 ${!n.read_status ? 'bg-blue-50/50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-1 h-2 w-2 rounded-full ${n.read_status ? 'bg-slate-300' : 'bg-blue-600'}`}></div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                  {n.message && <div className="text-sm text-slate-600">{n.message}</div>}
                  <div className="text-xs text-slate-500 mt-1">{new Date(n.created_at).toLocaleString()} • {n.type}</div>
                </div>
                <div className="flex items-center gap-2">
                  {!n.read_status && <button onClick={()=>markRead(n.id)} className="text-blue-600 text-sm">Mark read</button>}
                  <button onClick={()=>remove(n.id)} className="text-slate-500 hover:text-red-600"><Trash2 className="h-4 w-4"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
