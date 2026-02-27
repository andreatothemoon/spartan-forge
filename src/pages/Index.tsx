import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/pages/Auth';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Navigate to={user ? '/dashboard' : '/auth'} replace />;
}
