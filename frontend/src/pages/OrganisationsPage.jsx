import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

const inputClass =
  'w-full border border-navy-200 rounded-lg px-3 py-1.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300'

export default function OrganisationsPage() {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', sector: '' })
  const [confirmingId, setConfirmingId] = useState(null)
  const [error, setError] = useState('')

  const canAdd = user?.role === 'admin' || user?.role === 'assessor'
  const canRemove = user?.role === 'admin'

  useEffect(() => {
    api.get('/organisations').then(({ data }) => {
      setOrgs(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function addOrg() {
    if (!form.name.trim()) return
    setError('')
    try {
      const { data } = await api.post('/organisations', {
        name: form.name.trim(),
        sector: form.sector.trim() || null,
      })
      setOrgs((prev) => [...prev, data])
      setForm({ name: '', sector: '' })
      setShowAdd(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add organisation')
    }
  }

  async function removeOrg(id) {
    setError('')
    try {
      await api.delete(`/organisations/${id}`)
      setOrgs((prev) => prev.filter((o) => o.id !== id))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove organisation')
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <Layout>
      <PageHeader
        title="Organisations"
        description="Organisations linked to pitches and contacts"
        action={canAdd && (
          <button
            onClick={() => { setShowAdd((s) => !s); setError('') }}
            className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
          >
            + Add Organisation
          </button>
        )}
      />

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {showAdd && canAdd && (
        <div className="mb-4 p-4 bg-navy-50 rounded-lg space-y-2">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Organisation name"
            className={inputClass}
          />
          <input
            type="text"
            value={form.sector}
            onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))}
            placeholder="Sector (optional)"
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              onClick={addOrg}
              disabled={!form.name.trim()}
              className="text-xs bg-navy-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => { setShowAdd(false); setForm({ name: '', sector: '' }) }}
              className="text-xs border border-navy-200 text-navy-600 px-3 py-1.5 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-navy-400">Loading...</p>
      ) : orgs.length === 0 ? (
        <div className="bg-white rounded-xl border border-navy-100 p-8 text-center">
          <p className="text-navy-500">No organisations yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Sector</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">State</th>
                {canRemove && (
                  <th className="text-right px-4 py-3 font-semibold text-navy-700">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {orgs.map((org) => (
                <tr key={org.id} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900">{org.name}</td>
                  <td className="px-4 py-3 text-navy-500 capitalize">{org.org_type?.replace('_', ' ') || '-'}</td>
                  <td className="px-4 py-3 text-navy-500">{org.sector || '-'}</td>
                  <td className="px-4 py-3 text-navy-500">{org.state_territory || '-'}</td>
                  {canRemove && (
                    <td className="px-4 py-3 text-right">
                      {confirmingId === org.id ? (
                        <span className="inline-flex gap-2">
                          <button
                            onClick={() => removeOrg(org.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmingId(null)}
                            className="text-xs text-navy-500 hover:text-navy-700"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => { setConfirmingId(org.id); setError('') }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
