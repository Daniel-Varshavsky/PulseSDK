import { Router } from 'express'
import { authenticateApiKey } from '../middleware/auth.js'
import {
  registerDevice,
  identifyUser,
  clearUser,
  refreshToken,
} from '../controllers/devices.js'

const router = Router()

router.use(authenticateApiKey)

router.post('/register', registerDevice)
router.post('/identify', identifyUser)
router.post('/clear', clearUser)
router.post('/refresh-token', refreshToken)

export default router