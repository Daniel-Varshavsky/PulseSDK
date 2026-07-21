import prisma from '../lib/prisma.js'

// Idempotent by (userId, variantId) — the SDK only calls this once per
// variant per process, but a retried request (e.g. after a timeout where
// the first attempt actually succeeded) shouldn't double-count exposures.
export async function logExposure(req, res) {
  const { userId, variantId } = req.body
  const appId = req.pulseApp.id

  if (!userId || !variantId) {
    return res.status(400).json({ error: 'userId and variantId are required' })
  }

  try {
    const user = await prisma.user.findFirst({ where: { id: userId, appId } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const variant = await prisma.variant.findFirst({
      where: { id: variantId, experiment: { appId } },
    })
    if (!variant) return res.status(404).json({ error: 'Variant not found' })

    const exposure = await prisma.exposure.upsert({
      where: { userId_variantId: { userId, variantId } },
      update: {},
      create: { userId, variantId },
    })

    res.status(201).json(exposure)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to log exposure' })
  }
}
