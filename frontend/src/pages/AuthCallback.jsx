import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    async function handleCallback() {
      const token = searchParams.get('token')
      if (!token) {
        navigate('/login')
        return
      }

      // Store token and fetch user profile
      localStorage.setItem('token', token)
      try {
        const { data } = await api.get('/users/me')
        login(token, data)
        navigate('/')
      } catch {
        navigate('/login')
      }
    }
    handleCallback()
  }, [searchParams, login, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-navy-500">Signing you in...</p>
    </div>
  )
}
