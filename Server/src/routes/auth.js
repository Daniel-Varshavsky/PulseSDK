import { Router } from 'express'
import { register, login, googleLogin, getMe, changePassword } from '../controllers/auth.js'
import { authenticateJwt } from '../middleware/authJwt.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/google', googleLogin)
router.get('/me', authenticateJwt, getMe)
router.post('/change-password', authenticateJwt, changePassword)

export default router