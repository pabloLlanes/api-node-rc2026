import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
    // Relación: cada orden pertenece a UN usuario (el que compra)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Relación: una orden tiene MUCHOS productos.
    // Cada elemento guarda el producto, cuántas unidades se compraron
    // y el precio AL MOMENTO de la compra (si mañana cambia el precio, la orden no se altera)
    products: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
        price: { type: Number, required: true, min: 0 }
    }],
    // El total lo calcula el servidor (nunca se toma del body)
    total: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ['pending', 'paid', 'shipped', 'cancelled'], // solo acepta estos valores
        default: 'pending'
    }
}, { timestamps: true }) // agrega createdAt y updatedAt automáticamente

export const Order = mongoose.model('Order', orderSchema)
