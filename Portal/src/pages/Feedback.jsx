import { useEffect, useState, useMemo } from 'react'
import { Star, ThumbsUp, ThumbsDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import api from '../lib/api'

const feedbackTypeLabels = {
  STAR_RATING: 'Star Rating',
  THUMBS: 'Thumbs',
  TEXT: 'Text',
  MULTIPLE_CHOICE: 'Multiple Choice',
}

const inputStyle = {
  border: '1px solid var(--border)',
  background: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
}

function SortIcon({ column, sortConfig }) {
  if (sortConfig.key !== column) return <ArrowUpDown size={13} className="ml-1 inline" style={{ color: 'var(--text-tertiary)' }} />
  return sortConfig.direction === 'asc'
    ? <ArrowUp size={13} className="ml-1 inline" style={{ color: 'var(--accent)' }} />
    : <ArrowDown size={13} className="ml-1 inline" style={{ color: 'var(--accent)' }} />
}

function FeedbackValue({ type, value, variant }) {
  if (type === 'STAR_RATING') {
    const rating = Number(value)
    return (
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(i => (
          <Star key={i} size={14} className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
        ))}
        <span className="text-xs ml-1" style={{ color: 'var(--text-tertiary)' }}>{rating}/5</span>
      </div>
    )
  }
  if (type === 'THUMBS') return value
    ? <ThumbsUp size={16} style={{ color: 'var(--accent)' }} />
    : <ThumbsDown size={16} style={{ color: 'var(--chart-negative)' }} />
  if (type === 'MULTIPLE_CHOICE') {
    const index = Number(value)
    const choiceName = variant?.choices?.[index]
    return <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Option {index + 1}{choiceName ? `: ${choiceName}` : ''}</span>
  }
  return <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{JSON.stringify(value)}</span>
}

