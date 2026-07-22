import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Star, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Code, Pencil } from 'lucide-react'
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

function VariantRow({ v, i, showMetadata }) {
  const hasMetadata = v.metadata && typeof v.metadata === 'object' && Object.keys(v.metadata).length > 0
  const [localExpanded, setLocalExpanded] = useState(null)
  useEffect(() => { setLocalExpanded(null) }, [showMetadata])
  const expanded = localExpanded !== null ? localExpanded : showMetadata

  return (
    <>
      <tr className={hasMetadata ? 'cursor-pointer' : ''} style={{ borderTop: '1px solid var(--border)' }}
        onClick={() => hasMetadata && setLocalExpanded(prev => prev === null ? !showMetadata : !prev)}
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
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{v.exposureCount}</td>
        <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {v.responseCount}
          {v.responseRatePct != null && (
            <span className="ml-1" style={{ color: 'var(--text-tertiary)' }}>({v.responseRatePct}%)</span>
          )}
        </td>
        <td className="px-6 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{v.summaryValue}</td>
        <td className="px-6 py-3" style={{ color: 'var(--text-tertiary)' }}>
          {hasMetadata
            ? expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            : <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>—</span>}
        </td>
      </tr>
      {expanded && hasMetadata && (
        <tr style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
          <td colSpan={6} className="px-6 py-3">
            <div className="rounded-lg px-4 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Metadata</p>
              <div className="space-y-1.5">
                {Object.entries(v.metadata).map(([key, value]) => {
                  // The Portal's own editor only ever writes flat values, but nothing
                  // stops a direct API call from setting nested objects/arrays — render
                  // those as formatted JSON instead of the useless "[object Object]"
                  // String(value) would otherwise produce.
                  const isComplex = value !== null && typeof value === 'object'
                  return isComplex ? (
                    <div key={key} className="text-sm">
                      <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>{key}:</span>
                      <pre className="mt-1 rounded-md px-3 py-2 text-sm overflow-x-auto"
                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div key={key} className="flex items-baseline gap-1.5 text-sm">
                      <span className="font-mono shrink-0" style={{ color: 'var(--text-tertiary)' }}>{key}:</span>
                      <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{String(value)}</span>
                    </div>
                  )
                })}
              </div>
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

function ThumbsChart({ aggregates }) {
  const barA = cssVar('--chart-bar-a'), posB = cssVar('--chart-positive-b'), neg = cssVar('--chart-negative')
  // Every variant is shown, including ones with zero responses yet — matches
  // StarRatingChart, which already shows all variants rather than only ones
  // with data.
  const chartData = aggregates.map((a, i) => ({
    name: a.variantName,
    positive: a.thumbs.positivePct ?? 0,
    negative: a.thumbs.positivePct != null ? 100 - a.thumbs.positivePct : 0,
    total: a.thumbs.count,
    colorIndex: i,
  }))
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
              {d.total === 0 ? (
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No responses yet</span>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{d.positive}% positive</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{d.negative}% negative</span>
                  <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>({d.total} total)</span>
                </div>
              )}
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

function MultipleChoiceChart({ aggregates }) {
  const barA = cssVar('--chart-bar-a'), posB = cssVar('--chart-positive-b')
  // Every variant is shown, including ones with zero responses yet — matches
  // StarRatingChart, which already shows all variants rather than only ones
  // with data.
  const chartData = aggregates.map((a, vi) => ({
    variantName: a.variantName,
    counts: a.multipleChoice.choices.map(c => ({ choice: `Option ${c.index + 1}: ${c.choice}`, count: c.count, pct: c.pct })),
    total: a.multipleChoice.count,
    colorIndex: vi,
  }))
  if (chartData.length === 0) return null
  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Multiple Choice Responses by Variant</h3>
      <div className="space-y-6">
        {chartData.map(variant => (
          <div key={variant.variantName}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{variant.variantName}</p>
              {variant.total === 0 && (
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No responses yet</span>
              )}
            </div>
            <div className="space-y-2">
              {variant.counts.map(c => (
                <div key={c.choice}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{c.choice}</span>
                    <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{c.count} ({c.pct}%)</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${c.pct}%`, background: variant.colorIndex % 2 === 0 ? barA : posB }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// A value the simple field editor can represent: not an object/array.
function isFlatValue(value) {
  return value === null || typeof value !== 'object'
}

function toEditableVariant(v) {
  const metadataFields = v.metadata && typeof v.metadata === 'object'
    ? Object.entries(v.metadata).map(([key, value]) => ({ key, value: String(value) }))
    : []
  return {
    id: v.id,
    name: v.name,
    weight: v.weight,
    choices: v.choices && v.choices.length ? v.choices : ['Option 1', 'Option 2'],
    metadataMode: 'fields',
    metadataFields: metadataFields.length ? metadataFields : [{ key: '', value: '' }],
    metadataJson: '',
    metadataError: null,
  }
}

// Lets a developer tweak an existing experiment's name, per-variant weight,
// choices, and metadata (e.g. adding the "question" key the feedback dialog
// reads) after creation. Only allowed while the experiment is PAUSED -- the
// server enforces this too. Adding/removing variants isn't supported here,
// only editing the existing set, and feedbackType can't change either
// (changing it after variants/choices were configured for a specific type
// would leave stale, mismatched config).
function EditExperimentModal({ experiment, onClose, onSave }) {
  const [name, setName] = useState(experiment.name)
  const [variants, setVariants] = useState(experiment.variants.map(toEditableVariant))
  const [minAppVersion, setMinAppVersion] = useState(experiment.minAppVersion ?? '')
  const [minAppVersionError, setMinAppVersionError] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const isMultipleChoice = experiment.feedbackType === 'MULTIPLE_CHOICE'
  const totalWeight = variants.reduce((sum, v) => sum + Number(v.weight), 0)

  function updateVariant(index, field, value) {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
  }

  function updateVariantChoice(variantIndex, choiceIndex, value) {
    setVariants(prev => prev.map((v, i) => i !== variantIndex ? v : {
      ...v,
      choices: v.choices.map((c, ci) => ci === choiceIndex ? value : c),
    }))
  }

  function addVariantChoice(variantIndex) {
    setVariants(prev => prev.map((v, i) => i !== variantIndex ? v : {
      ...v,
      choices: [...v.choices, `Option ${v.choices.length + 1}`],
    }))
  }

  function removeVariantChoice(variantIndex, choiceIndex) {
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex || v.choices.length <= 2) return v
      return { ...v, choices: v.choices.filter((_, ci) => ci !== choiceIndex) }
    }))
  }

  function updateMetadataField(variantIndex, fieldIndex, prop, value) {
    setVariants(prev => prev.map((v, i) => i !== variantIndex ? v : {
      ...v,
      metadataFields: v.metadataFields.map((f, fi) => fi === fieldIndex ? { ...f, [prop]: value } : f),
    }))
  }

  function addMetadataField(variantIndex) {
    setVariants(prev => prev.map((v, i) => i !== variantIndex ? v : {
      ...v,
      metadataFields: [...v.metadataFields, { key: '', value: '' }],
    }))
  }

  function removeMetadataField(variantIndex, fieldIndex) {
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex || v.metadataFields.length <= 1) return v
      return { ...v, metadataFields: v.metadataFields.filter((_, fi) => fi !== fieldIndex) }
    }))
  }

  function toggleMetadataMode(variantIndex) {
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex) return v
      if (v.metadataMode === 'fields') {
        const obj = {}
        v.metadataFields.forEach(f => { if (f.key.trim()) obj[f.key.trim()] = f.value })
        return { ...v, metadataMode: 'json', metadataJson: JSON.stringify(obj, null, 2), metadataError: null }
      }
      try {
        const parsed = v.metadataJson.trim() ? JSON.parse(v.metadataJson) : {}
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return { ...v, metadataError: 'Metadata must be a flat JSON object, e.g. {"key": "value"}' }
        }
        const entries = Object.entries(parsed)
        if (entries.some(([, value]) => !isFlatValue(value))) {
          return { ...v, metadataError: "This JSON has nested objects/arrays the field editor can't show without losing data — simplify it first, or keep using JSON mode." }
        }
        const fields = entries.map(([key, value]) => ({ key, value: String(value) }))
        return { ...v, metadataMode: 'fields', metadataFields: fields.length ? fields : [{ key: '', value: '' }], metadataError: null }
      } catch {
        return { ...v, metadataError: 'Invalid JSON — fix it before switching back to fields' }
      }
    }))
  }

  function resolveVariantMetadata(v) {
    if (v.metadataMode === 'json') {
      if (!v.metadataJson.trim()) return null
      let parsed
      try {
        parsed = JSON.parse(v.metadataJson)
      } catch {
        throw new Error(`Invalid JSON metadata for ${v.name || 'a variant'}`)
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Metadata for ${v.name || 'a variant'} must be a flat JSON object`)
      }
      const entries = Object.entries(parsed)
      if (entries.some(([, value]) => !isFlatValue(value))) {
        throw new Error(`Metadata for ${v.name || 'a variant'} can't contain nested objects/arrays — values must be plain text, numbers, or booleans`)
      }
      const obj = {}
      entries.forEach(([key, value]) => { obj[key] = String(value) })
      return Object.keys(obj).length ? obj : null
    }
    const obj = {}
    v.metadataFields.forEach(f => { if (f.key.trim()) obj[f.key.trim()] = f.value })
    return Object.keys(obj).length ? obj : null
  }

  function validateMinAppVersion(value) {
    if (!value.trim()) return null
    return /^\d+(\.\d+)*$/.test(value.trim()) ? null : 'Must be dot-separated numbers, e.g. "2.1.0"'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (totalWeight !== 100) { setError('Variant weights must sum to 100'); return }
    if (isMultipleChoice && variants.some(v => v.choices.some(c => !c.trim()))) {
      setError('Choice options cannot be blank')
      return
    }
    const versionError = validateMinAppVersion(minAppVersion)
    if (versionError) { setMinAppVersionError(versionError); return }
    setLoading(true)
    try {
      const variantsWithMetadata = variants.map(v => ({ ...v, resolvedMetadata: resolveVariantMetadata(v) }))
      const res = await api.patch(`/experiments/${experiment.id}`, {
        name,
        minAppVersion: minAppVersion.trim() || null,
        variants: variantsWithMetadata.map(v => ({
          id: v.id,
          name: v.name,
          weight: Number(v.weight),
          ...(isMultipleChoice && { choices: v.choices }),
          metadata: v.resolvedMetadata,
        })),
      })
      onSave(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to update experiment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Edit Experiment</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Feedback type ({feedbackTypeLabels[experiment.feedbackType] ?? experiment.feedbackType}) can't be changed here, and variants can't be added or removed — only their name, traffic split, choices, and metadata.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ ...inputStyle, boxShadow: 'none' }}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
              onBlur={e => e.target.style.boxShadow = 'none'}
              required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Minimum App Version <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input value={minAppVersion}
              onChange={e => { setMinAppVersion(e.target.value); setMinAppVersionError(null) }}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ ...inputStyle, boxShadow: 'none' }}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
              onBlur={e => e.target.style.boxShadow = 'none'}
              placeholder="e.g. 2.1.0 — leave blank for no restriction" />
            {minAppVersionError && <p className="text-sm mt-1" style={{ color: '#EF4444' }}>{minAppVersionError}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Variants</label>
              <span className="text-sm font-medium" style={{ color: totalWeight === 100 ? 'var(--accent)' : '#EF4444' }}>
                Total: {totalWeight}%
              </span>
            </div>
            <div className="space-y-3">
              {variants.map((v, i) => (
                <div key={v.id} className="rounded-lg p-3" style={{ border: '1px solid var(--border)' }}>
                  <div className="flex gap-2 items-center">
                    <input value={v.name} onChange={e => updateVariant(i, 'name', e.target.value)}
                      className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={inputStyle}
                      onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
                      onBlur={e => e.target.style.boxShadow = 'none'}
                      placeholder="Variant name" required />
                    <input type="number" value={v.weight} onChange={e => updateVariant(i, 'weight', e.target.value)}
                      className="w-20 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={inputStyle}
                      onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
                      onBlur={e => e.target.style.boxShadow = 'none'}
                      min={0} max={100} required />
                    <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>%</span>
                  </div>

                  {isMultipleChoice && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Choice Options for {v.name || `Variant ${i + 1}`}
                      </label>
                      <div className="space-y-2">
                        {v.choices.map((c, ci) => (
                          <div key={ci} className="flex gap-2 items-center">
                            <input value={c} onChange={e => updateVariantChoice(i, ci, e.target.value)}
                              className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}
                              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
                              onBlur={e => e.target.style.boxShadow = 'none'}
                              placeholder={`Option ${ci + 1}`} required />
                            <button type="button" onClick={() => removeVariantChoice(i, ci)}
                              className="text-lg leading-none disabled:opacity-30"
                              style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                              disabled={v.choices.length <= 2}>×</button>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => addVariantChoice(i)}
                        className="mt-2 text-sm font-medium"
                        style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        + Add option
                      </button>
                    </div>
                  )}

                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Metadata for {v.name || `Variant ${i + 1}`}
                      </label>
                      <button type="button" onClick={() => toggleMetadataMode(i)}
                        title={v.metadataMode === 'fields' ? 'Switch to JSON' : 'Switch to fields'}
                        className="flex items-center justify-center rounded-md p-1"
                        style={{ color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border)', cursor: 'pointer' }}>
                        <Code size={14} />
                      </button>
                    </div>

                    {v.metadataMode === 'fields' ? (
                      <>
                        <div className="space-y-2">
                          {v.metadataFields.map((f, fi) => (
                            <div key={fi} className="flex gap-2 items-center">
                              <input value={f.key} onChange={e => updateMetadataField(i, fi, 'key', e.target.value)}
                                className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}
                                onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
                                onBlur={e => e.target.style.boxShadow = 'none'}
                                placeholder="key (e.g. question)" />
                              <input value={f.value} onChange={e => updateMetadataField(i, fi, 'value', e.target.value)}
                                className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}
                                onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
                                onBlur={e => e.target.style.boxShadow = 'none'}
                                placeholder="value" />
                              <button type="button" onClick={() => removeMetadataField(i, fi)}
                                className="text-lg leading-none disabled:opacity-30"
                                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                disabled={v.metadataFields.length <= 1}>×</button>
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={() => addMetadataField(i)}
                          className="mt-2 text-sm font-medium"
                          style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          + Add field
                        </button>
                      </>
                    ) : (
                      <textarea value={v.metadataJson} onChange={e => updateVariant(i, 'metadataJson', e.target.value)}
                        rows={5} spellCheck={false}
                        className="w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                        style={inputStyle}
                        onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
                        onBlur={e => e.target.style.boxShadow = 'none'}
                        placeholder={'{\n  "question": "..."\n}'} />
                    )}
                    {v.metadataError && <p className="text-sm mt-1" style={{ color: '#EF4444' }}>{v.metadataError}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg py-2 text-sm font-medium"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--accent-text-on)', border: 'none', cursor: 'pointer' }}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
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
  const [showVariantMetadata, setShowVariantMetadata] = useState(false)
  const [aggregates, setAggregates] = useState([])
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        // Aggregate is fetched alongside results rather than derived from the
        // structured-feedback table's `feedback` state: that state is capped
        // at 100 rows and can be narrowed by variantFilter, so deriving
        // thumbs/multiple-choice breakdowns from it undercounts (or entirely
        // hides) variants whenever there's more feedback than that or a
        // filter is active. The aggregate endpoint always reflects the whole
        // experiment, computed server-side, independent of any table filter.
        const [expRes, aggRes] = await Promise.all([
          api.get(`/experiments/${id}/results`),
          api.get(`/experiments/${id}/aggregate`),
        ])
        setExperiment(expRes.data)
        setAggregates(aggRes.data.aggregates)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [id])

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

  // Derived from the experiment's own feedbackType, not from whether any
  // response has actually come in yet — a freshly-created THUMBS experiment
  // should still show its chart/column (with a "no responses yet" state),
  // not disappear until its first response arrives.
  const hasStarRating = experiment?.feedbackType === 'STAR_RATING'
  const hasThumbs = experiment?.feedbackType === 'THUMBS'
  const hasMultipleChoice = experiment?.feedbackType === 'MULTIPLE_CHOICE'

  function getVariantSummaryLabel() {
    if (hasStarRating) return 'Avg. Rating'
    if (hasThumbs) return '% Positive'
    if (hasMultipleChoice) return 'Leading Option'
    return 'Summary'
  }

  function getVariantSummaryValue(v, result) {
    if (hasStarRating) return result?.avgRating != null ? result.avgRating.toFixed(2) : '—'
    const agg = aggregates.find(a => a.variantId === v.id)
    if (hasThumbs) {
      if (!agg || agg.thumbs.count === 0) return '—'
      return `${agg.thumbs.positivePct}%`
    }
    if (hasMultipleChoice) {
      if (!agg || agg.multipleChoice.count === 0) return '—'
      const leading = [...agg.multipleChoice.choices].sort((x, y) => y.count - x.count)[0]
      if (!leading) return '—'
      return `Option ${leading.index + 1}: ${leading.choice} (${leading.pct}%)`
    }
    return '—'
  }

  const variantTableData = (experiment?.variants ?? []).map(v => {
    const result = experiment?.results?.find(r => r.variantId === v.id)
    return {
      id: v.id,
      name: v.name,
      weight: v.weight,
      responseCount: result?.responseCount ?? 0,
      exposureCount: result?.exposureCount ?? 0,
      responseRatePct: result?.responseRatePct ?? null,
      summaryValue: getVariantSummaryValue(v, result),
      choices: v.choices,
      metadata: v.metadata,
    }
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
          {experiment.status === 'PAUSED' && (
            <button onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer' }}>
              <Pencil size={13} /> Edit
            </button>
          )}
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status:</span>
          <select value={experiment.status} onChange={e => handleStatusChange(e.target.value)} disabled={updatingStatus}
            className="rounded-lg px-3 py-1.5 text-sm focus:outline-none disabled:opacity-50"
            style={selectStyle}>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {showEditModal && (
        <EditExperimentModal
          experiment={experiment}
          onClose={() => setShowEditModal(false)}
          onSave={(updated) => setExperiment(prev => ({ ...prev, ...updated }))}
        />
      )}

      {/* Variants table */}
      <div className="rounded-xl" style={cardStyle}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Variants</h3>
          <button onClick={() => setShowVariantMetadata(prev => !prev)}
            className="text-sm font-medium" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {showVariantMetadata ? 'Hide all metadata' : 'Show all metadata'}
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
              {[{ key: 'name', label: 'Variant' }, { key: 'weight', label: 'Traffic' }, { key: 'exposureCount', label: 'Users Shown' }, { key: 'responseCount', label: 'Responses' }, { key: 'summaryValue', label: getVariantSummaryLabel() }].map(col => (
                <th key={col.key} className="px-6 py-3 cursor-pointer select-none"
                  onClick={() => toggleSort(setVariantSort, col.key)}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                  {col.label}<SortIcon column={col.key} sortConfig={variantSort} />
                </th>
              ))}
              <th className="px-6 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {sortedVariants.map((v, i) => <VariantRow key={v.id} v={v} i={i} showMetadata={showVariantMetadata} />)}
          </tbody>
        </table>
      </div>

      {hasStarRating && <StarRatingChart data={experiment.results ?? []} />}
      {hasThumbs && <ThumbsChart aggregates={aggregates} />}
      {hasMultipleChoice && <MultipleChoiceChart aggregates={aggregates} />}

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
    </div>
  )
}