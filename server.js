import express from "express"
import morgan from "morgan"
import cors from "cors"
import mongoose from "mongoose"
import 'dotenv/config';
import { User } from "./models/User.js";
import bcrypt from "bcryptjs"

import userRoutes from "./routes/user.routes.js";

const app = express()

// ======================================================
// MIDDLEWARES
// Funciones que se ejecutan ANTES de llegar a cada endpoint
// ======================================================
app.use(cors())            // Permite que otros orígenes (ej: un frontend en React) consuman la API
app.use(morgan('dev'))     // Muestra en consola cada request: método, ruta, status y tiempo
app.use(express.json())    // Convierte el body que llega en JSON a un objeto JS (req.body)

// ======================================================
// RUTA RAÍZ - solo para probar que la API responde
// ======================================================
app.get('/', (req, res) => {
    console.log('ENTRO POR ACA')
    const message = "Hola desde la ruta raiz / "
    res.status(200).json({ message, ok: true })
})

app.use('/api', userRoutes)



// faltan migrar
app.post('/api/auth/register', async (req, res) => {

    try {

        const { name, email, password } = req.body;

        console.log(req.body)
        const newUser = await User.create({ name: name, email: email, password: password })

        // 201 = Created (recurso creado con éxito)
        res.status(201).json({ message: "OK user Created", newUser })

    } catch (error) {
        res.status(400).json({ message: "Error al registrar usuario", error: error.message })

    }

})

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body

        const user = await User.findOne({ email: email })

        if (!user) {
            return res.status(400).json({ message: "Email o password incorrectos" })
        }

        console.log("password de la db: ", user.password)
        console.log("password q mando el cliente: ", password)

        const passwordOK = await bcrypt.compare(password, user.password)

        console.log(passwordOK)

        if (!passwordOK) {
            // 401 = Unauthorized
            return res.status(401).json({ message: "Email o password incorrectos" })
        }

        res.status(200).json({
            message: "Login correcto",
            user: { id: user._id, name: user.name, email: user.email }
        })

    } catch (error) {
        res.status(400).json({ message: "Error al realizar el inicio de sesión", error: error.message })

    }

})


// ======================================================
// CONEXIÓN A MONGODB Y ARRANQUE DEL SERVIDOR
// Primero nos conectamos a la base de datos y, solo si
// sale bien, levantamos el servidor en el puerto del .env
// ======================================================
try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    app.listen(process.env.PORT, () => {
        console.log(`✅ Api corriendo en el puerto ${process.env.PORT}`)
    });
} catch (error) {
    console.error('❌ No se pudo conectar a MongoDB:', error.message);
}