function useSortedData(data, config) {
  return useMemo(() => {
    if (!config.key) return data
    return [...data].sort((a, b) => {
      let aVal = a[config.key], bVal = b[config.key]
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return config.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return config.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [data, config])
}

function FeedbackRow({ f, showComments }) {
  const hasComment = !!f.comment
  const [localExpanded, setLocalExpanded] = useState(null)
  useEffect(() => { setLocalExpanded(null) }, [showComments])
  const isExpanded = localExpanded !== null ? localExpanded : showComments

  return (
    <>
      <tr className={hasComment ? 'cursor-pointer' : ''} style={{ borderTop: '1px solid var(--border)' }}
        onClick={() => hasComment && setLocalExpanded(prev => prev === null ? !showComments : !prev)}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{f.user?.externalUserId ?? 'Anonymous'}</td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{f.experimentName ?? '—'}</td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{f.variant?.name ?? '—'}</td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{feedbackTypeLabels[f.type] ?? f.type}</td>
        <td className="px-6 py-3"><FeedbackValue type={f.type} value={f.value} variant={f.variant} /></td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{f.screenId ?? '—'}</td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{f.appVersion ?? '—'}</td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>{new Date(f.createdAt).toLocaleString()}</td>
        <td className="px-6 py-3" style={{ color: 'var(--text-tertiary)' }}>
          {hasComment
            ? isExpanded ? <ArrowUp size={14} /> : <ArrowDown size={14} />
            : <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>—</span>}
        </td>
      </tr>
      {isExpanded && hasComment && (
        <tr style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
          <td colSpan={9} className="px-6 py-3">
            <div className="rounded-lg px-4 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Comment</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{f.comment}</p>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function FilterBar({ experiments, experimentFilter, setExperimentFilter, variantFilter, setVariantFilter, search, setSearch, typeFilter, setTypeFilter, showComments, setShowComments, label }) {
  const selectedExp = experiments.find(e => e.id === experimentFilter)
  const variants = selectedExp?.variants ?? []

  return (
    <div className="px-6 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{label}</h3>
      {showComments !== undefined && (
        <button onClick={() => setShowComments(prev => !prev)}
          className="text-sm font-medium" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
          {showComments ? 'Hide all comments' : 'Show all comments'}
        </button>
      )}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by user, screen, version..."
        className="rounded-lg px-3 py-1.5 text-sm focus:outline-none w-52" style={inputStyle}
        onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
        onBlur={e => e.target.style.boxShadow = 'none'} />
      {typeFilter !== undefined && (
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={inputStyle}>
          <option value="">All types</option>
          <option value="STAR_RATING">Star Rating</option>
          <option value="THUMBS">Thumbs</option>
          <option value="MULTIPLE_CHOICE">Multiple Choice</option>
        </select>
      )}
      <select value={experimentFilter} onChange={e => { setExperimentFilter(e.target.value); setVariantFilter('') }}
        className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={inputStyle}>
        <option value="">All experiments</option>
        {experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      {experimentFilter && (
        <select value={variantFilter} onChange={e => setVariantFilter(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={inputStyle}>
          <option value="">All variants</option>
          {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      )}
    </div>
  )
}

export default function Feedback() {
  const [feedback, setFeedback] = useState([])
  const [experiments, setExperiments] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Structured feedback filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [experimentFilter, setExperimentFilter] = useState('')
  const [variantFilter, setVariantFilter] = useState('')
  const [sort, setSort] = useState({ key: 'createdAt', direction: 'desc' })
  const [showComments, setShowComments] = useState(true)

  // General text feedback — always standalone (no variant), fetched
  // independently of the Structured Responses filters below so those
  // selects can never restrict what shows up here.
  const [generalFeedback, setGeneralFeedback] = useState([])
  const [textSearch, setTextSearch] = useState('')
  const [textSort, setTextSort] = useState({ key: 'createdAt', direction: 'desc' })

  useEffect(() => {
    async function load() {
      try {
        const expRes = await api.get('/experiments')
        const exps = expRes.data
        setExperiments(exps)

        // Fetch total count only — detailed data fetched on demand via applyFilters
        const countRes = await api.get('/feedback?limit=1')
        setTotal(countRes.data.total)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // Fetch structured feedback whenever its filters change — all filtering done server-side
  useEffect(() => {
    async function applyFilters() {
      try {
        const params = new URLSearchParams()
        params.set('limit', '100')
        if (typeFilter) params.set('type', typeFilter)
        if (experimentFilter) params.set('experimentId', experimentFilter)
        if (variantFilter) params.set('variantId', variantFilter)

        const fbRes = await api.get(`/feedback?${params.toString()}`)
        // experimentName/experimentId come straight from the response's
        // nested variant.experiment (added server-side) — no need to also
        // cross-reference the separately-fetched experiments list here.
        const enriched = fbRes.data.responses.map(f => ({
          ...f,
          experimentName: f.variant?.experiment?.name ?? null,
          experimentId: f.variant?.experiment?.id ?? null,
        }))
        setFeedback(enriched)
      } catch (err) { console.error(err) }
    }
    if (!loading) applyFilters()
  }, [typeFilter, experimentFilter, variantFilter, loading])

  // Fetch general text feedback once — no filters to react to besides load
  useEffect(() => {
    async function loadGeneral() {
      try {
        const params = new URLSearchParams()
        params.set('type', 'TEXT')
        params.set('standalone', 'true')
        params.set('limit', '100')
        const res = await api.get(`/feedback?${params.toString()}`)
        setGeneralFeedback(res.data.responses)
      } catch (err) { console.error(err) }
    }
    if (!loading) loadGeneral()
  }, [loading])

  function toggleSort(key) {
    setSort(prev => prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' })
  }

  // Structured feedback filtering
  // Server already filtered by type/experiment/variant — only apply search client-side
  const filteredStructured = feedback.filter(f => {
    if (f.type === 'TEXT') return false
    const sl = search.toLowerCase()
    return !search ||
      (f.user?.externalUserId ?? '').toLowerCase().includes(sl) ||
      (f.screenId ?? '').toLowerCase().includes(sl) ||
      (f.appVersion ?? '').toLowerCase().includes(sl)
  })

  const structuredFeedback = useSortedData(
    filteredStructured.map(f => ({
      ...f,
      userLabel: f.user?.externalUserId ?? '',
      variantLabel: f.variant?.name ?? '',
      valueRaw: typeof f.value === 'number' ? f.value : JSON.stringify(f.value),
    })),
    sort.key === 'user' ? { key: 'userLabel', direction: sort.direction }
      : sort.key === 'variant' ? { key: 'variantLabel', direction: sort.direction }
      : sort.key === 'value' ? { key: 'valueRaw', direction: sort.direction }
      : sort
  )

  // General feedback is fetched pre-filtered to standalone TEXT responses —
  // only search needs to be applied client-side.
  const filteredGeneral = generalFeedback.filter(f => {
    const sl = textSearch.toLowerCase()
    return !textSearch ||
      (f.user?.externalUserId ?? '').toLowerCase().includes(sl) ||
      (f.screenId ?? '').toLowerCase().includes(sl) ||
      (typeof f.value === 'string' ? f.value : '').toLowerCase().includes(sl)
  })

  const sortedGeneral = useSortedData(
    filteredGeneral.map(f => ({
      ...f,
      userLabel: f.user?.externalUserId ?? '',
      valueStr: typeof f.value === 'string' ? f.value : JSON.stringify(f.value),
    })),
    textSort.key === 'user' ? { key: 'userLabel', direction: textSort.direction }
      : textSort.key === 'value' ? { key: 'valueStr', direction: textSort.direction }
      : textSort
  )

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>Loading...</div>
  )

  const cardStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border)' }

  return (
    <div className="p-8 space-y-6" style={{ background: 'var(--bg-base)' }}>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Feedback</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{total} total responses across all experiments</p>
      </div>

      {/* Structured feedback */}
      <div className="rounded-xl" style={cardStyle}>
        <FilterBar
          label="Structured Responses"
          experiments={experiments}
          experimentFilter={experimentFilter}
          setExperimentFilter={setExperimentFilter}
          variantFilter={variantFilter}
          setVariantFilter={setVariantFilter}
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          showComments={showComments}
          setShowComments={setShowComments}
        />
        {structuredFeedback.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide"
                style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
                {[
                  { key: 'user', label: 'User' },
                  { key: 'experiment', label: 'Experiment' },
                  { key: 'variant', label: 'Variant' },
                  { key: 'type', label: 'Type' },
                  { key: 'value', label: 'Value' },
                  { key: 'screenId', label: 'Screen' },
                  { key: 'appVersion', label: 'Version' },
                  { key: 'createdAt', label: 'Date' },
                ].map(col => (
                  <th key={col.key} className="px-6 py-3 cursor-pointer select-none"
                    onClick={() => toggleSort(col.key)}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                    {col.label}<SortIcon column={col.key} sortConfig={sort} />
                  </th>
                ))}
                <th className="px-6 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {structuredFeedback.map(f => <FeedbackRow key={f.id} f={f} showComments={showComments} />)}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No structured feedback responses match your filters
          </div>
        )}
      </div>

      {/* General text feedback — never tied to an experiment, so there's
          nothing here to filter by besides search and sort. The individual
          cards below get an accent treatment to stand out as the most
          direct, unprompted signal on this page. */}
      <div className="rounded-xl" style={cardStyle}>
        <div className="px-6 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex-1">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>General Text Feedback</h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Suggestions, ideas, and other open-ended responses</p>
          </div>
          <input value={textSearch} onChange={e => setTextSearch(e.target.value)}
            placeholder="Search by user or content..."
            className="rounded-lg px-3 py-1.5 text-sm focus:outline-none w-52" style={inputStyle}
            onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
            onBlur={e => e.target.style.boxShadow = 'none'} />
          <select value={textSort.key + '_' + textSort.direction}
            onChange={e => { const [key, direction] = e.target.value.split('_'); setTextSort({ key, direction }) }}
            className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={inputStyle}>
            <option value="createdAt_desc">Newest first</option>
            <option value="createdAt_asc">Oldest first</option>
            <option value="user_asc">User A–Z</option>
            <option value="user_desc">User Z–A</option>
          </select>
        </div>

        {sortedGeneral.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No text feedback matches your filters
          </div>
        ) : (
          <div className="p-6 space-y-3">
            {sortedGeneral.map(f => (
              <div key={f.id} className="rounded-xl p-5"
                style={{ background: 'var(--accent-subtle)', border: '2px solid var(--accent-border)' }}>
                <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
                  {f.valueStr}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3"
                  style={{ borderTop: '1px solid var(--accent-border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--accent-text)' }}>
                    {f.user?.externalUserId ?? 'Anonymous'}
                  </span>
                  {f.screenId && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.screenId}</span>}
                  {f.appVersion && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>v{f.appVersion}</span>}
                  <span className="text-sm ml-auto" style={{ color: 'var(--accent-text)' }}>
                    {new Date(f.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}