import prisma from '../lib/prisma.js'
import { satisfiesMinVersion } from '../lib/version.js'

// TEXT isn't offered here — standalone submitText() (general feedback) already
// covers free-text responses, tied to a variant when one is active.
const VALID_FEEDBACK_TYPES = ['STAR_RATING', 'THUMBS', 'MULTIPLE_CHOICE']

// "1", "1.2", "1.2.3" — plain dot-separated numeric segments only. Rejects
// anything with pre-release/build metadata suffixes up front, rather than
// silently treating them as equal at comparison time.
const VERSION_PATTERN = /^\d+(\.\d+)*$/

export async function createExperiment(req, res) {
  const { appId, name, variants, feedbackType = 'STAR_RATING', minAppVersion } = req.body

  if (!appId || !name || !variants) {
    return res.status(400).json({ error: 'appId, name, and variants are required' })
  }

  if (!Array.isArray(variants) || variants.reduce((sum, v) => sum + v.weight, 0) !== 100) {
    return res.status(400).json({ error: 'variants must be an array whose weights sum to 100' })
  }

  if (!VALID_FEEDBACK_TYPES.includes(feedbackType)) {
    return res.status(400).json({ error: `feedbackType must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}` })
  }

  if (minAppVersion != null && !VERSION_PATTERN.test(minAppVersion)) {
    return res.status(400).json({ error: 'minAppVersion must be dot-separated numbers, e.g. "2.1.0"' })
  }

  try {
    const membership = await prisma.appMember.findFirst({
      where: { appId, accountId: req.account.id, status: 'ACTIVE' },
    })
    if (!membership) return res.status(403).json({ error: 'You are not a member of this app' })

    const experiment = await prisma.experiment.create({
      data: {
        appId,
        createdById: req.account.id,
        name,
        feedbackType,
        minAppVersion: minAppVersion || null,
        variants: {
          create: variants.map(v => ({
            name: v.name,
            weight: v.weight,
            choices: v.choices ?? null,
            metadata: v.metadata ?? null,
          })),
        },
      },
      include: { variants: true },
    })

    res.status(201).json(experiment)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create experiment' })
  }
}

export async function getExperiments(req, res) {
  const appId = req.pulseApp.id
  const {
    status,
    name,
    limit,
    offset = 0,
    // Sent by the SDK on every fetch (the device's own versionName) so
    // version-targeted experiments can be filtered out before the client
    // ever sees them, rather than trusting it to self-exclude.
    appVersion,
    // Opt-in: used by the Dashboard's "Recent Experiments" table so an
    // older ACTIVE experiment isn't crowded out of the top N by a newer
    // PAUSED/COMPLETED one. Selection is status-first, but the returned
    // list is still ordered purely by recency (see below) — plain list
    // views (Experiments page, SDK) don't pass this and keep today's
    // straight recency ordering.
    prioritizeStatus,
  } = req.query

  try {
    const where = {
      appId,
      // Optional status filter — e.g. ?status=ACTIVE
      ...(status && { status }),
      // Optional name search — case-insensitive contains
      ...(name && { name: { contains: name, mode: 'insensitive' } }),
    }

    let experiments = await prisma.experiment.findMany({
      where,
      // No createdBy, no results/aggregate — this endpoint is shared by the
      // SDK (which only ever needs variants to assign one) and every Portal
      // list/dropdown view (which only ever needs id/name/variants to
      // render). Live results are computed on request by
      // getExperimentResults/getExperimentAggregate below, the only two
      // endpoints anything actually reads them from — computing a
      // groupBy + raw SQL aggregate here on every list/SDK fetch, for data
      // nothing consumes, was pure waste.
      include: { variants: true },
      orderBy: prioritizeStatus === 'true'
        // ExperimentStatus was declared ACTIVE, PAUSED, COMPLETED (see the
        // init migration) — Postgres enums compare by declaration order,
        // not alphabetically, so this sorts active experiments first
        // regardless of age, then paused, then completed, newest-first
        // within each tier.
        ? [{ status: 'asc' }, { createdAt: 'desc' }]
        : { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit) }),
      skip: parseInt(offset),
    })

    // Version comparison isn't expressible as a portable SQL WHERE clause
    // for arbitrary-length dot-separated segments, so it's filtered in JS
    // post-fetch — fine at this scale (one app's experiment list).
    experiments = experiments.filter(e => satisfiesMinVersion(appVersion, e.minAppVersion))

    // The ordering above picked the top N by status tier; the table itself
    // should still display purely by recency, not grouped by status, so
    // re-sort just the already-selected set here.
    if (prioritizeStatus === 'true') {
      experiments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }

    res.json(experiments)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch experiments' })
  }
}

