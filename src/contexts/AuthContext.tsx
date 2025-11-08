import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '../lib/database.types';
import { getPermissions, type Permissions } from '../lib/permissions';
import { logPasswordChange } from '../lib/audit';

interface UserProfile {
  id: string;
  user_id: string | null;
  current_organization_id: string | null;
  is_active: boolean;
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  employee_id: string | null;
  is_active: boolean;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  owner_id: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  organization: Organization | null;
  membership: OrganizationMember | null;
  permissions: Permissions;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, organizationName: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [permissions, setPermissions] = useState<Permissions>(getPermissions(null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setProfile(null);
          setOrganization(null);
          setMembership(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData);

      if (profileData?.current_organization_id) {
        await loadOrganizationData(profileData.current_organization_id, userId);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationData = async (organizationId: string, userId: string) => {
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .maybeSingle();

      if (orgError) throw orgError;
      setOrganization(orgData);

      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (memberError) throw memberError;
      setMembership(memberData);
      setPermissions(getPermissions(memberData?.role || null));
    } catch (error) {
      console.error('Error loading organization:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, organizationName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.user) {
      // Try to sign the user in immediately after signup so subsequent
      // requests (inserts) carry the auth token and satisfy RLS policies.
      // Note: this may fail if your Supabase project requires email
      // confirmation before issuing a session. In that case, use the
      // server-side flow (Edge Function) described elsewhere.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        // If sign-in fails, surface the error so the caller can handle it.
        throw signInError;
      }

      // small delay to allow the session to be established in client storage
      await new Promise((r) => setTimeout(r, 200));

      // Use server-side Edge Function to create organization + membership
      // This avoids RLS race conditions and runs with service_role privileges.
      // Get current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('Missing access token after sign-in');
      }

      const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-org`;

      const fnRes = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          // apikey header helps Supabase route the request
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string
        },
        body: JSON.stringify({ organizationName })
      });

      if (!fnRes.ok) {
        const errBody = await fnRes.json().catch(() => ({}));
        throw new Error(errBody?.error || `Create org function failed with status ${fnRes.status}`);
      }

      const fnData = await fnRes.json();
      const orgData = fnData.organization;

      if (!orgData) throw new Error('Organization creation failed on server');

      const starterPlan = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', 'Starter')
        .maybeSingle();

      if (starterPlan.data) {
        const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await supabase
          .from('organization_subscriptions')
          .insert({
            organization_id: orgData.id,
            plan_id: starterPlan.data.id,
            status: 'trial',
            interval: 'monthly',
            amount: 999,
            current_period_start: new Date().toISOString(),
            current_period_end: trialEnd.toISOString(),
            trial_start: new Date().toISOString(),
            trial_end: trialEnd.toISOString()
          });
      }
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const switchOrganization = async (organizationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ current_organization_id: organizationId })
        .eq('user_id', user.id);

      if (error) throw error;

      await loadUserProfile(user.id);
    } catch (error) {
      console.error('Error switching organization:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;

    // Log the password change for audit purposes
    if (user) {
      try {
        await logPasswordChange(user.id, membership?.organization_id);
      } catch (auditError) {
        // Don't fail the password update if audit logging fails
        console.warn('Password change audit logging failed:', auditError);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, organization, membership, permissions, loading, signIn, signUp, signOut, switchOrganization, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
