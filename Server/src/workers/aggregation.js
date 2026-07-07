import prisma from '../lib/prisma.js'

export async function runAggregation() {
  try {
    const experiments = await prisma.experiment.findMany({
      where: { status: 'ACTIVE' },
      include: { variants: true },
    })

    for (const experiment of experiments) {
      for (const variant of experiment.variants) {
        const responses = await prisma.feedbackResponse.findMany({
          where: {
            variantId: variant.id,
            type: 'STAR_RATING',
          },
          select: { value: true },
        })

        const count = responses.length
        const avgRating = count > 0
          ? responses.reduce((sum, r) => sum + Number(r.value), 0) / count
          : null

        await prisma.experimentResult.upsert({
          where: {
            experimentId_variantId: {
              experimentId: experiment.id,
              variantId: variant.id,
            },
          },
          update: { responseCount: count, avgRating, computedAt: new Date() },
          create: {
            experimentId: experiment.id,
            variantId: variant.id,
            responseCount: count,
            avgRating,
          },
        })
      }
    }

    console.log(`Aggregation complete for ${experiments.length} experiment(s)`)
  } catch (err) {
    console.error('Aggregation failed:', err)
  }
}