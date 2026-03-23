import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [loadTimeout, setLoadTimeout] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoadTimeout(true);
      }
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [loading]);

  if (loading) {
    if (loadTimeout) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center max-w-md">
            <div className="text-red-600 mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Loading is taking longer than expected</h2>
            <p className="text-sm text-gray-600 mb-6">
              There might be a connection issue. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
