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
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

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
        console.log('⚡ Creating org for new user...');
        
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
          }
        } catch (dbError) {
          console.error('Error checking pending_organizations:', dbError);
        }
        
        const orgNameFromLocalStorage = localStorage.getItem('pendingOrganizationName');
        const organizationName = orgNameFromDB || orgNameFromMetadata || orgNameFromLocalStorage || 'My Organization';
        
        console.log('📝 Org name:', organizationName);
        
        // Create organization
        try {
          await createOrganizationForUser(userId, organizationName);
          console.log('✅ Org created:', organizationName);
          
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
          
          // Reload profile after creation - MUST succeed
          const { data: newProfileData, error: reloadError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (reloadError) {
            console.error('Error reloading profile after org creation:', reloadError);
            throw new Error('Organization created but failed to load profile');
          }
          
          if (!newProfileData) {
            console.error('No profile found after organization creation!');
            throw new Error('Organization created but profile not found');
          }
          
          setProfile(newProfileData);
          
          if (newProfileData.current_organization_id) {
            await loadOrganizationData(newProfileData.current_organization_id, userId);
          }
          
          return;
        } catch (createError) {
          console.error('❌ Failed to create organization:', createError);
          // Don't throw - let it fall through to set loading false
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

      // If no membership exists but user is the owner, create owner membership
      if (!memberData && orgData && orgData.owner_id === userId) {
        const { error: createMemberError, data: newMemberData } = await (supabase as any)
          .from('organization_members')
          .insert({
            organization_id: organizationId,
            user_id: userId,
            role: 'owner',
            is_active: true
          })
          .select()
          .single();

        if (!createMemberError && newMemberData) {
          setMembership(newMemberData);
          setPermissions(getPermissions(newMemberData.role));
          return;
        }
      }

      setMembership(memberData);
      setPermissions(getPermissions(memberData?.role || null));
    } catch (error) {
      console.error('Error loading organization:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      // Check if it's an email not confirmed error
      if (error.message.toLowerCase().includes('email not confirmed') || 
          error.message.toLowerCase().includes('confirmation')) {
        throw new Error('Email confirmation is not yet done. Please check your email and confirm your account.');
      }
      throw error;
    }
    
    // Additional check: verify email is confirmed
    if (data?.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      throw new Error('Email confirmation is not yet done. Please check your email and confirm your account.');
    }
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
    console.log('🚀 FAST ORG CREATE STARTED');
    
    // Prevent duplicate organization creation
    if (isCreatingOrgRef.current) {
      console.log('⏭️ Already creating, skip');
      return;
    }
    
    isCreatingOrgRef.current = true;
    
    try {
      // Quick check if org already exists
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();
      
      if (existingOrg) {
        console.log('✅ Org exists:', existingOrg.id);
        return;
      }
      
      // SKIP EDGE FUNCTION - Go directly to database for speed

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
      const { data: memberData, error: memberError } = await (supabase as any)
        .from('organization_members')
        .insert({
          organization_id: orgData.id,
          user_id: userId,
          role: 'owner', // Owner role for signup users
          is_active: true
        })
        .select()
        .single();

      if (memberError) {
        console.error('Membership creation error:', memberError);
        console.error('Membership error details:', JSON.stringify(memberError, null, 2));
        throw memberError;
      }

      console.log('Membership created with owner role:', memberData);

      // Create user profile
      const { data: profileData, error: profileError } = await (supabase as any)
        .from('user_profiles')
        .insert({
          user_id: userId,
          current_organization_id: orgData.id
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        console.error('Profile error details:', JSON.stringify(profileError, null, 2));
        throw profileError;
      }

      console.log('User profile created:', profileData);

      // Set up subscription in background (don't wait) - fire and forget
      Promise.resolve().then(async () => {
        try {
          const { data: starterPlan } = await supabase
            .from('subscription_plans')
            .select('id')
            .eq('name', 'Starter')
            .maybeSingle();
          
          if (starterPlan) {
            const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
            await supabase
              .from('organization_subscriptions')
              .insert({
                organization_id: orgData.id,
                plan_id: starterPlan.id,
                status: 'trial',
                trial_ends_at: trialEnd.toISOString()
              });
          }
        } catch (err) {
          console.error('Subscription setup failed (non-critical):', err);
        }
      });

      console.log('✅ ORG CREATED FAST');

    } catch (fallbackError: any) {
      console.error('❌ ORG CREATE FAILED:', fallbackError);
      console.error('Message:', fallbackError?.message);
      console.error('Code:', fallbackError?.code);
      throw new Error(`Failed to create organization: ${fallbackError?.message || 'Unknown error'}`);
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
          // Only load if not already loaded for this user
          if (lastUserIdRef.current !== currentUser.id) {
            lastUserIdRef.current = currentUser.id;
            await loadUserProfile(currentUser.id, currentUser);
          }
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
