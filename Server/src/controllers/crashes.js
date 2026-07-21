import prisma from '../lib/prisma.js'

export async function submitCrash(req, res) {
  const { userId, message, stackTrace, appVersion, occurredAt } = req.body
  const appId = req.pulseApp.id

  if (!userId || !message || !stackTrace || !occurredAt) {
    return res.status(400).json({ error: 'userId, message, stackTrace, and occurredAt are required' })
  }

  try {
    const user = await prisma.user.findFirst({ where: { id: userId, appId } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const crash = await prisma.crashReport.create({
      data: {
        userId,
        message,
        stackTrace,
        appVersion: appVersion ?? null,
        occurredAt: new Date(occurredAt),
      },
    })

    res.status(201).json(crash)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to submit crash report' })
  }
}
