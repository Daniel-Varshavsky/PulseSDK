import { Router } from 'express'
import { authenticateApiKey } from '../middleware/auth.js'
import { submitCrash } from '../controllers/crashes.js'

const router = Router()

router.use(authenticateApiKey)

router.post('/', submitCrash)

export default router
