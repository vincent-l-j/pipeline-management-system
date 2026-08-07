import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { User } from '../types'

export default function AuthCallback(): React.JSX.Element {
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    async function handleCallback() {
      const token = searchParams.get('token')
      if (!token) {
        void navigate('/login')
        return
      }

      // Store token and fetch user profile
      localStorage.setItem('token', token)
      try {
        const { data } = await api.get<User>('/users/me')
        login(token, data)
        void navigate('/')
      } catch {
        void navigate('/login')
      }
    }
    void handleCallback()
  }, [searchParams, login, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-navy-500">Signing you in...</p>
    </div>
  )
}
