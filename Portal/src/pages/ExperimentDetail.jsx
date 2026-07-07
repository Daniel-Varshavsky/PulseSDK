import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Star, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../lib/api'
import { cssVar } from '../lib/themes'

const statusStyle = {
  ACTIVE: { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' },
  PAUSED: { background: 'var(--status-paused-bg)', color: 'var(--status-paused-text)' },
  COMPLETED: { background: 'var(--status-completed-bg)', color: 'var(--status-completed-text)' },
}

const statusOptions = ['ACTIVE', 'PAUSED', 'COMPLETED']

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

const selectStyle = {
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
  if (type === 'THUMBS') {
    return value
      ? <ThumbsUp size={16} style={{ color: 'var(--accent)' }} />
      : <ThumbsDown size={16} style={{ color: 'var(--chart-negative)' }} />
  }
  if (type === 'MULTIPLE_CHOICE') {
    const index = Number(value)
    const choiceName = variant?.choices?.[index]
    return <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Option {index + 1}{choiceName ? `: ${choiceName}` : ''}</span>
  }
  return <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{JSON.stringify(value)}</span>
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
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{f.variant?.name ?? '—'}</td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{feedbackTypeLabels[f.type] ?? f.type}</td>
        <td className="px-6 py-3"><FeedbackValue type={f.type} value={f.value} variant={f.variant} /></td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{f.screenId ?? '—'}</td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{f.appVersion ?? '—'}</td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>{new Date(f.createdAt).toLocaleString()}</td>
        <td className="px-6 py-3" style={{ color: 'var(--text-tertiary)' }}>
          {hasComment
            ? isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            : <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>—</span>}
        </td>
      </tr>
      {isExpanded && hasComment && (
        <tr style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
          <td colSpan={8} className="px-6 py-3">
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

function ChartLegend({ items }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: item.color }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function StarRatingChart({ data }) {
  const chartData = data.map(r => ({ name: r.variantName, avgRating: r.avgRating ? parseFloat(r.avgRating.toFixed(2)) : 0 }))
  const barA = cssVar('--chart-bar-a'), barB = cssVar('--chart-bar-b')
  const grid = cssVar('--chart-grid'), axis = cssVar('--chart-axis')
  const border = cssVar('--border'), surface = cssVar('--bg-surface'), textPrimary = cssVar('--text-primary')
  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Avg. Star Rating by Variant</h3>
      <ChartLegend items={data.map((r, i) => ({ label: r.variantName, color: i % 2 === 0 ? barA : barB }))} />
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barSize={64}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} />
          <YAxis domain={[0,5]} ticks={[0,1,2,3,4,5]} interval={0} tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [v, 'Avg Rating']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${border}`, background: surface, color: textPrimary }}
            labelStyle={{ color: cssVar('--text-secondary') }} itemStyle={{ color: textPrimary }} />
          <Bar dataKey="avgRating" radius={[4,4,0,0]}>
            {chartData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? barA : barB} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ThumbsChart({ data, feedback }) {
  const barA = cssVar('--chart-bar-a'), posB = cssVar('--chart-positive-b'), neg = cssVar('--chart-negative')
  const chartData = data.map((r, i) => {
    const vf = feedback.filter(f => f.variantId === r.variantId && f.type === 'THUMBS')
    const total = vf.length
    const pos = vf.filter(f => f.value === true).length
    const posPct = total > 0 ? Math.round((pos / total) * 100) : 0
    return { name: r.variantName, positive: posPct, negative: 100 - posPct, total, colorIndex: i }
  }).filter(d => d.total > 0)
  if (chartData.length === 0) return null
  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Thumbs Response by Variant</h3>
      <ChartLegend items={[{ label: 'Positive', color: barA }, { label: 'Negative', color: neg }]} />
      <div className="space-y-4">
        {chartData.map(d => (
          <div key={d.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{d.positive}% positive</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{d.negative}% negative</span>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>({d.total} total)</span>
              </div>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
              {d.positive > 0 && <div className="h-full transition-all" style={{ width: `${d.positive}%`, background: d.colorIndex % 2 === 0 ? barA : posB }} />}
              {d.negative > 0 && <div className="h-full" style={{ width: `${d.negative}%`, background: neg }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MultipleChoiceChart({ variants, feedback }) {
  const barA = cssVar('--chart-bar-a'), posB = cssVar('--chart-positive-b')
  const chartData = variants.map((v, vi) => {
    const vf = feedback.filter(f => f.variantId === v.id && f.type === 'MULTIPLE_CHOICE')
    if (vf.length === 0) return null
    const choices = v.choices ?? []
    const counts = choices.map((choice, ci) => ({
      choice: `Option ${ci + 1}: ${choice}`,
      count: vf.filter(f => Number(f.value) === ci).length,
    }))
    return { variantName: v.name, counts, total: vf.length, colorIndex: vi }
  }).filter(Boolean)
  if (chartData.length === 0) return null
  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Multiple Choice Responses by Variant</h3>
      <div className="space-y-6">
        {chartData.map(variant => (
          <div key={variant.variantName}>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{variant.variantName}</p>
            <div className="space-y-2">
              {variant.counts.map(c => {
                const pct = variant.total > 0 ? Math.round((c.count / variant.total) * 100) : 0
                return (
                  <div key={c.choice}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{c.choice}</span>
                      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{c.count} ({pct}%)</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: variant.colorIndex % 2 === 0 ? barA : posB }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ExperimentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState(null)
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [search, setSearch] = useState('')
  const [variantFilter, setVariantFilter] = useState('')
  const [feedbackSort, setFeedbackSort] = useState({ key: 'createdAt', direction: 'desc' })
  const [variantSort, setVariantSort] = useState({ key: null, direction: 'asc' })
  const [showComments, setShowComments] = useState(true)
  const [textSearch, setTextSearch] = useState('')
  const [textVariantFilter, setTextVariantFilter] = useState('')
  const [textSort, setTextSort] = useState({ key: 'createdAt', direction: 'desc' })
  const [textFeedbackRaw, setTextFeedbackRaw] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const expRes = await api.get(`/experiments/${id}/results`)
        setExperiment(expRes.data)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [id])

  // Fetch text feedback separately with its own server-side variant filter
  useEffect(() => {
    async function loadText() {
      try {
        const params = new URLSearchParams()
        params.set('experimentId', id)
        params.set('type', 'TEXT')
        params.set('limit', '100')
        if (textVariantFilter) params.set('variantId', textVariantFilter)
        const res = await api.get(`/feedback?${params.toString()}`)
        setTextFeedbackRaw(res.data.responses)
      } catch (err) { console.error(err) }
    }
    if (!loading) loadText()
  }, [id, textVariantFilter, loading])

  // Fetch structured feedback — refetch when variant filter changes
  useEffect(() => {
    async function loadStructured() {
      try {
        const params = new URLSearchParams()
        params.set('experimentId', id)
        params.set('limit', '100')
        // Exclude TEXT — fetched separately
        // We fetch all non-text types; type filter applied client-side only for search UX
        if (variantFilter) params.set('variantId', variantFilter)
        const res = await api.get(`/feedback?${params.toString()}`)
        // Split text vs structured after receiving
        setFeedback(res.data.responses)
      } catch (err) { console.error(err) }
    }
    if (!loading) loadStructured()
  }, [id, variantFilter, loading])

  function toggleSort(setter, key) {
    setter(prev => prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
  }

  async function handleStatusChange(status) {
    setUpdatingStatus(true)
    try {
      const res = await api.patch(`/experiments/${id}`, { status })
      setExperiment(prev => ({ ...prev, status: res.data.status }))
    } catch (err) { console.error(err) }
    finally { setUpdatingStatus(false) }
  }

  const feedbackTypes = [...new Set(feedback.map(f => f.type))]
  const hasStarRating = feedbackTypes.includes('STAR_RATING')
  const hasThumbs = feedbackTypes.includes('THUMBS')
  const hasMultipleChoice = feedbackTypes.includes('MULTIPLE_CHOICE')

  function getVariantSummaryLabel() {
    if (hasStarRating) return 'Avg. Rating'
    if (hasThumbs) return '% Positive'
    if (hasMultipleChoice) return 'Leading Option'
    return 'Summary'
  }

  function getVariantSummaryValue(v, result) {
    if (hasStarRating) return result?.avgRating != null ? result.avgRating.toFixed(2) : '—'
    if (hasThumbs) {
      const thumbs = feedback.filter(f => f.variantId === v.id && f.type === 'THUMBS')
      if (thumbs.length === 0) return '—'
      return `${Math.round((thumbs.filter(f => f.value === true).length / thumbs.length) * 100)}%`
    }
    if (hasMultipleChoice) {
      const mc = feedback.filter(f => f.variantId === v.id && f.type === 'MULTIPLE_CHOICE')
      if (mc.length === 0) return '—'
      const counts = {}
      mc.forEach(f => { const k = Number(f.value); counts[k] = (counts[k] || 0) + 1 })
      const leadingEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      const leadingIndex = Number(leadingEntry?.[0])
      const leadingCount = leadingEntry?.[1] ?? 0
      const leadingPct = mc.length > 0 ? Math.round((leadingCount / mc.length) * 100) : 0
      const choiceName = v.choices?.[leadingIndex]
      return choiceName ? `Option ${leadingIndex + 1}: ${choiceName} (${leadingPct}%)` : `Option ${leadingIndex + 1} (${leadingPct}%)`
    }
    return '—'
  }

  const variantTableData = (experiment?.variants ?? []).map(v => {
    const result = experiment?.results?.find(r => r.variantId === v.id)
    return { id: v.id, name: v.name, weight: v.weight, responseCount: result?.responseCount ?? 0, summaryValue: getVariantSummaryValue(v, result), choices: v.choices }
  })
  const sortedVariants = useSortedData(variantTableData, variantSort)

  const structuredFeedback = useSortedData(
    feedback.filter(f => f.type !== 'TEXT').filter(f => {
      const sl = search.toLowerCase()
      return (!search || (f.user?.externalUserId ?? '').toLowerCase().includes(sl) || (f.screenId ?? '').toLowerCase().includes(sl) || (f.appVersion ?? '').toLowerCase().includes(sl))
        && (!variantFilter || f.variantId === variantFilter)
    }).map(f => ({ ...f, userLabel: f.user?.externalUserId ?? '', variantLabel: f.variant?.name ?? '', valueRaw: typeof f.value === 'number' ? f.value : JSON.stringify(f.value) })),
    feedbackSort.key === 'user' ? { key: 'userLabel', direction: feedbackSort.direction }
      : feedbackSort.key === 'variant' ? { key: 'variantLabel', direction: feedbackSort.direction }
      : feedbackSort.key === 'value' ? { key: 'valueRaw', direction: feedbackSort.direction }
      : feedbackSort
  )

  const textFeedback = useSortedData(
    feedback.filter(f => f.type === 'TEXT').filter(f => {
      const sl = textSearch.toLowerCase()
      return (!textSearch || (f.user?.externalUserId ?? '').toLowerCase().includes(sl) || (f.screenId ?? '').toLowerCase().includes(sl) || (typeof f.value === 'string' ? f.value : '').toLowerCase().includes(sl))
        && (!textVariantFilter || f.variantId === textVariantFilter)
    }).map(f => ({ ...f, userLabel: f.user?.externalUserId ?? '', valueStr: typeof f.value === 'string' ? f.value : JSON.stringify(f.value) })),
    textSort.key === 'user' ? { key: 'userLabel', direction: textSort.direction }
      : textSort.key === 'value' ? { key: 'valueStr', direction: textSort.direction }
      : textSort
  )

  if (loading) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>Loading...</div>
  if (!experiment) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>Experiment not found</div>

  const cardStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border)' }

  return (
    <div className="p-8 space-y-6" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/experiments')}
            className="transition-colors" style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{experiment.name}</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={statusStyle[experiment.status]}>
                {experiment.status}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Created by {experiment.createdBy?.name ?? 'Unknown'} · {new Date(experiment.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status:</span>
          <select value={experiment.status} onChange={e => handleStatusChange(e.target.value)} disabled={updatingStatus}
            className="rounded-lg px-3 py-1.5 text-sm focus:outline-none disabled:opacity-50"
            style={selectStyle}>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Variants table */}
      <div className="rounded-xl" style={cardStyle}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Variants</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
              {[{ key: 'name', label: 'Variant' }, { key: 'weight', label: 'Traffic' }, { key: 'responseCount', label: 'Responses' }, { key: 'summaryValue', label: getVariantSummaryLabel() }].map(col => (
                <th key={col.key} className="px-6 py-3 cursor-pointer select-none"
                  onClick={() => toggleSort(setVariantSort, col.key)}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                  {col.label}<SortIcon column={col.key} sortConfig={variantSort} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedVariants.map((v, i) => (
              <tr key={v.id} style={{ borderTop: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td className="px-6 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                      style={{ background: i % 2 === 0 ? cssVar('--chart-bar-a') : cssVar('--chart-bar-b') }} />
                    {v.name}
                  </div>
                </td>
                <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{v.weight}%</td>
                <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{v.responseCount}</td>
                <td className="px-6 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{v.summaryValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasStarRating && <StarRatingChart data={experiment.results ?? []} />}
      {hasThumbs && <ThumbsChart data={experiment.results ?? []} feedback={feedback} />}
      {hasMultipleChoice && <MultipleChoiceChart variants={experiment.variants ?? []} feedback={feedback} />}

      {/* Structured feedback */}
      <div className="rounded-xl" style={cardStyle}>
        <div className="px-6 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>Feedback Responses</h3>
          <button onClick={() => setShowComments(prev => !prev)}
            className="text-sm font-medium" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {showComments ? 'Hide all comments' : 'Show all comments'}
          </button>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by user, screen, version..."
            className="rounded-lg px-3 py-1.5 text-sm focus:outline-none w-56" style={inputStyle}
            onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
            onBlur={e => e.target.style.boxShadow = 'none'} />
          <select value={variantFilter} onChange={e => setVariantFilter(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={selectStyle}>
            <option value="">All variants</option>
            {experiment.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        {structuredFeedback.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
                {[{ key: 'user', label: 'User' }, { key: 'variant', label: 'Variant' }, { key: 'type', label: 'Type' }, { key: 'value', label: 'Value' }, { key: 'screenId', label: 'Screen' }, { key: 'appVersion', label: 'Version' }, { key: 'createdAt', label: 'Date' }].map(col => (
                  <th key={col.key} className="px-6 py-3 cursor-pointer select-none"
                    onClick={() => toggleSort(setFeedbackSort, col.key)}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                    {col.label}<SortIcon column={col.key} sortConfig={feedbackSort} />
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
            No structured feedback responses yet
          </div>
        )}
      </div>

      {/* Text feedback */}
      {textFeedback.length > 0 && (
        <div className="rounded-xl" style={cardStyle}>
          <div className="px-6 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex-1">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>General Text Feedback</h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Suggestions, ideas, and other open-ended responses</p>
            </div>
            <input value={textSearch} onChange={e => setTextSearch(e.target.value)}
              placeholder="Search by user or content..."
              className="rounded-lg px-3 py-1.5 text-sm focus:outline-none w-56" style={inputStyle}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
              onBlur={e => e.target.style.boxShadow = 'none'} />
            <select value={textVariantFilter} onChange={e => setTextVariantFilter(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={selectStyle}>
              <option value="">All variants</option>
              {experiment.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <select value={textSort.key + '_' + textSort.direction}
              onChange={e => { const [key, direction] = e.target.value.split('_'); setTextSort({ key, direction }) }}
              className="rounded-lg px-3 py-1.5 text-sm focus:outline-none" style={selectStyle}>
              <option value="createdAt_desc">Newest first</option>
              <option value="createdAt_asc">Oldest first</option>
              <option value="user_asc">User A–Z</option>
              <option value="user_desc">User Z–A</option>
            </select>
          </div>
          <div className="p-6 space-y-4">
            {textFeedback.map(f => (
              <div key={f.id} className="rounded-xl p-5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {typeof f.value === 'string' ? f.value : JSON.stringify(f.value)}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{f.user?.externalUserId ?? 'Anonymous'}</span>
                  {f.variant && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.variant.name}</span>}
                  {f.screenId && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.screenId}</span>}
                  {f.appVersion && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>v{f.appVersion}</span>}
                  <span className="text-sm ml-auto" style={{ color: 'var(--text-tertiary)' }}>{new Date(f.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}