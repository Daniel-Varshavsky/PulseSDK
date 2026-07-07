import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FlaskConical } from 'lucide-react'
import api from '../lib/api'

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

function CreateExperimentModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [variants, setVariants] = useState([
    { name: 'Variant A', weight: 50 },
    { name: 'Variant B', weight: 50 },
  ])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function updateVariant(index, field, value) {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
  }

  function addVariant() {
    setVariants(prev => [...prev, { name: `Variant ${String.fromCharCode(65 + prev.length)}`, weight: 0 }])
  }

  function removeVariant(index) {
    if (variants.length <= 2) return
    setVariants(prev => prev.filter((_, i) => i !== index))
  }

  const totalWeight = variants.reduce((sum, v) => sum + Number(v.weight), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (totalWeight !== 100) { setError('Variant weights must sum to 100'); return }
    setLoading(true)
    try {
      const activeApp = JSON.parse(localStorage.getItem('pulsesdk_active_app'))
      const res = await api.post('/experiments', {
        appId: activeApp.id,
        name,
        trafficSplit: variants.map(v => ({ name: v.name, weight: Number(v.weight) })),
      })
      onCreate(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to create experiment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl shadow-xl w-full max-w-md p-6"
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Variants</label>
              <span className="text-sm font-medium" style={{ color: totalWeight === 100 ? 'var(--accent)' : '#EF4444' }}>
                Total: {totalWeight}%
              </span>
            </div>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
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