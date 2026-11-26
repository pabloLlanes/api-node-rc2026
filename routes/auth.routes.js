import { Router } from 'express'
import { register, login } from '../controllers/auth.controller.js'

const router = Router()

router.post('/auth/register', register)
router.post('/auth/login', login) // devuelve el token

export default router
