import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

export async function authenticateJwt(req, res, next) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = header.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    const account = await prisma.account.findUnique({
      where: { id: payload.accountId },
    })

    if (!account) {
      return res.status(401).json({ error: 'Account not found' })
    }

    req.account = account
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}