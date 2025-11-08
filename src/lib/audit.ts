import { supabase } from './supabase';

export interface AuditLogData {
  action: string;
  tableName: string;
  recordId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  organizationId?: string;
}

export async function logAuditEvent(data: AuditLogData): Promise<void> {
  try {
    // Try RPC first (if migration is applied)
    try {
      const { error } = await (supabase.rpc as any)('log_audit_event', {
        p_action: data.action,
        p_table_name: data.tableName,
        p_record_id: data.recordId || null,
        p_old_values: data.oldValues || null,
        p_new_values: data.newValues || null,
        p_organization_id: data.organizationId || null
      });

      if (!error) return; // Success
    } catch (rpcError) {
      // RPC not available, try direct insert
    }

    // Fallback to direct insert (if table exists)
    try {
      const { error } = await (supabase.from as any)('audit_logs').insert({
        action: data.action,
        table_name: data.tableName,
        record_id: data.recordId || null,
        old_values: data.oldValues || null,
        new_values: data.newValues || null,
        organization_id: data.organizationId || null
      });

      if (!error) return; // Success
    } catch (insertError) {
      // Table doesn't exist yet
    }

    // If both fail, just log to console for now
    console.log('Audit Event:', {
      timestamp: new Date().toISOString(),
      ...data
    });

  } catch (error) {
    // Silent failure - audit logging should never break the app
    console.warn('Audit logging failed silently:', error);
  }
}

// Helper function to get organization ID from context
export async function getCurrentOrganizationId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return null;
    }

    return (data as any).organization_id;
  } catch (error) {
    console.error('Failed to get organization ID:', error);
    return null;
  }
}