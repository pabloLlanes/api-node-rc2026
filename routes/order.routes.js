import { Router } from 'express'
import { getOrders, getOrderById, createOrder, updateOrder, deleteOrder } from '../controllers/order.controller.js'
import { verifyToken } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/orders', getOrders)

router.get('/order/:id', getOrderById)

router.post('/order', /* verifyToken, */ createOrder)

router.put('/order/:id', updateOrder)

router.delete('/order/:id', deleteOrder)

export default router
