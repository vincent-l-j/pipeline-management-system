/**
 * Attendee management for a meeting.
 * Shows current attendees and allows adding internal (staff) or external (contacts).
 */

import { useState, useEffect } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

export default function MeetingAttendees({ meetingId }) {
  const { user } = useAuth()
  const [attendees, setAttendees] = useState([])
  const [users, setUsers] = useState([])
  const [contacts, setContacts] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState('internal')
  const [selectedId, setSelectedId] = useState('')

  const canEdit = user?.role === 'admin' || user?.role === 'assessor'

  useEffect(() => {
    loadAttendees()
    api.get('/users').then(({ data }) => setUsers(data))
    api.get('/contacts').then(({ data }) => setContacts(data))
  }, [meetingId])

  function loadAttendees() {
    api.get(`/meetings/${meetingId}/attendees`).then(({ data }) => setAttendees(data))
  }

  async function addAttendee() {
    if (!selectedId) return
    const payload = addType === 'internal'
      ? { user_id: selectedId, is_internal: true }
      : { contact_id: selectedId, is_internal: false }

    await api.post(`/meetings/${meetingId}/attendees`, payload)
    loadAttendees()
    setSelectedId('')
    setShowAdd(false)
  }

  async function removeAttendee(attendeeId) {
    await api.delete(`/meetings/${meetingId}/attendees/${attendeeId}`)
    loadAttendees()
  }

  // Resolve names for display
  function getAttendeeName(attendee) {
    if (attendee.is_internal && attendee.user_id) {
      const u = users.find(u => u.id === attendee.user_id)
      return u ? u.display_name : 'Unknown staff'
    }
    if (attendee.contact_id) {
      const c = contacts.find(c => c.id === attendee.contact_id)
      return c ? c.name : 'Unknown contact'
    }
    return 'Unknown'
  }

  return (
    <div className="bg-white rounded-xl border border-navy-100 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide">Attendees</h2>
        {canEdit && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-xs text-navy-600 hover:text-navy-900 font-medium"
          >
            {showAdd ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {/* Add attendee form */}
      {showAdd && (
        <div className="mb-4 p-3 bg-navy-50 rounded-lg space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => { setAddType('internal'); setSelectedId('') }}
              className={`text-xs px-2 py-1 rounded ${addType === 'internal' ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 border border-navy-200'}`}
            >
              Rozetta Staff
            </button>
            <button
              onClick={() => { setAddType('external'); setSelectedId('') }}
              className={`text-xs px-2 py-1 rounded ${addType === 'external' ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 border border-navy-200'}`}
            >
              External Contact
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="flex-1 text-sm border border-navy-200 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">Select {addType === 'internal' ? 'staff member' : 'contact'}...</option>
              {addType === 'internal'
                ? users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)
                : contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
              }
            </select>
            <button
              onClick={addAttendee}
              disabled={!selectedId}
              className="text-xs bg-navy-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Attendee list */}
      {attendees.length === 0 ? (
        <p className="text-sm text-navy-400">No attendees recorded.</p>
      ) : (
        <ul className="space-y-2">
          {attendees.map(a => (
            <li key={a.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${a.is_internal ? 'bg-navy-500' : 'bg-amber-500'}`} />
                <span className="text-navy-800">{getAttendeeName(a)}</span>
                <span className="text-[10px] text-navy-400">{a.is_internal ? 'Internal' : 'External'}</span>
              </div>
              {canEdit && (
                <button
                  onClick={() => removeAttendee(a.id)}
                  className="text-[10px] text-red-400 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
