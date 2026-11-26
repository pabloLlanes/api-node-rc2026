import { Router } from 'express'
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../controllers/product.controller.js'
import { verifyToken } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/products', getProducts)
router.get('/product/:id', getProductById)

// 🔒 ÚNICA RUTA PROTEGIDA (de ejemplo):
// primero se ejecuta verifyToken -> si el token es válido llama a next() -> recién ahí createProduct
router.post('/product', verifyToken, createProduct)

router.put('/product/:id', updateProduct)
router.delete('/product/:id', deleteProduct)

export default router
