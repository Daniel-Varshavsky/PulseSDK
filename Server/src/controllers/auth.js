import prisma from '../lib/prisma.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

function generateToken(account) {
  return jwt.sign(
    { accountId: account.id, email: account.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export async function register(req, res) {
  const { email, name, password } = req.body

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  try {
    const existing = await prisma.account.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const account = await prisma.account.create({
      data: { email, name, passwordHash },
    })

    const token = generateToken(account)
    res.status(201).json({
      token,
      account: { id: account.id, email: account.email, name: account.name },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to register' })
  }
}

export async function login(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  try {
    const account = await prisma.account.findUnique({ where: { email } })

    if (!account || !account.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, account.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = generateToken(account)
    res.json({
      token,
      account: { id: account.id, email: account.email, name: account.name },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to login' })
  }
}

export async function googleLogin(req, res) {
  const { idToken, userInfo } = req.body

  if (!idToken && !userInfo) {
    return res.status(400).json({ error: 'idToken or userInfo is required' })
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google login not configured' })
  }

  try {
    let googleId, email, name

    if (userInfo) {
      // Portal flow: access token already exchanged for userInfo on the frontend
      googleId = userInfo.sub
      email = userInfo.email
      name = userInfo.name
    } else {
      // Direct ID token flow (future Android use)
      const { OAuth2Client } = await import('google-auth-library')
      const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      const payload = ticket.getPayload()
      googleId = payload.sub
      email = payload.email
      name = payload.name
    }

    let account = await prisma.account.findUnique({ where: { googleId } })

    if (!account) {
      const existing = await prisma.account.findUnique({ where: { email } })
      if (existing) {
        account = await prisma.account.update({
          where: { email },
          data: { googleId },
        })
      } else {
        account = await prisma.account.create({
          data: { email, name, googleId },
        })
      }
    }

    const token = generateToken(account)
    res.json({
      token,
      account: { id: account.id, email: account.email, name: account.name },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to authenticate with Google' })
  }
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body
 
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' })
  }
 
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' })
  }
 
  try {
    if (!req.account.passwordHash) {
      return res.status(400).json({ error: 'This account uses Google login and has no password' })
    }
 
    const valid = await bcrypt.compare(currentPassword, req.account.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
 
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.account.update({
      where: { id: req.account.id },
      data: { passwordHash },
    })
 
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to change password' })
  }
}

export async function getMe(req, res) {
  res.json({
    id: req.account.id,
    email: req.account.email,
    name: req.account.name,
  })
}