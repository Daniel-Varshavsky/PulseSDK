import prisma from '../lib/prisma.js'

export async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key']

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' })
  }

  try {
    const app = await prisma.app.findUnique({
      where: { apiKey },
    })

    if (!app) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    req.pulseApp = app
    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}