export async function updateExperiment(req, res) {
  const { status, name, variants, minAppVersion } = req.body

  try {
    const existing = await prisma.experiment.findUnique({
      where: { id: req.params.id },
      include: { variants: true },
    })
    if (!existing) return res.status(404).json({ error: 'Experiment not found' })

    const membership = await prisma.appMember.findFirst({
      where: { appId: existing.appId, accountId: req.account.id, status: 'ACTIVE' },
    })
    if (!membership) return res.status(403).json({ error: 'Forbidden' })

    // Editing name/variants/targeting is only allowed while the experiment
    // is paused -- changing config on a live experiment would apply
    // inconsistently to users already assigned a variant this request.
    // Status changes (including un-pausing in this same request) are unaffected.
    const editingConfig = name !== undefined || variants !== undefined || minAppVersion !== undefined
    if (editingConfig && existing.status !== 'PAUSED') {
      return res.status(400).json({ error: 'Pause the experiment before editing its name, variants, or targeting' })
    }

    if (minAppVersion != null && !VERSION_PATTERN.test(minAppVersion)) {
      return res.status(400).json({ error: 'minAppVersion must be dot-separated numbers, e.g. "2.1.0"' })
    }

    if (variants !== undefined) {
      if (!Array.isArray(variants) || variants.reduce((sum, v) => sum + v.weight, 0) !== 100) {
        return res.status(400).json({ error: 'variants must be an array whose weights sum to 100' })
      }
      const existingIds = new Set(existing.variants.map(v => v.id))
      const incomingIds = variants.map(v => v.id)
      const sameSet = incomingIds.length === existingIds.size && incomingIds.every(id => existingIds.has(id))
      if (!sameSet) {
        return res.status(400).json({ error: "variants must match the experiment's existing variant IDs — adding or removing variants isn't supported" })
      }
    }

    const experiment = await prisma.$transaction(async (tx) => {
      if (variants !== undefined) {
        for (const v of variants) {
          await tx.variant.update({
            where: { id: v.id },
            data: {
              name: v.name,
              weight: v.weight,
              choices: v.choices ?? null,
              metadata: v.metadata ?? null,
            },
          })
        }
      }

      return tx.experiment.update({
        where: { id: req.params.id },
        data: {
          ...(status && { status }),
          ...(name !== undefined && { name }),
          ...(minAppVersion !== undefined && { minAppVersion: minAppVersion || null }),
        },
        include: { variants: true },
      })
    })

    res.json(experiment)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update experiment' })
  }
}

