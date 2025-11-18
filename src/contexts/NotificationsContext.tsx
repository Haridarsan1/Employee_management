import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type NotificationType = 'leave'|'announcement'|'payroll'|'task'|'goal'|'expense'|'performance'|'system';
export type NotificationPriority = 'normal'|'high'|'critical';

export interface NotificationItem {
  id: string;
  organization_id: string;
  sender_id: string | null;
  receiver_id: string | null;
  title: string;
  message: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  read_status: boolean;
  deleted: boolean;
  metadata: any;
  created_at: string;
}

interface NotificationsContextValue {
  list: NotificationItem[];
  unread: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { membership, organization } = useAuth();
  const [list, setList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!membership?.user_id || !organization?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('receiver_id', membership.user_id)
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setList((data as any) || []);
    } catch (e) {
      console.error('Failed to load notifications', e);
    } finally { setLoading(false); }
  }, [membership?.user_id, organization?.id]);

  useEffect(() => {
    const run = async () => {
      try { await supabase.rpc('process_due_announcement_notifications'); } catch {}
      await load();
    };
    run();
  }, [load]);

  useEffect(() => {
    if (!membership?.user_id) return;
    const channel = supabase
      .channel('rt-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${membership.user_id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setList(prev => [payload.new as any as NotificationItem, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setList(prev => prev.map(n => n.id === (payload.new as any).id ? (payload.new as any as NotificationItem) : n));
        }
      })
      .subscribe();
    return () => { try { channel.unsubscribe(); } catch {} };
  }, [membership?.user_id]);

  const unread = useMemo(() => list.filter(n => !n.read_status && !n.deleted), [list]);
  const unreadCount = unread.length;

  const markRead = useCallback(async (id: string) => {
    const { error } = await supabase.from('notifications').update({ read_status: true }).eq('id', id);
    if (!error) setList(prev => prev.map(n => n.id === id ? { ...n, read_status: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!membership?.user_id) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read_status: true })
      .eq('receiver_id', membership.user_id)
      .eq('read_status', false);
    if (!error) setList(prev => prev.map(n => ({ ...n, read_status: true })));
  }, [membership?.user_id]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('notifications').update({ deleted: true }).eq('id', id);
    if (!error) setList(prev => prev.filter(n => n.id !== id));
  }, []);

  const value = useMemo(() => ({ list, unread, unreadCount, loading, markRead, markAllRead, remove, refresh: load }), [list, unread, unreadCount, loading, markRead, markAllRead, remove, load]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
