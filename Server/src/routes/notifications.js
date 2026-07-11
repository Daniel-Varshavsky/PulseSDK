import { Router } from 'express'
import { authenticateApiKey } from '../middleware/auth.js'
import {
  sendNotification,
  getNotificationAudience,
  getNotificationStatus,
} from '../controllers/notifications.js'

const router = Router()

router.use(authenticateApiKey)

router.post('/send', sendNotification)
router.get('/audience', getNotificationAudience)
router.get('/status', getNotificationStatus)

export default router