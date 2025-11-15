import { supabase } from './supabase';

export type EmailCheck = {
  in_use: boolean;
  source: string | null;
};

export async function isEmailInUse(email: string): Promise<EmailCheck> {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return { in_use: false, source: null };

  const { data, error } = await supabase.rpc('is_email_in_use', { p_email: normalized });
  if (error) {
    console.error('Email check RPC error:', error);
    // Fail closed to be safe
    return { in_use: true, source: 'rpc_error' };
  }

  // data can be object or array depending on RPC return
  const res = Array.isArray(data) ? data[0] : data;
  return {
    in_use: !!res?.in_use,
    source: res?.source ?? null
  };
}

export async function assertEmailAvailableOrThrow(email: string) {
  const check = await isEmailInUse(email);
  if (check.in_use) {
    const src = check.source ? ` (${check.source})` : '';
    throw new Error(`Email already exists${src}. Please use a different email.`);
  }
}
