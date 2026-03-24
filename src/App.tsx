import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import AddCompany from './pages/AddCompany';
import Updates from './pages/Updates';
import UpdateDetail from './pages/UpdateDetail';
import SingleUpdate from './pages/SingleUpdate';
import TrackedSources from './pages/TrackedSources';
import RealTimeScans from './pages/RealTimeScans';
import Archive from './pages/Archive';
import Favorites from './pages/Favorites';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Admin from './pages/Admin';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/landingpage" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
          <Route
            path="/add-company"
            element={
              <ProtectedRoute>
                <AddCompany />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Updates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/updates/:batchLabel"
            element={
              <ProtectedRoute>
                <UpdateDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/update/:updateId"
            element={
              <ProtectedRoute>
                <SingleUpdate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tracked-sources"
            element={
              <ProtectedRoute>
                <TrackedSources />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scans"
            element={
              <ProtectedRoute>
                <RealTimeScans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/archive"
            element={
              <ProtectedRoute>
                <Archive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <Billing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
