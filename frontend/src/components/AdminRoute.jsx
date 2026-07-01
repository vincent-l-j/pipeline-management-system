/**
 * Route guard that only lets admins through. Non-admins are redirected to the
 * dashboard so admin-only pages (e.g. User Management) never render for them.
 * This is a UX guard — the backend independently enforces admin-only access.
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return children
}
