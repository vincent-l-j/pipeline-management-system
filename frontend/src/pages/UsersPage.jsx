import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import api from '../services/api'

const roleBadge = {
  admin: 'bg-purple-100 text-purple-700',
  assessor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/users').then(({ data }) => {
      setUsers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <PageHeader
        title="User Management"
        description="Manage staff accounts and roles"
      />

      {loading ? (
        <p className="text-navy-400">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900">{u.display_name}</td>
                  <td className="px-4 py-3 text-navy-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full capitalize ${roleBadge[u.role] || 'bg-gray-100'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
