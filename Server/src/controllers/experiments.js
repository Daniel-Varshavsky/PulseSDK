import prisma from '../lib/prisma.js'

const VALID_FEEDBACK_TYPES = ['STAR_RATING', 'THUMBS', 'TEXT', 'MULTIPLE_CHOICE']

export async function createExperiment(req, res) {
  const { appId, name, trafficSplit, targetVersion, feedbackType = 'STAR_RATING' } = req.body

  if (!appId || !name || !trafficSplit) {
    return res.status(400).json({ error: 'appId, name, and trafficSplit are required' })
  }

  if (!Array.isArray(trafficSplit) || trafficSplit.reduce((sum, v) => sum + v.weight, 0) !== 100) {
    return res.status(400).json({ error: 'trafficSplit must be an array of variants whose weights sum to 100' })
  }

  if (!VALID_FEEDBACK_TYPES.includes(feedbackType)) {
    return res.status(400).json({ error: `feedbackType must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}` })
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
        trafficSplit,
        targetVersion,
        variants: {
          create: trafficSplit.map(v => ({
            name: v.name,
            weight: v.weight,
            choices: v.choices ?? null,
            metadata: v.metadata ?? null,
          })),
        },
      },
      include: {
        variants: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
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
  } = req.query

  try {
    const where = {
      appId,
      // Optional status filter — e.g. ?status=ACTIVE
      ...(status && { status }),
      // Optional name search — case-insensitive contains
      ...(name && { name: { contains: name, mode: 'insensitive' } }),
    }

    const experiments = await prisma.experiment.findMany({
      where,
      include: {
        variants: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit) }),
      skip: parseInt(offset),
    })

    // Compute live results using DB-level aggregation — no raw rows returned
    const allVariantIds = experiments.flatMap(e => e.variants.map(v => v.id))

    const [totalCounts, starRows] = await Promise.all([
      prisma.feedbackResponse.groupBy({
        by: ['variantId'],
        where: { variantId: { in: allVariantIds } },
        _count: { id: true },
      }),
      prisma.$queryRaw`
        SELECT
          "variantId",
          COUNT(*)::int AS count,
          AVG((value::text)::numeric) AS avg
        FROM "FeedbackResponse"
        WHERE "variantId" = ANY(${allVariantIds})
          AND type = 'STAR_RATING'
        GROUP BY "variantId"
      `,
    ])

    const totalMap = Object.fromEntries(totalCounts.map(r => [r.variantId, r._count.id]))
    const starMap = Object.fromEntries(starRows.map(r => [r.variantId, { count: r.count, avg: r.avg }]))

    const experimentsWithResults = experiments.map(exp => {
      const results = exp.variants.map(variant => ({
        variantId: variant.id,
        variantName: variant.name,
        responseCount: totalMap[variant.id] ?? 0,
        avgRating: starMap[variant.id]?.avg != null
          ? parseFloat(Number(starMap[variant.id].avg).toFixed(2))
          : null,
      }))
      return { ...exp, results }
    })

    res.json(experimentsWithResults)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch experiments' })
  }
}

export async function getExperiment(req, res) {
  try {
    const experiment = await prisma.experiment.findUnique({
      where: { id: req.params.id },
      include: { variants: true, results: true },
    })

    if (!experiment) return res.status(404).json({ error: 'Experiment not found' })
    if (experiment.appId !== req.pulseApp.id) return res.status(403).json({ error: 'Forbidden' })

    res.json(experiment)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch experiment' })
  }
}

export async function updateExperiment(req, res) {
  const { status, targetVersion } = req.body

  try {
    const existing = await prisma.experiment.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Experiment not found' })

    const membership = await prisma.appMember.findFirst({
      where: { appId: existing.appId, accountId: req.account.id, status: 'ACTIVE' },
    })
    if (!membership) return res.status(403).json({ error: 'Forbidden' })

    const experiment = await prisma.experiment.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(targetVersion !== undefined && { targetVersion }),
      },
      include: { variants: true },
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

    const [totalCounts, starRows] = await Promise.all([
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
    ])

    const totalMap = Object.fromEntries(totalCounts.map(r => [r.variantId, r._count.id]))
    const starMap = Object.fromEntries(starRows.map(r => [r.variantId, { avg: r.avg }]))

    const results = experiment.variants.map(variant => ({
      variantId: variant.id,
      variantName: variant.name,
      responseCount: totalMap[variant.id] ?? 0,
      avgRating: starMap[variant.id]?.avg != null
        ? parseFloat(Number(starMap[variant.id].avg).toFixed(2))
        : null,
    }))

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
    const [totalCounts, thumbsGroups, mcGroups] = await prisma.$transaction([

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

    // Assemble final response — no raw rows, just computed numbers
    const aggregates = experiment.variants.map(variant => {
      const total = totalMap[variant.id] ?? 0

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