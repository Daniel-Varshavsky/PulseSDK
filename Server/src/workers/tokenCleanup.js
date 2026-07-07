import prisma from '../lib/prisma.js'

const INACTIVITY_DAYS = 90

export async function runTokenCleanup() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - INACTIVITY_DAYS)

  try {
    const result = await prisma.deviceToken.deleteMany({
      where: {
        lastSeenAt: { lt: cutoff },
      },
    })

    if (result.count > 0) {
      console.log(`Token cleanup: removed ${result.count} inactive token(s)`)
    }
  } catch (err) {
    console.error('Token cleanup failed:', err)
  }
}