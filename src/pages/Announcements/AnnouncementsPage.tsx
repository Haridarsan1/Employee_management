import { useAuth } from '../../contexts/AuthContext';
import { OwnerAnnouncementsPage } from './OwnerAnnouncementsPage';
import { EmployeeAnnouncementsPage } from './EmployeeAnnouncementsPage';

export function AnnouncementsPage() {
  const { membership } = useAuth();
  const isOwner = membership?.role === 'owner';
  return isOwner ? <OwnerAnnouncementsPage /> : <EmployeeAnnouncementsPage />;
}
