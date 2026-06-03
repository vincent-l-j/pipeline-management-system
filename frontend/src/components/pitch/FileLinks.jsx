/**
 * File path references for a pitch.
 * Stores paths to local files (pitch decks, proposals, etc.) — NOT the files themselves.
 */

import { useState, useEffect } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

export default function FileLinks({ pitchId }) {
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [newFile, setNewFile] = useState({ file_path: '', label: '', description: '' })

  const canEdit = user?.role === 'admin' || user?.role === 'assessor'

  useEffect(() => {
    loadFiles()
  }, [pitchId])

  function loadFiles() {
    api.get(`/pitches/${pitchId}/files`).then(({ data }) => setFiles(data))
  }

  async function addFile() {
    if (!newFile.file_path.trim()) return
    await api.post(`/pitches/${pitchId}/files`, newFile)
    setNewFile({ file_path: '', label: '', description: '' })
    setShowAdd(false)
    loadFiles()
  }

  const inputClass = "w-full border border-navy-200 rounded-lg px-3 py-1.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300"

  return (
    <div className="bg-white rounded-xl border border-navy-100 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide">Linked Files</h2>
        {canEdit && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-xs text-navy-600 hover:text-navy-900 font-medium"
          >
            {showAdd ? 'Cancel' : '+ Add File'}
          </button>
        )}
      </div>

      <p className="text-xs text-navy-400 mb-3">
        File path references — points to where files are stored locally, not uploaded to the database.
      </p>

      {/* Add file form */}
      {showAdd && (
        <div className="mb-4 p-3 bg-navy-50 rounded-lg space-y-2">
          <input
            type="text"
            value={newFile.file_path}
            onChange={e => setNewFile(prev => ({ ...prev, file_path: e.target.value }))}
            placeholder="File path (e.g. S:\Pitches\AgriTech\proposal.pdf)"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newFile.label}
              onChange={e => setNewFile(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Label (e.g. Pitch Deck)"
              className={inputClass}
            />
            <input
              type="text"
              value={newFile.description}
              onChange={e => setNewFile(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description (optional)"
              className={inputClass}
            />
          </div>
          <button
            onClick={addFile}
            disabled={!newFile.file_path.trim()}
            className="text-xs bg-navy-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            Add Reference
          </button>
        </div>
      )}

      {/* File list */}
      {files.length === 0 ? (
        <p className="text-sm text-navy-400">No files linked yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map(f => (
            <li key={f.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-navy-50/50">
              <span className="w-8 h-8 bg-navy-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-navy-500 shrink-0 mt-0.5">
                FILE
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-navy-900">
                  {f.label || 'Untitled'}
                </p>
                <p className="text-xs text-navy-500 font-mono truncate">{f.file_path}</p>
                {f.description && (
                  <p className="text-xs text-navy-400 mt-0.5">{f.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
