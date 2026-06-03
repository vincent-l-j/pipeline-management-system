/**
 * AI Notetaker — Mode 1: Manual paste import.
 *
 * Flow:
 * 1. User pastes raw meeting notes (from AI notetaker, transcript, or hand-written)
 * 2. Clicks "Parse Notes" to send to the backend
 * 3. Backend uses Claude API (or mock parser if no API key) to extract structured fields
 * 4. Parsed results are shown for review
 * 5. User clicks "Apply to Meeting" to populate the meeting fields
 * 6. User reviews and saves on the meeting edit form
 *
 * Nothing is saved automatically — the user always reviews first.
 */

import { useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

export default function AINoteImporter({ onImport }) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [rawNotes, setRawNotes] = useState('')
  const [parsed, setParsed] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState(null)

  const canUse = user?.role === 'admin' || user?.role === 'assessor'

  if (!canUse) return null

  async function handleParse() {
    if (!rawNotes.trim()) return
    setParsing(true)
    setError(null)
    setParsed(null)

    try {
      const { data } = await api.post('/meetings/parse-notes', { raw_notes: rawNotes })
      setParsed(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse notes. Please try again.')
    }
    setParsing(false)
  }

  function handleApply() {
    if (parsed) {
      onImport(parsed)
      // Reset the importer
      setExpanded(false)
      setRawNotes('')
      setParsed(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-navy-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-sm font-bold">
            AI
          </span>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-navy-900">Import Meeting Notes</h3>
            <p className="text-xs text-navy-500">Paste raw notes and parse into structured fields</p>
          </div>
        </div>
        <span className="text-navy-400 text-lg">{expanded ? '-' : '+'}</span>
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-4 border-t border-navy-100 pt-4">
          {/* Step 1: Paste raw notes */}
          {!parsed && (
            <>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  Paste your meeting notes below
                </label>
                <p className="text-xs text-navy-400 mb-2">
                  Works with AI-generated summaries (e.g. from Otter, Fireflies, Copilot),
                  raw transcripts, or hand-written notes. The parser will extract the key information.
                </p>
                <textarea
                  rows={10}
                  value={rawNotes}
                  onChange={e => setRawNotes(e.target.value)}
                  placeholder={"Paste your meeting notes here...\n\nExample:\n\nSummary: We discussed the CRC bid timeline...\n\nKey Points:\n- Agreed on Q3 submission\n- Need co-investigator from UQ\n\nAction Items:\n- Sarah to draft budget by Friday\n- James to contact UQ faculty\n\nNext meeting: 2026-04-20"}
                  className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300 font-mono"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <button
                onClick={handleParse}
                disabled={parsing || !rawNotes.trim()}
                className="bg-amber-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {parsing ? 'Parsing...' : 'Parse Notes'}
              </button>
            </>
          )}

          {/* Step 2: Review parsed results */}
          {parsed && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <h4 className="text-sm font-semibold text-navy-900">
                  {parsed.ai_parsed ? 'AI-Parsed Results' : 'Parsed Results (Basic Parser)'}
                </h4>
              </div>

              {parsed.notice && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-4 py-2">
                  {parsed.notice}
                </div>
              )}

              {/* Summary */}
              <div className="bg-navy-50 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-navy-500 uppercase mb-1">Summary</h5>
                <p className="text-sm text-navy-800">{parsed.summary}</p>
              </div>

              {/* Key Points */}
              <div className="bg-navy-50 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-navy-500 uppercase mb-1">Key Points</h5>
                {parsed.key_points && parsed.key_points.length > 0 ? (
                  <ul className="list-disc list-inside text-sm text-navy-800 space-y-0.5">
                    {parsed.key_points.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-navy-400">None extracted</p>
                )}
              </div>

              {/* Action Items */}
              <div className="bg-navy-50 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-navy-500 uppercase mb-1">Action Items</h5>
                {parsed.action_items && parsed.action_items.length > 0 ? (
                  <ul className="list-disc list-inside text-sm text-navy-800 space-y-0.5">
                    {parsed.action_items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-navy-400">None extracted</p>
                )}
              </div>

              {/* Follow-up & Attendees */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-navy-50 rounded-lg p-4">
                  <h5 className="text-xs font-semibold text-navy-500 uppercase mb-1">Follow-up Date</h5>
                  <p className="text-sm text-navy-800">{parsed.follow_up_date || 'Not detected'}</p>
                </div>
                <div className="bg-navy-50 rounded-lg p-4">
                  <h5 className="text-xs font-semibold text-navy-500 uppercase mb-1">Attendees Detected</h5>
                  {parsed.attendees && parsed.attendees.length > 0 ? (
                    <p className="text-sm text-navy-800">{parsed.attendees.join(', ')}</p>
                  ) : (
                    <p className="text-sm text-navy-400">None detected</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleApply}
                  className="bg-navy-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
                >
                  Apply to Meeting
                </button>
                <button
                  onClick={() => setParsed(null)}
                  className="border border-navy-200 text-navy-600 px-5 py-2.5 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
                >
                  Re-parse
                </button>
                <button
                  onClick={() => { setParsed(null); setRawNotes(''); setExpanded(false) }}
                  className="text-sm text-navy-500 hover:text-navy-700 px-3 py-2.5"
                >
                  Discard
                </button>
              </div>

              <p className="text-xs text-navy-400">
                Clicking "Apply to Meeting" will populate the meeting edit form with these values.
                You can review and modify them before saving.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
