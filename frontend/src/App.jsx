import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import AuthCallback from './pages/AuthCallback'
import DashboardPage from './pages/DashboardPage'
import PipelinePage from './pages/PipelinePage'
import PitchesPage from './pages/PitchesPage'
import PitchCreatePage from './pages/PitchCreatePage'
import PitchDetailPage from './pages/PitchDetailPage'
import PitchEditPage from './pages/PitchEditPage'
import SearchPage from './pages/SearchPage'
import OrganisationsPage from './pages/OrganisationsPage'
import ContactsPage from './pages/ContactsPage'
import MeetingsPage from './pages/MeetingsPage'
import MeetingCreatePage from './pages/MeetingCreatePage'
import MeetingDetailPage from './pages/MeetingDetailPage'
import AssessmentsPage from './pages/AssessmentsPage'
import AssessmentCreatePage from './pages/AssessmentCreatePage'
import AssessmentDetailPage from './pages/AssessmentDetailPage'
import ReportsPage from './pages/ReportsPage'
import UsersPage from './pages/UsersPage'
import AdminRoute from './components/AdminRoute'

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth()
  if (loading) return null
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
      <Route path="/pitches" element={<ProtectedRoute><PitchesPage /></ProtectedRoute>} />
      <Route path="/pitches/new" element={<ProtectedRoute><PitchCreatePage /></ProtectedRoute>} />
      <Route path="/pitches/:pitchId" element={<ProtectedRoute><PitchDetailPage /></ProtectedRoute>} />
      <Route path="/pitches/:pitchId/edit" element={<ProtectedRoute><PitchEditPage /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
      <Route path="/organisations" element={<ProtectedRoute><OrganisationsPage /></ProtectedRoute>} />
      <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
      <Route path="/meetings" element={<ProtectedRoute><MeetingsPage /></ProtectedRoute>} />
      <Route path="/meetings/new" element={<ProtectedRoute><MeetingCreatePage /></ProtectedRoute>} />
      <Route path="/meetings/:meetingId" element={<ProtectedRoute><MeetingDetailPage /></ProtectedRoute>} />
      <Route path="/assessments" element={<ProtectedRoute><AssessmentsPage /></ProtectedRoute>} />
      <Route path="/assessments/new" element={<ProtectedRoute><AssessmentCreatePage /></ProtectedRoute>} />
      <Route path="/assessments/:assessmentId" element={<ProtectedRoute><AssessmentDetailPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminRoute><UsersPage /></AdminRoute></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
