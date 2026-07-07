import prisma from '../lib/prisma.js'

export async function createApp(req, res) {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  try {
    const app = await prisma.app.create({
      data: {
        name,
        members: {
          create: { accountId: req.account.id, role: 'OWNER' },
        },
      },
      include: {
        members: {
          include: { account: { select: { id: true, name: true, email: true } } },
        },
      },
    })
    res.status(201).json(app)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create app' })
  }
}

export async function getMyApps(req, res) {
  try {
    const memberships = await prisma.appMember.findMany({
      where: { accountId: req.account.id, status: 'ACTIVE' },
      include: {
        app: {
          include: {
            members: {
              where: { status: 'ACTIVE' },
              include: { account: { select: { id: true, name: true, email: true } } },
            },
            _count: { select: { experiments: true } },
          },
        },
      },
    })

    const apps = memberships.map(m => ({ ...m.app, role: m.role }))
    res.json(apps)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch apps' })
  }
}

export async function getApp(req, res) {
  try {
    const membership = await prisma.appMember.findFirst({
      where: { appId: req.params.id, accountId: req.account.id, status: 'ACTIVE' },
    })
    if (!membership) return res.status(403).json({ error: 'Forbidden' })

    const app = await prisma.app.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { account: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { experiments: true } },
      },
    })

    if (!app) return res.status(404).json({ error: 'App not found' })
    res.json(app)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch app' })
  }
}

export async function getAppStats(req, res) {
  const appId = req.pulseApp.id

  try {
    // All four numbers computed by the database using COUNT — no rows transferred
    const [
      activeExperiments,
      completedExperiments,
      totalExperiments,
      totalResponses,
    ] = await prisma.$transaction([
      prisma.experiment.count({ where: { appId, status: 'ACTIVE' } }),
      prisma.experiment.count({ where: { appId, status: 'COMPLETED' } }),
      prisma.experiment.count({ where: { appId } }),
      prisma.feedbackResponse.count({ where: { user: { appId } } }),
    ])

    res.json({ activeExperiments, completedExperiments, totalExperiments, totalResponses })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
}

export async function regenerateApiKey(req, res) {
  try {
    const membership = await prisma.appMember.findFirst({
      where: { appId: req.params.id, accountId: req.account.id, role: 'OWNER', status: 'ACTIVE' },
    })
    if (!membership) return res.status(403).json({ error: 'Only owners can regenerate API keys' })

    const app = await prisma.app.update({
      where: { id: req.params.id },
      data: { apiKey: crypto.randomUUID() },
    })
    res.json({ apiKey: app.apiKey })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to regenerate API key' })
  }
}

export async function inviteCollaborator(req, res) {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email is required' })

  try {
    const membership = await prisma.appMember.findFirst({
      where: { appId: req.params.id, accountId: req.account.id, role: 'OWNER', status: 'ACTIVE' },
    })
    if (!membership) return res.status(403).json({ error: 'Only owners can invite collaborators' })

    const invitee = await prisma.account.findUnique({ where: { email } })
    if (!invitee) return res.status(404).json({ error: 'No account found with that email' })

    const existing = await prisma.appMember.findUnique({
      where: { accountId_appId: { accountId: invitee.id, appId: req.params.id } },
    })

    if (existing && existing.status === 'ACTIVE') {
      return res.status(409).json({ error: 'This person is already a member' })
    }

    let member
    if (existing) {
      member = await prisma.appMember.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', leftAt: null, role: 'COLLABORATOR' },
        include: { account: { select: { id: true, name: true, email: true } } },
      })
    } else {
      member = await prisma.appMember.create({
        data: { accountId: invitee.id, appId: req.params.id, role: 'COLLABORATOR' },
        include: { account: { select: { id: true, name: true, email: true } } },
      })
    }

    res.status(201).json(member)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to invite collaborator' })
  }
}

export async function removeCollaborator(req, res) {
  try {
    const requestorMembership = await prisma.appMember.findFirst({
      where: { appId: req.params.id, accountId: req.account.id, role: 'OWNER', status: 'ACTIVE' },
    })
    if (!requestorMembership) return res.status(403).json({ error: 'Only owners can remove collaborators' })

    const target = await prisma.appMember.findUnique({ where: { id: req.params.memberId } })
    if (!target || target.appId !== req.params.id) return res.status(404).json({ error: 'Member not found' })
    if (target.role === 'OWNER') return res.status(400).json({ error: 'Cannot remove the app owner' })

    const member = await prisma.appMember.update({
      where: { id: req.params.memberId },
      data: { status: 'REMOVED', leftAt: new Date() },
      include: { account: { select: { id: true, name: true, email: true } } },
    })
    res.json(member)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to remove collaborator' })
  }
}