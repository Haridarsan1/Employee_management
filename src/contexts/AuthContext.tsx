import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '../lib/database.types';
import { getPermissions, type Permissions } from '../lib/permissions';
import { logPasswordChange } from '../lib/audit';
 // import roles from '../lib/roles'; // Commenting out unused import

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
  const isLoadingProfileRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const isCreatingOrgRef = useRef(false);
   // const [userRole, setUserRole] = useState<UserRole | null>(null); // Commenting out unused state

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          // Prevent concurrent profile loads AND duplicate loads for same user
          if (!isLoadingProfileRef.current && lastUserIdRef.current !== session.user.id) {
            console.log('🔐 Auth state change - loading profile for user:', session.user.id);
            isLoadingProfileRef.current = true;
            lastUserIdRef.current = session.user.id;
            await loadUserProfile(session.user.id, session.user);
            isLoadingProfileRef.current = false;
          } else {
            console.log('⏭️ Skipping duplicate profile load for user:', session.user.id);
          }
        } else {
          setProfile(null);
          setOrganization(null);
          setMembership(null);
          setPermissions(getPermissions(null));
          setLoading(false);
          lastUserIdRef.current = null;
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Note: Removed a broken useEffect that attempted to manage user roles directly from session
  // to avoid undefined variables and duplicate logic. Role is derived via membership and permissions.

  const loadUserProfile = async (userId: string, currentUser?: User) => {
    console.log('=== LOADING USER PROFILE ===');
    console.log('User ID:', userId);
    console.log('User object exists:', !!currentUser);
    console.log('User object:', currentUser);
    console.log('User metadata exists:', !!currentUser?.user_metadata);
    console.log('User metadata keys:', currentUser?.user_metadata ? Object.keys(currentUser.user_metadata) : 'No metadata');
    console.log('User metadata organization_name:', currentUser?.user_metadata?.organization_name);
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

      // If no profile exists, this might be a new user after email confirmation
      // Try to get organization name from multiple sources
      if (!profileData) {
        console.log('No profile found, attempting to create organization for user...');
        
        // Check if organization already exists to prevent duplicates
        const { data: existingOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_id', userId)
          .maybeSingle();
        
        if (existingOrg) {
          console.log('Organization already exists for user, skipping creation');
          // Just reload the profile which should now have the organization
          const { data: refreshedProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          
          if (refreshedProfile) {
            setProfile(refreshedProfile);
            if (refreshedProfile.current_organization_id) {
              await loadOrganizationData(refreshedProfile.current_organization_id, userId);
            }
          }
          setLoading(false);
          return;
        }
        
        // Try multiple sources for organization name (in priority order)
        // Use the passed currentUser or fetch fresh data
        const userToCheck = currentUser || (await supabase.auth.getUser()).data.user;
        const orgNameFromMetadata = userToCheck?.user_metadata?.organization_name;
        
        // Check database for pending organization
        let orgNameFromDB: string | null = null;
        try {
          const { data: pendingOrg } = await supabase
            .from('pending_organizations')
            .select('organization_name')
            .eq('user_id', userId)
            .maybeSingle();
          
          if (pendingOrg) {
            orgNameFromDB = pendingOrg.organization_name;
            console.log('Found pending org in database:', orgNameFromDB);
          }
        } catch (dbError) {
          console.error('Error checking pending_organizations:', dbError);
        }
        
        const orgNameFromLocalStorage = localStorage.getItem('pendingOrganizationName');
        const organizationName = orgNameFromDB || orgNameFromMetadata || orgNameFromLocalStorage || 'My Organization';
        
        console.log('Organization name from metadata:', orgNameFromMetadata);
        console.log('Organization name from database:', orgNameFromDB);
        console.log('Organization name from localStorage:', orgNameFromLocalStorage);
        console.log('Final organization name:', organizationName);
        
        // Create organization
        try {
          await createOrganizationForUser(userId, organizationName);
          console.log('✅ Organization created successfully:', organizationName);
          
          // Clean up all sources after successful creation
          if (orgNameFromLocalStorage) {
            localStorage.removeItem('pendingOrganizationName');
          }
          if (orgNameFromDB) {
            await supabase
              .from('pending_organizations')
              .delete()
              .eq('user_id', userId);
          }
          
          // Reload profile after creation
          const { data: newProfileData, error: reloadError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (reloadError) {
            console.error('Error reloading profile after org creation:', reloadError);
          } else if (newProfileData) {
            setProfile(newProfileData);
            if (newProfileData.current_organization_id) {
              await loadOrganizationData(newProfileData.current_organization_id, userId);
            }
            return;
          }
        } catch (createError) {
          console.error('❌ Failed to create organization:', createError);
        }
        
        console.log('ℹ️ Organization creation process completed for user:', userId);
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

    // Store organization name in localStorage for immediate backup
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
      localStorage.removeItem('pendingOrganizationName');
      throw error;
    }

    console.log('Auth signup successful, user:', data.user?.id);
    console.log('User metadata after signup:', data.user?.user_metadata);

    // If user is immediately signed in (email confirmation not required)
    if (data.user && data.session) {
      console.log('User is immediately signed in, creating organization...');
      await createOrganizationForUser(data.user.id, organizationName);
      localStorage.removeItem('pendingOrganizationName');
    } else if (data.user) {
      // Store in database for persistence across sessions
      console.log('Email confirmation required, storing org name in database...');
      try {
        await supabase
          .from('pending_organizations')
          .insert({
            user_id: data.user.id,
            organization_name: organizationName
          });
        console.log('Organization name stored in pending_organizations table');
      } catch (dbError) {
        console.error('Failed to store pending org in database:', dbError);
        // localStorage is still our backup
      }
    }
    console.log('=== SIGNUP END ===');
  };

  const createOrganizationForUser = async (userId: string, organizationName: string) => {
    console.log('🏗️ CREATE ORGANIZATION FUNCTION STARTED');
    console.log('User ID:', userId);
    console.log('Organization Name:', organizationName);
    
    // Prevent duplicate organization creation
    if (isCreatingOrgRef.current) {
      console.log('⏭️ Organization creation already in progress, skipping duplicate call');
      return;
    }
    
    isCreatingOrgRef.current = true;
    
    try {
      // Double-check if organization already exists
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();
      
      if (existingOrg) {
        console.log('✅ Organization already exists, skipping creation:', existingOrg.id);
        return;
      }
      
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

      // Generate unique slug and subdomain with timestamp and random string
      const baseSlug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const timestamp = Date.now().toString(36);
      const randomStr = Math.random().toString(36).substring(2, 8);
      const slug = `${baseSlug}-${timestamp}-${randomStr}`;
      const subdomain = `${baseSlug}-${randomStr}`;

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

      // Create organization membership with owner role
      const { error: memberError } = await (supabase as any)
        .from('organization_members')
        .insert({
          organization_id: orgData.id,
          user_id: userId,
          role: 'owner', // Owner role for signup users
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
    } finally {
      isCreatingOrgRef.current = false;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const switchOrganization = async (organizationId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Update user profile with new organization
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ current_organization_id: organizationId })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      setProfile(prev => prev ? { ...prev, current_organization_id: organizationId } : null);

      // Load new organization data
      await loadOrganizationData(organizationId, user.id);
    } catch (error) {
      console.error('Error switching organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const updatePassword = async (password: string) => {
    if (!user) return;
    try {
      // Update password in Supabase auth
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;

      // Log password change event
      await logPasswordChange(user.id);

      setRequirePasswordChange(false);
    } catch (error) {
      console.error('Error updating password:', error);
    }
  };

  // Refresh user and profile data on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
        }
        if (cancelled) return;

        const session = data?.session ?? null;
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await loadUserProfile(currentUser.id);
        } else {
          setProfile(null);
          setOrganization(null);
          setMembership(null);
          setPermissions(getPermissions(null));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = {
    user,
    profile,
    organization,
    membership,
    permissions,
    loading,
    requirePasswordChange,
    signIn,
    signUp,
    signOut,
    switchOrganization,
    resetPassword,
    updatePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
