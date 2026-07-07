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

    // This device's token is keyed by fcmToken, not userId — a user can hold
    // several device tokens (multiple devices), and a device's token can move
    // to a different user (shared device, different account signs in).
    const deviceToken = await prisma.deviceToken.upsert({
      where: { fcmToken },
      update: { userId: user.id, lastSeenAt: new Date() },
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

      // Re-key this device's token to the identified user (handles the
      // shared-device case where a different account just signed in)
      const deviceToken = await tx.deviceToken.upsert({
        where: { fcmToken },
        update: { userId: user.id, lastSeenAt: new Date() },
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
      where: { fcmToken },
      update: { userId, lastSeenAt: new Date() },
      create: { userId, fcmToken },
    })

    res.json(deviceToken)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to refresh token' })
  }
}import prisma from '../lib/prisma.js'

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

    // This device's token is keyed by fcmToken, not userId — a user can hold
    // several device tokens (multiple devices), and a device's token can move
    // to a different user (shared device, different account signs in).
    const deviceToken = await prisma.deviceToken.upsert({
      where: { fcmToken },
      update: { userId: user.id, lastSeenAt: new Date() },
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

      // Re-key this device's token to the identified user (handles the
      // shared-device case where a different account just signed in)
      const deviceToken = await tx.deviceToken.upsert({
        where: { fcmToken },
        update: { userId: user.id, lastSeenAt: new Date() },
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
      where: { fcmToken },
      update: { userId, lastSeenAt: new Date() },
      create: { userId, fcmToken },
    })

    res.json(deviceToken)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to refresh token' })
  }
}