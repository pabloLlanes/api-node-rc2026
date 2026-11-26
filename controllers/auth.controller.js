import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { User } from "../models/User.js";

// Cuánto dura el token. Pasado este tiempo jwt.verify lo rechaza y hay que volver a loguearse.
// Formatos válidos: '60s', '15m', '2h', '7d'
const JWT_EXPIRES_IN = '2h'

// POST /api/auth/register
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body

        // El hook "pre save" del modelo hashea la password
        const newUser = await User.create({ name, email, password })

        res.status(201).json({
            message: "OK user Created",
            user: { id: newUser._id, name: newUser.name, email: newUser.email }
        })
    } catch (error) {
        res.status(400).json({ message: "Error al registrar usuario", error: error.message })
    }
}

// POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body

        // 1) Buscamos al usuario por email
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(401).json({ message: "Email o password incorrectos" })
        }

        // 2) Comparamos la password que manda el cliente con el hash de la DB
        const passwordOK = await bcrypt.compare(password, user.password)
        if (!passwordOK) {
            return res.status(401).json({ message: "Email o password incorrectos" })
        }

        // 3) Creamos el token. El payload NO está encriptado: nunca poner la password
        const payload = { id: user._id, name: user.name, email: user.email }
        // jwt.sign(payload, clave secreta, opciones) -> devuelve el token (un string)
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

        // 4) Se lo mandamos al cliente (el frontend lo guarda en localStorage)
        res.status(200).json({
            message: "Login correcto",
            token,
            user: { id: user._id, name: user.name, email: user.email }
        })
    } catch (error) {
        res.status(400).json({ message: "Error al realizar el inicio de sesión", error: error.message })
    }
}
