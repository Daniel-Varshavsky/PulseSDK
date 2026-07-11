import prisma from '../lib/prisma.js'

export async function submitFeedback(req, res) {
  const { userId, variantId, type, value, comment, screenId, appVersion } = req.body
  const appId = req.pulseApp.id

  if (!userId || !type || value === undefined) {
    return res.status(400).json({ error: 'userId, type, and value are required' })
  }

  const validTypes = ['STAR_RATING', 'THUMBS', 'TEXT', 'MULTIPLE_CHOICE']
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` })
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, appId },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (variantId) {
      const variant = await prisma.variant.findFirst({
        where: { id: variantId, experiment: { appId } },
      })
      if (!variant) return res.status(404).json({ error: 'Variant not found' })

      if (type === 'MULTIPLE_CHOICE' && variant.choices) {
        const validIndex = typeof value === 'number' && value >= 0 && value < variant.choices.length
        if (!validIndex) {
          return res.status(400).json({ error: `value must be a valid choice index (0-${variant.choices.length - 1})` })
        }
      }
    }

    const existing = await prisma.feedbackResponse.findFirst({
      where: { userId, variantId: variantId ?? null, type },
    })

    let feedback
    if (existing) {
      feedback = await prisma.feedbackResponse.update({
        where: { id: existing.id },
        data: { value, comment: comment ?? null, screenId: screenId ?? null, appVersion: appVersion ?? null },
      })
    } else {
      feedback = await prisma.feedbackResponse.create({
        data: {
          userId,
          variantId: variantId ?? null,
          type,
          value,
          comment: comment ?? null,
          screenId: screenId ?? null,
          appVersion: appVersion ?? null,
        },
      })
    }

    await prisma.deviceToken.updateMany({
      where: { userId },
      data: { lastSeenAt: new Date() },
    })

    res.status(201).json(feedback)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to submit feedback' })
  }
}

export async function getFeedback(req, res) {
  const appId = req.pulseApp.id
  const {
    experimentId,
    variantId,
    appVersion,
    type,
    standalone,
    limit = 50,
    offset = 0,
  } = req.query

  try {
    const where = {
      user: { appId },
      // Type filter — applied server-side
      ...(type && { type }),
      // Variant filter
      ...(variantId && { variantId }),
      // App version filter
      ...(appVersion && { appVersion }),
      // Experiment filter — via variant relation
      ...(experimentId && { variant: { experimentId } }),
      // Standalone filter — no variantId
      ...(standalone === 'true' && { variantId: null }),
    }

    const [responses, total] = await prisma.$transaction([
      prisma.feedbackResponse.findMany({
        where,
        include: {
          variant: { select: { id: true, name: true, choices: true } },
          user: { select: { id: true, externalUserId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.feedbackResponse.count({ where }),
    ])

    res.json({ total, responses })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch feedback' })
  }
}