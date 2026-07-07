import prisma from '../lib/prisma.js'

export async function registerDevice(req, res) {
  const { fcmToken, externalUserId } = req.body
  const appId = req.pulseApp.id

  if (!fcmToken) {
    return res.status(400).json({ error: 'fcmToken is required' })
  }

  try {
    let user = await prisma.user.findUnique({
      where: {
        appId_externalUserId: {
          appId,
          externalUserId: externalUserId ?? null,
        },
      },
    })

    if (!user) {
      user = await prisma.user.create({
        data: { appId, externalUserId: externalUserId ?? null },
      })
    }

    await prisma.deviceToken.deleteMany({
      where: {
        fcmToken,
        userId: { not: user.id },
      },
    })

    const deviceToken = await prisma.deviceToken.upsert({
      where: { userId: user.id },
      update: { fcmToken, lastSeenAt: new Date() },
      create: { userId: user.id, fcmToken },
    })

    res.status(201).json({ userId: user.id, deviceToken })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to register device' })
  }
}

export async function identifyUser(req, res) {
  const { externalUserId, fcmToken } = req.body
  const appId = req.pulseApp.id

  if (!externalUserId || !fcmToken) {
    return res.status(400).json({ error: 'externalUserId and fcmToken are required' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find or create the identified user
      const user = await tx.user.upsert({
        where: {
          appId_externalUserId: { appId, externalUserId },
        },
        update: {},
        create: { appId, externalUserId },
      })

      // Remove this fcmToken from whoever currently holds it (if anyone else)
      await tx.deviceToken.deleteMany({
        where: {
          fcmToken,
          userId: { not: user.id },
        },
      })

      // Upsert this user's device token
      const deviceToken = await tx.deviceToken.upsert({
        where: { userId: user.id },
        update: { fcmToken, lastSeenAt: new Date() },
        create: { userId: user.id, fcmToken },
      })

      return { userId: user.id, deviceToken }
    })

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to identify user' })
  }
}

export async function clearUser(req, res) {
  const { fcmToken } = req.body

  if (!fcmToken) {
    return res.status(400).json({ error: 'fcmToken is required' })
  }

  try {
    await prisma.deviceToken.deleteMany({
      where: { fcmToken },
    })

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to clear user' })
  }
}

export async function refreshToken(req, res) {
  const { userId, fcmToken } = req.body

  if (!userId || !fcmToken) {
    return res.status(400).json({ error: 'userId and fcmToken are required' })
  }

  try {
    const deviceToken = await prisma.deviceToken.upsert({
      where: { userId },
      update: { fcmToken, lastSeenAt: new Date() },
      create: { userId, fcmToken },
    })

    res.json(deviceToken)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to refresh token' })
  }
}