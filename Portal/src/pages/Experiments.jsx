import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FlaskConical, Code } from 'lucide-react'
import api, { getActiveApp } from '../lib/api'

const statusStyle = {
  ACTIVE: { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' },
  PAUSED: { background: 'var(--status-paused-bg)', color: 'var(--status-paused-text)' },
  COMPLETED: { background: 'var(--status-completed-bg)', color: 'var(--status-completed-text)' },
}

const inputStyle = {
  border: '1px solid var(--border)',
  background: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
}

// TEXT isn't offered — general feedback in the app already covers free-text
// responses, tied to a variant when one is active.
const feedbackTypeOptions = [
  { value: 'STAR_RATING', label: 'Star Rating' },
  { value: 'THUMBS', label: 'Thumbs Up/Down' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
]

function CreateExperimentModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [feedbackType, setFeedbackType] = useState('STAR_RATING')
  const [variants, setVariants] = useState([
    { name: 'Variant A', weight: 50, choices: ['Option 1', 'Option 2'], metadataMode: 'fields', metadataFields: [{ key: '', value: '' }], metadataJson: '', metadataError: null },
    { name: 'Variant B', weight: 50, choices: ['Option 1', 'Option 2'], metadataMode: 'fields', metadataFields: [{ key: '', value: '' }], metadataJson: '', metadataError: null },
  ])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function updateVariant(index, field, value) {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
  }

  function addVariant() {
    setVariants(prev => [...prev, {
      name: `Variant ${String.fromCharCode(65 + prev.length)}`,
      weight: 0,
      choices: ['Option 1', 'Option 2'],
      metadataMode: 'fields',
      metadataFields: [{ key: '', value: '' }],
      metadataJson: '',
      metadataError: null,
    }])
  }

  function removeVariant(index) {
    if (variants.length <= 2) return
    setVariants(prev => prev.filter((_, i) => i !== index))
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

  // A value the simple field editor can represent: not an object/array.
  // JSON mode intentionally allows more (nested objects, arrays, numbers,
  // booleans) than the field editor can show — that's fine as long as we
  // never silently mangle it converting between the two.
  function isFlatValue(value) {
    return value === null || typeof value !== 'object'
  }

  // Toggles a variant's metadata editor between structured key/value fields
  // and raw JSON, converting whatever's currently there to the other shape.
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

  // Resolves a variant's metadata (from whichever mode it's in) into a flat
  // {key: value} object of strings, or null if empty. Throws with a
  // human-readable message on invalid input so handleSubmit can show it.
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

  const totalWeight = variants.reduce((sum, v) => sum + Number(v.weight), 0)
  const isMultipleChoice = feedbackType === 'MULTIPLE_CHOICE'

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const activeApp = getActiveApp()
    if (!activeApp) { setError('Select or create an app before creating an experiment'); return }
    if (totalWeight !== 100) { setError('Variant weights must sum to 100'); return }
    if (isMultipleChoice && variants.some(v => v.choices.some(c => !c.trim()))) {
      setError('Choice options cannot be blank')
      return
    }
    setLoading(true)
    try {
      const variantsWithMetadata = variants.map(v => ({ ...v, resolvedMetadata: resolveVariantMetadata(v) }))
      const res = await api.post('/experiments', {
        appId: activeApp.id,
        name,
        feedbackType,
        variants: variantsWithMetadata.map(v => ({
          name: v.name,
          weight: Number(v.weight),
          ...(isMultipleChoice && { choices: v.choices }),
          metadata: v.resolvedMetadata,
        })),
      })
      onCreate(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to create experiment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>New Experiment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ ...inputStyle, boxShadow: 'none' }}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
              onBlur={e => e.target.style.boxShadow = 'none'}
              placeholder="e.g. Homepage Banner Test" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Feedback Type</label>
            <select value={feedbackType} onChange={e => setFeedbackType(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}>
              {feedbackTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
              How the app collects feedback for this experiment.
            </p>
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
                <div key={i} className="rounded-lg p-3" style={{ border: '1px solid var(--border)' }}>
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
                    <button type="button" onClick={() => removeVariant(i)}
                      className="text-lg leading-none disabled:opacity-30"
                      style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                      disabled={variants.length <= 2}>×</button>
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
                                placeholder="key (e.g. itemLimit)" />
                              <input value={f.value} onChange={e => updateMetadataField(i, fi, 'value', e.target.value)}
                                className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}
                                onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
                                onBlur={e => e.target.style.boxShadow = 'none'}
                                placeholder="value (e.g. 25)" />
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
                        placeholder={'{\n  "itemLimit": "25"\n}'} />
                    )}
                    {v.metadataError && <p className="text-sm mt-1" style={{ color: '#EF4444' }}>{v.metadataError}</p>}
                    <p className="text-sm mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                      Optional. Arbitrary data for your app to read via this variant's metadata — the SDK doesn't interpret it.
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addVariant}
              className="mt-2 text-sm font-medium"
              style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
              + Add variant
            </button>
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
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Experiments() {
  const [experiments, setExperiments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState({ key: 'createdAt', direction: 'desc' })
  const navigate = useNavigate()

  useEffect(() => {
    // Debounce search so we don't fire a request on every keystroke
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (statusFilter) params.set('status', statusFilter)
        if (search) params.set('name', search)
        const res = await api.get(`/experiments?${params.toString()}`)
        setExperiments(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [statusFilter, search])

  function handleCreate(experiment) {
    setExperiments(prev => [experiment, ...prev])
  }

  function toggleSort(key) {
    setSort(prev => prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' })
  }

  const filtered = experiments
    .slice() // server already filtered by name and status — just sort
    .sort((a, b) => {
      let aVal = a[sort.key], bVal = b[sort.key]
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
      return 0
    })

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>Loading...</div>
  )

  return (
    <div className="p-8 space-y-6" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Experiments</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Manage your A/B tests</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-text-on)', border: 'none', cursor: 'pointer' }}>
          <Plus size={16} />
          New Experiment
        </button>
      </div>

      {experiments.length === 0 ? (
        <div className="rounded-xl p-12 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <FlaskConical size={32} className="mx-auto mb-3" style={{ color: 'var(--border)' }} />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No experiments yet</p>
          <button onClick={() => setShowModal(true)}
            className="mt-3 text-sm font-medium"
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Create your first experiment →
          </button>
        </div>
      ) : (
        <div className="rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search experiments..."
              className="rounded-lg px-3 py-1.5 text-sm focus:outline-none w-56"
              style={inputStyle}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
              onBlur={e => e.target.style.boxShadow = 'none'} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              style={inputStyle}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <span className="text-sm ml-auto" style={{ color: 'var(--text-tertiary)' }}>
              {filtered.length} experiment{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide"
                style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
                {[
                  { key: 'name', label: 'Name' },
                  { key: 'status', label: 'Status' },
                  { key: 'variants', label: 'Variants' },
                  { key: 'trafficSplit', label: 'Traffic Split' },
                  { key: 'createdAt', label: 'Created' },
                ].map(col => (
                  <th key={col.key} className="px-6 py-3 cursor-pointer select-none"
                    onClick={() => toggleSort(col.key)}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    No experiments match your search
                  </td>
                </tr>
              ) : (
                filtered.map(exp => (
                  <tr key={exp.id} onClick={() => navigate(`/experiments/${exp.id}`)}
                    className="cursor-pointer transition-colors"
                    style={{ borderTop: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{exp.name}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={statusStyle[exp.status]}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{exp.variants?.length ?? 0}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {exp.variants?.map(v => `${v.name} ${v.weight}%`).join(' / ')}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(exp.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CreateExperimentModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}