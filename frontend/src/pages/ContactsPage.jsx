import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import api from '../services/api'

export default function ContactsPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/contacts').then(({ data }) => {
      setContacts(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <PageHeader
        title="Contacts"
        description="External contacts linked to pitches and meetings"
      />

      {loading ? (
        <p className="text-navy-400">Loading...</p>
      ) : contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-navy-100 p-8 text-center">
          <p className="text-navy-500">No contacts yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Last Contacted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900">{c.name}</td>
                  <td className="px-4 py-3 text-navy-500">{c.role || '-'}</td>
                  <td className="px-4 py-3 text-navy-500">{c.email || '-'}</td>
                  <td className="px-4 py-3 text-navy-500">{c.last_contacted || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
