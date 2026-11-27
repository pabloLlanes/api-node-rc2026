import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";

// READ (todas) - GET /api/orders
export const getOrders = async (req, res) => {
    try {
        // populate('products.product') -> dentro de cada elemento del array,
        // reemplaza el ObjectId de "product" por el producto real
        const orders = await Order.find()
            .populate('user', 'name email')
            .populate('products.product', 'name image')
        res.status(200).json({ message: "request ok!", orders })
    } catch (error) {
        res.status(500).json({ message: "Error al obtener las órdenes", error: error.message })
    }
}

// READ (una) - GET /api/order/:id
export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email')
            .populate('products.product', 'name image')

        if (!order) {
            return res.status(404).json({ message: "Orden no encontrada" })
        }

        res.status(200).json({ message: "request ok!", order })
    } catch (error) {
        res.status(400).json({ message: "Id inválido", error: error.message })
    }
}

// CREATE - POST /api/order
// body: {
//   "user": "<idUsuario>",
//   "products": [ { "product": "<idProducto>", "quantity": 2 }, ... ]
// }
export const createOrder = async (req, res) => {
    try {
        const { products, user } = req.body

        // ¿Quién compra?
        // - Con verifyToken en la ruta -> sale del token (req.user.id). Es lo SEGURO.
        // - Sin verifyToken            -> sale del body ("user"). Sirve para probar.
        const userId = req.user ? req.user.id : user

        // 1) Verificamos que el usuario exista
        const buyer = await User.findById(userId)
        if (!buyer) {
            return res.status(404).json({ message: "Usuario no encontrado" })
        }

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: "La orden debe tener al menos un producto" })
        }

        // 2) Validamos cada producto y armamos la lista con el precio de la DB
        //    (el precio NO se toma del body, para que nadie lo pueda falsear)
        const orderProducts = []
        let total = 0

        for (const item of products) {
            const quantity = item.quantity ?? 1

            const product = await Product.findById(item.product)
            if (!product) {
                return res.status(404).json({ message: `Producto ${item.product} no encontrado` })
            }
            if (product.stock < quantity) {
                return res.status(400).json({ message: `Stock insuficiente para "${product.name}" (quedan ${product.stock})` })
            }

            orderProducts.push({ product: product._id, quantity, price: product.price })
            total += product.price * quantity
        }

        // 3) Creamos la orden
        const newOrder = await Order.create({ user: userId, products: orderProducts, total })

        // 4) Descontamos el stock de cada producto
        //    $inc -> suma al campo; con número negativo, resta
        for (const item of orderProducts) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } })
        }

        res.status(201).json({ message: "OK order Created", newOrder })
    } catch (error) {
        res.status(400).json({ message: "Error al crear la orden", error: error.message })
    }
}

// UPDATE - PUT /api/order/:id   (solo se cambia el estado)
// body: { "status": "paid" }
export const updateOrder = async (req, res) => {
    try {
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true, runValidators: true } // runValidators: respeta el enum del schema
        )

        if (!updatedOrder) {
            return res.status(404).json({ message: "Orden no encontrada" })
        }

        res.status(200).json({ message: "OK order Updated", updatedOrder })
    } catch (error) {
        res.status(400).json({ message: "Error al actualizar la orden", error: error.message })
    }
}

// DELETE - DELETE /api/order/:id
export const deleteOrder = async (req, res) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id)

        if (!deletedOrder) {
            return res.status(404).json({ message: "Orden no encontrada" })
        }

        // Si la orden no estaba cancelada, devolvemos el stock a cada producto
        if (deletedOrder.status !== 'cancelled') {
            for (const item of deletedOrder.products) {
                await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } })
            }
        }

        res.status(200).json({ message: "OK order Deleted", deletedOrder })
    } catch (error) {
        res.status(400).json({ message: "Error al eliminar la orden", error: error.message })
    }
}
