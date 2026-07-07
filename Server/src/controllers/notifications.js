import prisma from '../lib/prisma.js'
import messaging from '../lib/firebase.js'

export async function sendNotification(req, res) {
  const { title, body, audience } = req.body
  const appId = req.pulseApp.id

  if (!title || !body || !audience) {
    return res.status(400).json({ error: 'title, body, and audience are required' })
  }

  const validAudiences = ['ALL', 'EXPERIMENT']
  if (!validAudiences.includes(audience.type)) {
    return res.status(400).json({ error: 'audience.type must be ALL or EXPERIMENT' })
  }

  if (audience.type === 'EXPERIMENT' && !audience.experimentId) {
    return res.status(400).json({ error: 'audience.experimentId is required when type is EXPERIMENT' })
  }

  try {
    let tokens = []

    if (audience.type === 'ALL') {
      const deviceTokens = await prisma.deviceToken.findMany({
        where: { user: { appId } },
        select: { fcmToken: true },
      })
      tokens = deviceTokens.map(d => d.fcmToken)
    } else if (audience.type === 'EXPERIMENT') {
      const responses = await prisma.feedbackResponse.findMany({
        where: {
          variant: { experimentId: audience.experimentId },
          user: { appId },
        },
        select: { user: { select: { deviceTokens: true } } },
        distinct: ['userId'],
      })
      tokens = responses
        .flatMap(r => r.user.deviceTokens)
        .map(d => d.fcmToken)
    }

    if (tokens.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: 'No devices to notify' })
    }

    if (!messaging) {
      return res.status(503).json({
        error: 'Push notifications not configured',
        tokenCount: tokens.length,
      })
    }

    const batchSize = 500
    let successCount = 0
    let failureCount = 0

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize)
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
      })
      successCount += response.successCount
      failureCount += response.failureCount

      response.responses.forEach(async (r, idx) => {
        if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
          await prisma.deviceToken.deleteMany({
            where: { fcmToken: batch[idx] },
          })
        }
      })
    }

    res.json({ success: true, sent: successCount, failed: failureCount })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to send notification' })
  }
}

export async function getNotificationAudience(req, res) {
  const appId = req.pulseApp.id
  const { type, experimentId } = req.query

  try {
    let count = 0

    if (type === 'ALL') {
      count = await prisma.deviceToken.count({
        where: { user: { appId } },
      })
    } else if (type === 'EXPERIMENT' && experimentId) {
      const responses = await prisma.feedbackResponse.findMany({
        where: {
          variant: { experimentId },
          user: { appId },
        },
        distinct: ['userId'],
      })
      count = responses.length
    }

    res.json({ count })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to get audience count' })
  }
}