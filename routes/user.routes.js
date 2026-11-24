import { Router } from 'express'
import { getUserById, getUsers, createUser, updateUser, deleteUser } from '../controllers/user.controller.js';

const router = Router()

router.get('/users', getUsers)
router.get('/user/:id', getUserById)
router.post('/user', createUser)
router.put('/user/:id', updateUser)
router.delete('/user/:id', deleteUser)

export default router
