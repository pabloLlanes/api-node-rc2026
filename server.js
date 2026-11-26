import express from "express"
import morgan from "morgan"
import cors from "cors"
import mongoose from "mongoose"
import 'dotenv/config';

import userRoutes from "./routes/user.routes.js";
import productRoutes from "./routes/product.routes.js";
import authRoutes from "./routes/auth.routes.js";

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
app.use('/api', productRoutes)
app.use('/api', authRoutes)



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

