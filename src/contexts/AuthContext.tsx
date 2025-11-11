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
  requirePasswordChange: boolean;
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
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setProfile(null);
          setOrganization(null);
          setMembership(null);
          setPermissions(getPermissions(null));
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    console.log('=== LOADING USER PROFILE ===');
    console.log('User ID:', userId);
    console.log('User object exists:', !!user);
    console.log('User object:', user);
    console.log('User metadata exists:', !!user?.user_metadata);
    console.log('User metadata keys:', user?.user_metadata ? Object.keys(user.user_metadata) : 'No metadata');
    console.log('User metadata organization_name:', user?.user_metadata?.organization_name);
    console.log('LocalStorage pendingOrganizationName:', localStorage.getItem('pendingOrganizationName'));
    console.log('=== END USER PROFILE DEBUG ===');
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      console.log('User profile loaded:', profileData);

      // Check if user needs to change password (for employees on first login)
      const { data: sessionData } = await supabase.auth.getSession();
      const lastSignInTime = sessionData?.session?.user?.last_sign_in_at;
      const createdAtTime = sessionData?.session?.user?.created_at;
      
      // If this is the first login (last_sign_in_at equals created_at), require password change for employees
      if (lastSignInTime && createdAtTime && lastSignInTime === createdAtTime) {
        // Check if user is an employee
        const { data: memberData } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (memberData && memberData.role === 'employee') {
          setRequirePasswordChange(true);
        }
      }

      // If no profile exists, this might be an existing user
      // who signed up before the fix - create a default organization for them
      if (!profileData) {
        console.log('No profile found, creating default organization for user...');
        
        // Directly create a default organization
        try {
          await createOrganizationForUser(userId, 'My Organization');
          console.log('✅ Default organization created successfully');
          
          // Reload profile after creation
          const { data: newProfileData, error: reloadError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (reloadError) {
            console.error('Error reloading profile after default org creation:', reloadError);
          } else if (newProfileData) {
            setProfile(newProfileData);
            if (newProfileData.current_organization_id) {
              await loadOrganizationData(newProfileData.current_organization_id, userId);
            }
            return;
          }
        } catch (createError) {
          console.error('❌ Failed to create default organization:', createError);
        }
        
        console.log('ℹ️ Organization creation failed for user:', userId);
      } else {
        setProfile(profileData);

        if (profileData?.current_organization_id) {
          console.log('Found current_organization_id:', profileData.current_organization_id);
          await loadOrganizationData(profileData.current_organization_id, userId);
        } else {
          console.log('No current_organization_id found in profile');
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationData = async (organizationId: string, userId: string) => {
    console.log('Loading organization data for orgId:', organizationId, 'userId:', userId);
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .maybeSingle();

      if (orgError) throw orgError;
      console.log('Organization loaded:', orgData);
      setOrganization(orgData);

      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (memberError) throw memberError;
      console.log('Membership loaded:', memberData);

      // If no membership exists but user is the owner, create admin membership
      if (!memberData && orgData && orgData.owner_id === userId) {
        console.log('User is owner but no membership found, creating admin membership...');
        const { error: createMemberError } = await (supabase as any)
          .from('organization_members')
          .insert({
            organization_id: organizationId,
            user_id: userId,
            role: 'admin',
            is_active: true
          });

        if (createMemberError) {
          console.error('Failed to create admin membership:', createMemberError);
        } else {
          console.log('Admin membership created for owner');
          // Reload membership
          const { data: newMemberData, error: newMemberError } = await (supabase as any)
            .from('organization_members')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();

          if (!newMemberError && newMemberData) {
            setMembership(newMemberData);
            setPermissions(getPermissions(newMemberData.role));
            console.log('Permissions set for role:', newMemberData.role);
            return;
          }
        }
      }

      setMembership(memberData);
      setPermissions(getPermissions(memberData?.role || null));
      console.log('Permissions set for role:', memberData?.role);
    } catch (error) {
      console.error('Error loading organization:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, organizationName: string) => {
    console.log('=== SIGNUP START ===');
    console.log('Email:', email);
    console.log('Organization:', organizationName);

    // Store organization name in localStorage for cross-tab persistence
    localStorage.setItem('pendingOrganizationName', organizationName);
    console.log('Stored in localStorage:', localStorage.getItem('pendingOrganizationName'));

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          organization_name: organizationName
        }
      }
    });

    if (error) {
      console.error('Auth signup error:', error);
      // Clean up localStorage on error
      localStorage.removeItem('pendingOrganizationName');
      throw error;
    }

    console.log('Auth signup successful, user:', data.user?.id);
    console.log('User metadata after signup:', data.user?.user_metadata);

    // If user is immediately signed in (email confirmation not required)
    if (data.user && data.session) {
      console.log('User is immediately signed in, creating organization...');
      await createOrganizationForUser(data.user.id, organizationName);
      // Clean up localStorage since organization was created
      localStorage.removeItem('pendingOrganizationName');
    } else {
      console.log('Email confirmation required, organization name stored in localStorage');
    }
    console.log('=== SIGNUP END ===');
  };

  const createOrganizationForUser = async (userId: string, organizationName: string) => {
    console.log('🏗️ CREATE ORGANIZATION FUNCTION STARTED');
    console.log('User ID:', userId);
    console.log('Organization Name:', organizationName);
    try {
      // Try to use the Edge Function first (but don't fail if it doesn't work)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        if (accessToken) {
          const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-org`;

          const fnRes = await fetch(functionsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string
            },
            body: JSON.stringify({ organizationName })
          });

          if (fnRes.ok) {
            const fnData = await fnRes.json();
            const orgData = fnData.organization;

            if (orgData) {
              console.log('Edge function worked, org created:', orgData.id);
              // Edge Function worked, continue with subscription setup
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
                    trial_ends_at: trialEnd.toISOString()
                  });
              }
              return; // Success, exit
            }
          } else {
            console.log('Edge function returned non-ok status:', fnRes.status);
          }
        }
      } catch (edgeFunctionError) {
        console.log('Edge function not available or failed:', edgeFunctionError);
        // Continue to fallback - don't throw error here
      }

      // Fallback: Create organization directly
      console.log('Using fallback: creating organization directly...');

      // Generate slug and subdomain
      const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const subdomain = `${slug}-${Math.random().toString(36).substring(2, 8)}`;

      console.log('Creating organization with:', { name: organizationName, slug, subdomain, owner_id: userId });
      
      // Check authentication
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log('Current authenticated user before insert:', currentUser?.id);
      
      // Create organization
      const { data: orgData, error: orgError } = await (supabase as any)
        .from('organizations')
        .insert({
          name: organizationName,
          slug: slug,
          subdomain: subdomain,
          owner_id: userId
        })
        .select()
        .single();

      if (orgError) {
        console.error('Organization creation error:', orgError);
        console.error('Error details:', JSON.stringify(orgError, null, 2));
        throw orgError;
      }

      console.log('Organization created:', orgData.id);

      // Create organization membership with admin role
      const { error: memberError } = await (supabase as any)
        .from('organization_members')
        .insert({
          organization_id: orgData.id,
          user_id: userId,
          role: 'owner', // Changed from 'admin' to 'owner' for signup users
          is_active: true
        });

      if (memberError) {
        console.error('Membership creation error:', memberError);
        throw memberError;
      }

      console.log('Membership created with owner role');

      // Create user profile
      const { error: profileError } = await (supabase as any)
        .from('user_profiles')
        .insert({
          user_id: userId,
          current_organization_id: orgData.id
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }

      console.log('User profile created');

      // Set up starter subscription
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
            trial_ends_at: trialEnd.toISOString()
          });
      }

      console.log('Signup process completed successfully');
      console.log('🏗️ CREATE ORGANIZATION FUNCTION COMPLETED SUCCESSFULLY');

    } catch (fallbackError) {
      console.error('❌ ORGANIZATION CREATION FAILED:', fallbackError);
      throw new Error('Failed to create organization. Please try again.');
    }
  };  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const switchOrganization = async (organizationId: string) => {
    if (!user) return;

    try {
      const { error } = await (supabase as any)
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

    // Clear the requirePasswordChange flag
    setRequirePasswordChange(false);

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
    <AuthContext.Provider value={{ user, profile, organization, membership, permissions, loading, requirePasswordChange, signIn, signUp, signOut, switchOrganization, resetPassword, updatePassword }}>
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
