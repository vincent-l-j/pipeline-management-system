/**
 * Full-text search across all records.
 * Single search bar with categorised results (pitches, organisations,
 * contacts, meetings, assessments). Clickable results link to detail pages.
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import api from '../services/api'

const CATEGORY_CONFIG = {
  pitches: { label: 'Pitches', icon: '◈', basePath: '/pitches' },
  organisations: { label: 'Organisations', icon: '◎', basePath: '/organisations' },
  contacts: { label: 'Contacts', icon: '◉', basePath: '/contacts' },
  meetings: { label: 'Meetings', icon: '◆', basePath: '/meetings' },
  assessments: { label: 'Assessments', icon: '◇', basePath: '/assessments' },
}

const BADGE_COLORS = {
  pitch: 'bg-blue-100 text-blue-700',
  organisation: 'bg-teal-100 text-teal-700',
  contact: 'bg-purple-100 text-purple-700',
  meeting: 'bg-amber-100 text-amber-700',
  assessment: 'bg-green-100 text-green-700',
}

export default function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  const doSearch = useCallback(async (q) => {
    if (q.length < 2) {
      setResults(null)
      return
    }
    setSearching(true)
    setError(null)
    try {
      const { data } = await api.get('/search', { params: { q } })
      setResults(data)
    } catch (err) {
      setError('Search failed. Please try again.')
    }
    setSearching(false)
  }, [])

  // Debounce: search 400ms after user stops typing
  let debounceTimer = null
  function handleInput(value) {
    setQuery(value)
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => doSearch(value), 400)
  }

  function handleResultClick(item) {
    const config = CATEGORY_CONFIG[item.type + 's'] || {}
    navigate(`${config.basePath || ''}/${item.id}`)
  }

  const categories = results
    ? Object.entries(CATEGORY_CONFIG).filter(([key]) => results[key]?.length > 0)
    : []

  return (
    <Layout>
      <PageHeader title="Search" description="Find anything across the pipeline" />

      {/* Search bar */}
      <div className="max-w-2xl mb-8">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder="Search pitches, organisations, contacts, meetings, assessments..."
            autoFocus
            className="w-full border border-navy-200 rounded-xl px-4 py-3 pl-10 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300 shadow-sm"
          />
          <span className="absolute left-3.5 top-3.5 text-navy-400 text-sm">
            {searching ? '...' : '?'}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 max-w-2xl">
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="max-w-2xl">
          {results.total === 0 ? (
            <div className="bg-white rounded-xl border border-navy-100 p-8 text-center">
              <p className="text-navy-500">No results found for "{query}"</p>
              <p className="text-xs text-navy-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-navy-500">{results.total} result{results.total !== 1 ? 's' : ''} found</p>

              {categories.map(([catKey, catConfig]) => (
                <div key={catKey}>
                  <h3 className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <span>{catConfig.icon}</span>
                    {catConfig.label}
                    <span className="text-navy-300">({results[catKey].length})</span>
                  </h3>

                  <div className="bg-white rounded-xl border border-navy-100 divide-y divide-navy-50 overflow-hidden">
                    {results[catKey].map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleResultClick(item)}
                        className="w-full text-left px-4 py-3 hover:bg-navy-50/50 transition-colors flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy-900 truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-navy-500 truncate">{item.subtitle}</p>
                          )}
                        </div>
                        {item.badge && (
                          <span className={`shrink-0 ml-3 text-[10px] font-medium px-2 py-0.5 rounded-full ${BADGE_COLORS[item.type] || 'bg-gray-100'}`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!results && !searching && (
        <div className="max-w-2xl text-center py-12">
          <p className="text-navy-400 text-sm">Type at least 2 characters to search</p>
        </div>
      )}
    </Layout>
  )
}
