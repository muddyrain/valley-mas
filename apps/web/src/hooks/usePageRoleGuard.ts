import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';

type UsePageRoleGuardOptions = {
  allowRoles: string[];
  unauthorizedMessage?: string;
  unauthenticatedRedirectTo?: string;
  unauthorizedRedirectTo?: string;
  enabled?: boolean;
};

export function usePageRoleGuard({
  allowRoles,
  unauthorizedMessage,
  unauthenticatedRedirectTo = '/login',
  unauthorizedRedirectTo = '/',
  enabled = true,
}: UsePageRoleGuardOptions) {
  const navigate = useNavigate();
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  const hasRoleAccess = Boolean(user?.role && allowRoles.includes(user.role));

  useEffect(() => {
    if (!enabled || !hasHydrated) return;
    if (!isAuthenticated) {
      navigate(unauthenticatedRedirectTo);
      return;
    }
    if (!hasRoleAccess) {
      if (unauthorizedMessage) toast.error(unauthorizedMessage);
      navigate(unauthorizedRedirectTo);
    }
  }, [
    enabled,
    hasHydrated,
    hasRoleAccess,
    isAuthenticated,
    navigate,
    unauthenticatedRedirectTo,
    unauthorizedMessage,
    unauthorizedRedirectTo,
  ]);

  return {
    canAccess: enabled && hasHydrated && isAuthenticated && hasRoleAccess,
    hasHydrated,
    isAuthenticated,
    user,
  };
}