export async function getExperimentResults(req, res) {
  try {
    const experiment = await prisma.experiment.findUnique({
      where: { id: req.params.id },
      include: {
        variants: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!experiment) return res.status(404).json({ error: 'Experiment not found' })
    if (experiment.appId !== req.pulseApp.id) return res.status(403).json({ error: 'Forbidden' })

    const variantIds = experiment.variants.map(v => v.id)

    const [totalCounts, starRows, exposureCounts] = await Promise.all([
      prisma.feedbackResponse.groupBy({
        by: ['variantId'],
        where: { variantId: { in: variantIds } },
        _count: { id: true },
      }),
      prisma.$queryRaw`
        SELECT
          "variantId",
          COUNT(*)::int AS count,
          AVG((value::text)::numeric) AS avg
        FROM "FeedbackResponse"
        WHERE "variantId" = ANY(${variantIds})
          AND type = 'STAR_RATING'
        GROUP BY "variantId"
      `,
      prisma.exposure.groupBy({
        by: ['variantId'],
        where: { variantId: { in: variantIds } },
        _count: { id: true },
      }),
    ])

    const totalMap = Object.fromEntries(totalCounts.map(r => [r.variantId, r._count.id]))
    const starMap = Object.fromEntries(starRows.map(r => [r.variantId, { avg: r.avg }]))
    const exposureMap = Object.fromEntries(exposureCounts.map(r => [r.variantId, r._count.id]))

    const results = experiment.variants.map(variant => {
      const responseCount = totalMap[variant.id] ?? 0
      const exposureCount = exposureMap[variant.id] ?? 0
      return {
        variantId: variant.id,
        variantName: variant.name,
        responseCount,
        exposureCount,
        responseRatePct: exposureCount > 0 ? Math.round((responseCount / exposureCount) * 100) : null,
        avgRating: starMap[variant.id]?.avg != null
          ? parseFloat(Number(starMap[variant.id].avg).toFixed(2))
          : null,
      }
    })

    res.json({ ...experiment, results })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch results' })
  }
}

export async function getExperimentAggregate(req, res) {
  try {
    const experiment = await prisma.experiment.findUnique({
      where: { id: req.params.id },
      include: { variants: true },
    })

    if (!experiment) return res.status(404).json({ error: 'Experiment not found' })
    if (experiment.appId !== req.pulseApp.id) return res.status(403).json({ error: 'Forbidden' })

    const variantIds = experiment.variants.map(v => v.id)

    // Use database-level aggregation — COUNT and GROUP BY in SQL
    // value is Json so we use raw SQL to cast it for AVG on star ratings
    const [totalCounts, thumbsGroups, mcGroups, exposureCounts] = await prisma.$transaction([

      // Total responses per variant — COUNT(*) GROUP BY variantId
      prisma.feedbackResponse.groupBy({
        by: ['variantId'],
        where: { variantId: { in: variantIds } },
        _count: { id: true },
      }),

      // Thumbs: COUNT per variant per value (true/false)
      prisma.feedbackResponse.groupBy({
        by: ['variantId', 'value'],
        where: { variantId: { in: variantIds }, type: 'THUMBS' },
        _count: { id: true },
      }),

      // Multiple choice: COUNT per variant per value (choice index)
      prisma.feedbackResponse.groupBy({
        by: ['variantId', 'value'],
        where: { variantId: { in: variantIds }, type: 'MULTIPLE_CHOICE' },
        _count: { id: true },
      }),

      // Exposures per variant — the denominator for a real response rate
      prisma.exposure.groupBy({
        by: ['variantId'],
        where: { variantId: { in: variantIds } },
        _count: { id: true },
      }),
    ])

    // Star rating AVG uses raw SQL because value is Json — PostgreSQL casts it to numeric
    // This maps to: SELECT "variantId", COUNT(*), AVG((value::text)::numeric) GROUP BY "variantId"
    const starRows = await prisma.$queryRaw`
      SELECT
        "variantId",
        COUNT(*)::int AS count,
        AVG((value::text)::numeric) AS avg
      FROM "FeedbackResponse"
      WHERE "variantId" = ANY(${variantIds})
        AND type = 'STAR_RATING'
      GROUP BY "variantId"
    `

    // Build lookup maps from query results
    const totalMap = Object.fromEntries(totalCounts.map(r => [r.variantId, r._count.id]))
    const starMap = Object.fromEntries(starRows.map(r => [r.variantId, { count: r.count, avg: r.avg }]))

    // Thumbs: group by variantId then by value (true/false)
    const thumbsMap = {}
    thumbsGroups.forEach(r => {
      if (!thumbsMap[r.variantId]) thumbsMap[r.variantId] = { positive: 0, negative: 0 }
      if (r.value === true) thumbsMap[r.variantId].positive = r._count.id
      else thumbsMap[r.variantId].negative = r._count.id
    })

    // Multiple choice: group by variantId then by value (choice index)
    const mcMap = {}
    mcGroups.forEach(r => {
      if (!mcMap[r.variantId]) mcMap[r.variantId] = {}
      mcMap[r.variantId][Number(r.value)] = r._count.id
    })

    const exposureMap = Object.fromEntries(exposureCounts.map(r => [r.variantId, r._count.id]))

    // Assemble final response — no raw rows, just computed numbers
    const aggregates = experiment.variants.map(variant => {
      const total = totalMap[variant.id] ?? 0
      const exposureCount = exposureMap[variant.id] ?? 0
      const responseRatePct = exposureCount > 0 ? Math.round((total / exposureCount) * 100) : null

      const star = starMap[variant.id]
      const avgRating = star?.avg != null ? parseFloat(Number(star.avg).toFixed(2)) : null

      const thumbs = thumbsMap[variant.id] ?? { positive: 0, negative: 0 }
      const thumbsTotal = thumbs.positive + thumbs.negative
      const thumbsPositivePct = thumbsTotal > 0
        ? Math.round((thumbs.positive / thumbsTotal) * 100)
        : null

      const choiceCounts = mcMap[variant.id] ?? {}
      const mcTotal = Object.values(choiceCounts).reduce((a, b) => a + b, 0)
      const choiceBreakdown = (variant.choices ?? []).map((choice, i) => ({
        index: i,
        choice,
        count: choiceCounts[i] ?? 0,
        pct: mcTotal > 0 ? Math.round(((choiceCounts[i] ?? 0) / mcTotal) * 100) : 0,
      }))

      return {
        variantId: variant.id,
        variantName: variant.name,
        responseCount: total,
        exposureCount,
        responseRatePct,
        starRating: { avgRating, count: star?.count ?? 0 },
        thumbs: {
          positive: thumbs.positive,
          negative: thumbs.negative,
          positivePct: thumbsPositivePct,
          count: thumbsTotal,
        },
        multipleChoice: { choices: choiceBreakdown, count: mcTotal },
      }
    })

    res.json({ experimentId: experiment.id, experimentName: experiment.name, aggregates })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch aggregate' })
  }
}