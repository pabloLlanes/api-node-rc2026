import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // Relación: un usuario tiene MUCHOS productos.
    // Guardamos solo los _id (ObjectId); "ref" le dice a populate() en qué colección buscarlos
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
});

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return

    const salt = await bcrypt.genSalt(10)

    this.password = await bcrypt.hash(this.password, salt)
})

export const User = mongoose.model('User', userSchema);