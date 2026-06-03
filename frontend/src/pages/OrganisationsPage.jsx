import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import api from '../services/api'

export default function OrganisationsPage() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/organisations').then(({ data }) => {
      setOrgs(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <PageHeader
        title="Organisations"
        description="Organisations linked to pitches and contacts"
      />

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
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {orgs.map((org) => (
                <tr key={org.id} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900">{org.name}</td>
                  <td className="px-4 py-3 text-navy-500 capitalize">{org.org_type?.replace('_', ' ') || '-'}</td>
                  <td className="px-4 py-3 text-navy-500">{org.sector || '-'}</td>
                  <td className="px-4 py-3 text-navy-500">{org.state_territory || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
