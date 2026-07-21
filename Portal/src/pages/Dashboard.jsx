import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { FlaskConical, MessageSquare, TrendingUp, Clock } from 'lucide-react'
import api from '../lib/api'
import { cssVar } from '../lib/themes'
import { useTheme } from '../lib/ThemeContext'

function StatCard({ icon: Icon, label, value, light, dark }) {
  const { theme } = useTheme()
  const isDark = theme?.mode === 'dark'
  const { bg, color } = isDark ? dark : light
  return (
    <div className="rounded-xl p-5 flex items-start gap-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="p-2 rounded-lg" style={{ background: bg }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
      </div>
    </div>
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

function ExperimentRow({ experiment, onClick }) {
  const totalResponses = experiment.results?.reduce((sum, r) => sum + r.responseCount, 0) ?? 0
  const statusStyle = {
    ACTIVE: { background: 'var(--status-active-bg)', color: 'var(--status-active-text)' },
    PAUSED: { background: 'var(--status-paused-bg)', color: 'var(--status-paused-text)' },
    COMPLETED: { background: 'var(--status-completed-bg)', color: 'var(--status-completed-text)' },
  }

  // Determine summary from results — names the specific variant the number
  // belongs to (rather than blending all variants into one figure, or
  // picking whichever variant happens to be first regardless of whether it
  // has any responses) so the column is actually attributable.
  function getSummary() {
    if (!experiment.aggregates) return '—'
    const agg = experiment.aggregates

    const rated = agg.filter(a => a.starRating.count > 0)
    if (rated.length > 0) {
      const best = [...rated].sort((x, y) => (y.starRating.avgRating ?? 0) - (x.starRating.avgRating ?? 0))[0]
      return `${best.variantName}: ${best.starRating.avgRating.toFixed(2)} / 5`
    }

    const thumbed = agg.filter(a => a.thumbs.count > 0)
    if (thumbed.length > 0) {
      const best = [...thumbed].sort((x, y) => y.thumbs.positivePct - x.thumbs.positivePct)[0]
      return `${best.variantName}: ${best.thumbs.positivePct}% positive`
    }

    const choseSome = agg.filter(a => a.multipleChoice.count > 0)
    if (choseSome.length > 0) {
      const best = [...choseSome].sort((x, y) => y.multipleChoice.count - x.multipleChoice.count)[0]
      const leading = [...best.multipleChoice.choices].sort((x, y) => y.count - x.count)[0]
      if (leading) return `${best.variantName}: Option ${leading.index + 1}: ${leading.choice} (${leading.pct}%)`
    }

    return '—'
  }

  return (
    <tr onClick={onClick} className="cursor-pointer transition-colors"
      style={{ borderTop: '1px solid var(--border)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{experiment.name}</td>
      <td className="px-4 py-3">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={statusStyle[experiment.status]}>
          {experiment.status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{experiment.variants?.length ?? 0}</td>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalResponses}</td>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{getSummary()}</td>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {new Date(experiment.createdAt).toLocaleDateString()}
      </td>
    </tr>
  )
}

export default function Dashboard() {
  const [activeExperiments, setActiveExperiments] = useState([])
  const [recentExperiments, setRecentExperiments] = useState([])
  const [stats, setStats] = useState({ activeExperiments: 0, completedExperiments: 0, totalExperiments: 0, totalResponses: 0 })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        // Two targeted requests instead of one unfiltered list fetched and
        // then sliced/filtered client-side: the server already supports
        // status + limit, so ask it for exactly the 5-active-for-charts and
        // 5-most-recent-for-the-table sets directly.
        const [activeRes, recentRes, statsRes] = await Promise.all([
          api.get('/experiments?status=ACTIVE&limit=5'),
          api.get('/experiments?limit=5'),
          api.get('/apps/stats'),
        ])

        setStats(statsRes.data)

        // Fetch aggregates only for the active experiments shown in charts
        const aggregates = await Promise.all(
          activeRes.data.map(e =>
            api.get(`/experiments/${e.id}/aggregate`)
              .then(r => ({ id: e.id, data: r.data.aggregates }))
              .catch(() => ({ id: e.id, data: [] }))
          )
        )
        const aggMap = Object.fromEntries(aggregates.map(a => [a.id, a.data]))

        setActiveExperiments(activeRes.data.map(e => ({ ...e, aggregates: aggMap[e.id] ?? null })))
        setRecentExperiments(recentRes.data.map(e => ({ ...e, aggregates: aggMap[e.id] ?? null })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  // Build chart data from server-computed aggregates. For experiments with
  // any star rating data, show every variant (defaulting to 0 for ones with
  // no ratings yet) — matches ExperimentDetail's chart, which does the same.
  const starChartData = activeExperiments.flatMap(exp => {
    const aggs = exp.aggregates ?? []
    if (!aggs.some(a => a.starRating.count > 0)) return []
    return aggs.map(a => ({
      name: `${exp.name} — ${a.variantName}`,
      avgRating: a.starRating.avgRating != null ? parseFloat(a.starRating.avgRating.toFixed(2)) : 0,
    }))
  })

  const thumbsChartData = activeExperiments.flatMap(exp => {
    const aggs = exp.aggregates ?? []
    if (!aggs.some(a => a.thumbs.count > 0)) return []
    return aggs.map((a, i) => ({
      name: `${exp.name} — ${a.variantName}`,
      positive: a.thumbs.positivePct ?? 0,
      negative: a.thumbs.positivePct != null ? 100 - a.thumbs.positivePct : 0,
      total: a.thumbs.count,
      colorIndex: i,
    }))
  })

  const multipleChoiceChartData = activeExperiments.flatMap(exp => {
    const aggs = exp.aggregates ?? []
    if (!aggs.some(a => a.multipleChoice.count > 0)) return []
    return aggs.map((a, vi) => ({
      experimentName: exp.name,
      variantName: a.variantName,
      counts: a.multipleChoice.choices,
      total: a.multipleChoice.count,
      colorIndex: vi,
    }))
  })

  const cBarA = () => cssVar('--chart-bar-a')
  const cBarB = () => cssVar('--chart-bar-b')
  const cGrid = () => cssVar('--chart-grid')
  const cAxis = () => cssVar('--chart-axis')
  const cNeg = () => cssVar('--chart-negative')
  const cPosB = () => cssVar('--chart-positive-b')
  const cBorder = () => cssVar('--border')
  const cSurface = () => cssVar('--bg-surface')
  const cText = () => cssVar('--text-primary')
  const cSubtle = () => cssVar('--bg-subtle')

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>Loading...</div>
  )

  return (
    <div className="p-8 space-y-8" style={{ background: 'var(--bg-base)' }}>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Overview of your active experiments and feedback</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={FlaskConical} label="Active Experiments" value={stats.activeExperiments}
          light={{ bg: '#F0FDFA', color: '#0D9488' }} dark={{ bg: '#134E4A', color: '#5EEAD4' }} />
        <StatCard icon={MessageSquare} label="Total Responses" value={stats.totalResponses}
          light={{ bg: '#EFF6FF', color: '#2563EB' }} dark={{ bg: '#1E3A5F', color: '#93C5FD' }} />
        <StatCard icon={TrendingUp} label="Completed" value={stats.completedExperiments}
          light={{ bg: '#F5F3FF', color: '#7C3AED' }} dark={{ bg: '#2D1F50', color: '#C4B5FD' }} />
        <StatCard icon={Clock} label="Total Experiments" value={stats.totalExperiments}
          light={{ bg: '#FFFBEB', color: '#D97706' }} dark={{ bg: '#3D2C00', color: '#FCD34D' }} />
      </div>

      {/* Star rating chart */}
      {starChartData.length > 0 && (
        <div className="rounded-xl p-6" style={{ background: cSurface(), border: `1px solid ${cBorder()}` }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Avg. Star Rating by Variant</h3>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Active only · up to 5 shown</span>
          </div>
          <ChartLegend items={[{ label: 'Variant A', color: cBarA() }, { label: 'Variant B', color: cBarB() }]} />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={starChartData} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke={cGrid()} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: cAxis() }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,5]} ticks={[0,1,2,3,4,5]} interval={0} tick={{ fontSize: 11, fill: cAxis() }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [v, 'Avg Rating']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${cBorder()}`, background: cSurface(), color: cText() }}
                labelStyle={{ color: cssVar('--text-secondary') }} itemStyle={{ color: cText() }} />
              <Bar dataKey="avgRating" radius={[4,4,0,0]}>
                {starChartData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? cBarA() : cBarB()} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Thumbs chart */}
      {thumbsChartData.length > 0 && (
        <div className="rounded-xl p-6" style={{ background: cSurface(), border: `1px solid ${cBorder()}` }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Thumbs Response by Variant</h3>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Active only · up to 5 shown</span>
          </div>
          <ChartLegend items={[{ label: 'Positive', color: cBarA() }, { label: 'Negative', color: cNeg() }]} />
          <div className="space-y-4">
            {thumbsChartData.map(d => (
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
                <div className="flex h-4 rounded-full overflow-hidden" style={{ background: cSubtle() }}>
                  {d.positive > 0 && <div className="h-full" style={{ width: `${d.positive}%`, background: d.colorIndex % 2 === 0 ? cBarA() : cPosB() }} />}
                  {d.negative > 0 && <div className="h-full" style={{ width: `${d.negative}%`, background: cNeg() }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multiple choice chart */}
      {multipleChoiceChartData.length > 0 && (
        <div className="rounded-xl p-6" style={{ background: cSurface(), border: `1px solid ${cBorder()}` }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Multiple Choice Responses by Variant</h3>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Active only · up to 5 shown</span>
          </div>
          <div className="space-y-6">
            {multipleChoiceChartData.map(variant => (
              <div key={`${variant.experimentName}-${variant.variantName}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {variant.experimentName} — {variant.variantName}
                  </p>
                  {variant.total === 0 && (
                    <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No responses yet</span>
                  )}
                </div>
                <div className="space-y-2">
                  {variant.counts.map(c => (
                    <div key={c.index}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Option {c.index + 1}: {c.choice}</span>
                        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{c.count} ({c.pct}%)</span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ background: cSubtle() }}>
                        <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: variant.colorIndex % 2 === 0 ? cBarA() : cPosB() }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experiments table */}
      <div className="rounded-xl" style={{ background: cSurface(), border: `1px solid ${cBorder()}` }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${cBorder()}` }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Recent Experiments
            <span className="font-normal ml-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              ({recentExperiments.length} of {stats.totalExperiments})
            </span>
          </h3>
          <button onClick={() => navigate('/experiments')}
            className="text-sm font-medium" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            View all →
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Variants</th>
              <th className="px-4 py-3">Responses</th>
              <th className="px-4 py-3">Performance</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {recentExperiments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  No experiments yet
                </td>
              </tr>
            ) : (
              recentExperiments.map(exp => (
                <ExperimentRow key={exp.id} experiment={exp} onClick={() => navigate(`/experiments/${exp.id}`)} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}