import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SetupStatus {
  hasDepartments: boolean;
  hasDesignations: boolean;
  hasBranches: boolean;
  isComplete: boolean;
  loading: boolean;
}

/**
 * Hook to check if organization has completed initial master data setup
 * Returns the setup status and a function to mark setup as complete
 */
export function useSetupStatus(organizationId: string | undefined) {
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({
    hasDepartments: false,
    hasDesignations: false,
    hasBranches: false,
    isComplete: false,
    loading: true,
  });

  const checkSetupStatus = async () => {
    if (!organizationId) {
      setSetupStatus({
        hasDepartments: false,
        hasDesignations: false,
        hasBranches: false,
        isComplete: false,
        loading: false,
      });
      return;
    }

    try {
      // First check if setup is already marked as complete in DB
      const { data: orgData } = await supabase
        .from('organizations')
        .select('setup_completed')
        .eq('id', organizationId)
        .single();

      if (orgData?.setup_completed) {
        setSetupStatus({
          hasDepartments: true,
          hasDesignations: true,
          hasBranches: true,
          isComplete: true,
          loading: false,
        });
        return;
      }

      // Check actual master data
      const [deptResult, designResult, branchResult] = await Promise.all([
        supabase
          .from('departments')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        supabase
          .from('designations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        supabase
          .from('branches')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
      ]);

      const hasDepartments = (deptResult.count ?? 0) > 0;
      const hasDesignations = (designResult.count ?? 0) > 0;
      const hasBranches = (branchResult.count ?? 0) > 0;
      const isComplete = hasDepartments && hasDesignations;

      setSetupStatus({
        hasDepartments,
        hasDesignations,
        hasBranches,
        isComplete,
        loading: false,
      });

      // Auto-mark setup as complete if requirements are met
      if (isComplete && !orgData?.setup_completed) {
        await markSetupComplete();
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
      setSetupStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const markSetupComplete = async () => {
    if (!organizationId) return;

    try {
      await supabase
        .from('organizations')
        .update({ setup_completed: true })
        .eq('id', organizationId);

      setSetupStatus(prev => ({ ...prev, isComplete: true }));
    } catch (error) {
      console.error('Error marking setup as complete:', error);
    }
  };

  const refreshSetupStatus = () => {
    checkSetupStatus();
  };

  useEffect(() => {
    checkSetupStatus();
  }, [organizationId]);

  return {
    setupStatus,
    refreshSetupStatus,
  };
}
