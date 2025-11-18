import { supabase } from './supabase';

export type NotificationType = 'leave'|'announcement'|'payroll'|'task'|'goal'|'expense'|'performance'|'system';
export type NotificationPriority = 'normal'|'high'|'critical';

export async function sendNotification(args: {
  organizationId: string;
  senderId: string | null;
  receiverId: string | null; // if null, caller should loop through members
  title: string;
  message?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  metadata?: any;
}) {
  const { error } = await supabase.from('notifications').insert({
    organization_id: args.organizationId,
    sender_id: args.senderId,
    receiver_id: args.receiverId,
    title: args.title,
    message: args.message ?? null,
    type: args.type,
    priority: args.priority ?? 'normal',
    metadata: args.metadata ?? {},
  });
  if (error) throw error;
}

export function typeColor(type: NotificationType): string {
  switch (type) {
    case 'leave': return 'text-emerald-600';
    case 'announcement': return 'text-fuchsia-600';
    case 'payroll': return 'text-rose-600';
    case 'task': return 'text-blue-600';
    case 'goal': return 'text-indigo-600';
    case 'expense': return 'text-amber-600';
    case 'performance': return 'text-violet-600';
    case 'system': return 'text-slate-600';
    default: return 'text-slate-600';
  }
}
