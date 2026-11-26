import { User } from "../models/User.js";
import { Product } from "../models/Product.js";

// READ (todos) - GET /api/users
export const getUsers = async (req, res) => {
    try {
        // .select('-password') -> trae todos los campos MENOS la password
        const users = await User.find().select('-password')
        res.status(200).json({ message: "request ok!", users })
    } catch (error) {
        res.status(500).json({ message: "Error al obtener los usuarios", error: error.message })
    }
}

// READ (uno) - GET /api/user/:id
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params
        // populate('products') -> cambia el array de ObjectIds por los productos completos
        const user = await User.findById(id).select('-password').populate('products')

        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" })
        }

        res.status(200).json({ message: "request ok!", user })
    } catch (error) {
        res.status(400).json({ message: "Id inválido", error: error.message })
    }
}

// CREATE - POST /api/user
export const createUser = async (req, res) => {
    try {
        const { name, email, password } = req.body

        // El hook "pre save" del modelo hashea la password antes de guardar
        const newUser = await User.create({ name, email, password })

        res.status(201).json({
            message: "OK user Created",
            newUser: { id: newUser._id, name: newUser.name, email: newUser.email }
        })
    } catch (error) {
        res.status(400).json({ message: "Error al crear el usuario", error: error.message })
    }
}

// UPDATE - PUT /api/user/:id
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params
        const { name, email } = req.body

        // Solo actualizamos name y email (la password NO se cambia por acá,
        // porque findByIdAndUpdate no ejecuta el hook "pre save" y quedaría sin hashear)
        const updatedUser = await User.findByIdAndUpdate(id, { name, email }, { new: true }).select('-password')

        if (!updatedUser) {
            return res.status(404).json({ message: "Usuario no encontrado" })
        }

        res.status(200).json({ message: "OK user Updated", updatedUser })
    } catch (error) {
        res.status(400).json({ message: "Error al actualizar el usuario", error: error.message })
    }
}

// DELETE - DELETE /api/user/:id
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params
        const deletedUser = await User.findByIdAndDelete(id).select('-password')

        if (!deletedUser) {
            return res.status(404).json({ message: "Usuario no encontrado" })
        }

        // Si se borra el usuario, se borran también sus productos (si no, quedarían "huérfanos")
        await Product.deleteMany({ owner: id })

        res.status(200).json({ message: "OK user Deleted", deletedUser })
    } catch (error) {
        res.status(400).json({ message: "Error al eliminar el usuario", error: error.message })
    }
}
