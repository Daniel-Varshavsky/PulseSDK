import { Router } from 'express'
import { authenticateJwt } from '../middleware/authJwt.js'
import { authenticateApiKey } from '../middleware/auth.js'
import {
  createApp,
  getMyApps,
  getApp,
  getAppStats,
  regenerateApiKey,
  inviteCollaborator,
  removeCollaborator,
} from '../controllers/apps.js'

const router = Router()

// Specific named routes MUST come before /:id
router.post('/', authenticateJwt, createApp)
router.get('/my', authenticateJwt, getMyApps)
router.get('/me', authenticateApiKey, (req, res) => res.json(req.pulseApp))
router.get('/stats', authenticateApiKey, getAppStats)

// Parameterized routes after named ones
router.get('/:id', authenticateJwt, getApp)
router.post('/:id/regenerate-key', authenticateJwt, regenerateApiKey)
router.post('/:id/members', authenticateJwt, inviteCollaborator)
router.delete('/:id/members/:memberId', authenticateJwt, removeCollaborator)

export default router