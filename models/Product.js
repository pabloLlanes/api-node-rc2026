import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    image: { type: String, default: '' },
    // Relación inversa: cada producto sabe quién es su dueño (el usuario que lo creó)
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true }) // agrega createdAt y updatedAt automáticamente

export const Product = mongoose.model('Product', productSchema)
