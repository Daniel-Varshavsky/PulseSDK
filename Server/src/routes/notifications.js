import { Router } from 'express'
import { authenticateApiKey } from '../middleware/auth.js'
import {
  sendNotification,
  getNotificationAudience,
} from '../controllers/notifications.js'

const router = Router()

router.use(authenticateApiKey)

router.post('/send', sendNotification)
router.get('/audience', getNotificationAudience)

export default router