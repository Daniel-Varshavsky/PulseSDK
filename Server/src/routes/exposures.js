import { Router } from 'express'
import { authenticateApiKey } from '../middleware/auth.js'
import { logExposure } from '../controllers/exposures.js'

const router = Router()

router.use(authenticateApiKey)

router.post('/', logExposure)

export default router
