import express from "express"
import morgan from "morgan"
import cors from "cors"
import 'dotenv/config';
import { connectDB } from "./config/db.js";
import { startServer } from "./config/server.js";

import userRoutes from "./routes/user.routes.js";
import productRoutes from "./routes/product.routes.js";
import authRoutes from "./routes/auth.routes.js";
import orderRoutes from "./routes/order.routes.js";

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

// ======================================================
// RUTAS DE LA API
// Cada archivo de rutas se "monta" bajo el prefijo /api.
// ======================================================
app.use('/api', userRoutes)     // /api/users, /api/user/:id
app.use('/api', productRoutes)  // /api/products, /api/product/:id
app.use('/api', authRoutes)     // /api/auth/register, /api/auth/login
app.use('/api', orderRoutes)    // /api/orders, /api/order/:id

// ======================================================
// CONEXIÓN A MONGODB Y ARRANQUE DEL SERVIDOR
// Primero nos conectamos a la base de datos y, solo si
// sale bien, levantamos el servidor en el puerto del .env
// (connectDB vive en config/db.js y startServer en config/server.js)
// ======================================================
const main = async () => {
    try {
        await connectDB();
        startServer(app);
    } catch (error) {
        console.error('❌ No se pudo conectar a MongoDB:', error.message);
        process.exit(1); // cortamos el proceso: sin DB la API no sirve
    }
}

main();

