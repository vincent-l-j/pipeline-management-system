import { useState, useEffect, ChangeEvent, MouseEvent } from 'react'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import api from '../services/api'
import { User, ApiError } from '../types'

const roleBadge: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  assessor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
}

const selectClass = 'border border-navy-200 rounded-lg px-3 py-1.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300'

export default function UsersPage(): React.JSX.Element {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRole, setEditRole] = useState<string | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    api.get<User[]>('/users').then(({ data }: { data: User[] }) => {
      setUsers(data)
      setLoading(false)
    }).catch(() => { setLoading(false); })
  }, [])

  function startEdit(user: User): void {
    setError('')
    setEditingId(user.id)
    setEditRole(user.role)
  }

  function cancelEdit(): void {
    setEditingId(null)
    setEditRole(null)
  }

  async function saveEdit(user: User): Promise<void> {
    if (editRole === user.role) {
      setEditingId(null)
      return
    }

    setError('')
    try {
      const { data } = await api.patch<User>(`/users/${String(user.id)}`, { role: editRole })
      setUsers(prev => prev.map(u => u.id === user.id ? data : u))
      setEditingId(null)
    } catch (err: unknown) {
      const apiError = err as ApiError
      setError(apiError.response?.data?.detail ?? 'Failed to update user role')
    }
  }

  return (
    <Layout>
      <PageHeader
        title="User Management"
        description="Manage staff accounts and roles"
      />

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

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
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900">{u.display_name}</td>
                  <td className="px-4 py-3 text-navy-500">{u.email}</td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <div className="flex gap-2 items-center">
                        <label className="text-xs font-medium text-navy-600">Change role:</label>
                        <select
                          value={editRole ?? ''}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => { setEditRole(e.target.value); }}
                          className={selectClass}
                        >
                          <option value="admin">admin</option>
                          <option value="assessor">assessor</option>
                          <option value="viewer">viewer</option>
                        </select>
                      </div>
                    ) : (
                      <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full capitalize ${roleBadge[u.role] || 'bg-gray-100'}`}>
                        {u.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={(e: MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault()
                            void saveEdit(u)
                          }}
                          className="text-xs bg-navy-900 text-white px-3 py-1.5 rounded-lg hover:bg-navy-800 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={(e: MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault()
                            cancelEdit()
                          }}
                          className="text-xs bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e: MouseEvent<HTMLButtonElement>) => {
                          e.preventDefault()
                          startEdit(u)
                        }}
                        className="text-xs bg-navy-100 text-navy-900 px-3 py-1.5 rounded-lg hover:bg-navy-200 transition-colors"
                      >
                        Edit
                      </button>
                    )}
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
