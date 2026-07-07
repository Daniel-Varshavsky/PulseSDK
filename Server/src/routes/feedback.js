import { Router } from 'express'
import { authenticateApiKey } from '../middleware/auth.js'
import {
  submitFeedback,
  logExposure,
  getFeedback,
} from '../controllers/feedback.js'

const router = Router()

router.use(authenticateApiKey)

router.post('/', submitFeedback)
router.post('/exposure', logExposure)
router.get('/', getFeedback)

export default router