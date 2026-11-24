import express from "express"
import morgan from "morgan"
import cors from "cors"
import mongoose from "mongoose"
import 'dotenv/config';
import { User } from "./models/User.js";
import bcrypt from "bcryptjs"

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
// CRUD DE USUARIOS
//
//  C - Create  -> POST    /api/user
//  R - Read    -> GET     /api/users        (todos)
//               -> GET     /api/user/:id    (uno solo)
//  U - Update  -> PUT     /api/user/:id
//  D - Delete  -> DELETE  /api/user/:id
//
// Los handlers son "async" porque las operaciones con la
// base de datos (MongoDB) tardan y devuelven Promesas,
// por eso usamos "await" para esperar el resultado.
// ======================================================


// ------------------------------------------------------
// READ (todos) - Método HTTP GET - CRUD ---> READ
// Devuelve la lista completa de usuarios.
// ------------------------------------------------------
app.get('/api/users', async (req, res) => {
    try {
        // User.find() sin filtros trae TODOS los documentos de la colección
        const users = await User.find()

        // 200 = OK
        res.status(200).json({ message: "request ok!", users: users })
    } catch (error) {
        // 500 = error interno del servidor (ej: se cayó la conexión a Mongo)
        res.status(500).json({ message: "Error al obtener los usuarios", error: error.message })
    }
})


// ------------------------------------------------------
// READ (uno) - Método HTTP GET - CRUD ---> READ
// Devuelve un único usuario buscándolo por su _id.
// El ":id" es un PARÁMETRO DE RUTA: lo que venga en esa
// posición de la URL se guarda en req.params.id
// Ejemplo: GET /api/user/665f1c2e9b1e8a2d4c3b2a10
// ------------------------------------------------------
app.get('/api/user/:id', async (req, res) => {
    try {
        const { id } = req.params

        // findById busca por el campo _id que Mongo genera automáticamente
        const user = await User.findById(id)

        // Si no lo encuentra devuelve null -> respondemos 404 = No encontrado
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" })
        }

        res.status(200).json({ message: "request ok!", user })
    } catch (error) {
        // Si el id no tiene formato válido de Mongo (ObjectId), Mongoose lanza un CastError
        res.status(400).json({ message: "Id inválido", error: error.message })
    }
})


// ------------------------------------------------------
// CREATE - Método HTTP POST - CRUD ---> CREATE
// Crea un usuario nuevo con los datos que llegan en el body.
// Ejemplo de body (JSON):
// { "name": "Ana", "email": "ana@mail.com" }
// ------------------------------------------------------
app.post('/api/user', async (req, res) => {
    try {
        // req.body contiene el JSON enviado por el cliente (gracias a express.json())
        const user = req.body

        // User.create valida contra el Schema (name y email son required)
        // y guarda el documento en la base de datos
        const newUser = await User.create({ name: user.name, email: user.email, password: user.password })

        // 201 = Created (recurso creado con éxito)
        res.status(201).json({ message: "OK user Created", newUser })
    } catch (error) {
        // 400 = Bad Request: faltan campos obligatorios o el email ya existe (unique)
        res.status(400).json({ message: "Error al crear el usuario", error: error.message })
    }
})


// ------------------------------------------------------
// UPDATE - Método HTTP PUT - CRUD ---> UPDATE
// Actualiza un usuario existente buscándolo por su _id.
// El id viaja en la URL y los datos nuevos en el body.
// Ejemplo: PUT /api/user/665f1c2e9b1e8a2d4c3b2a10
// body: { "name": "Ana María" }
// ------------------------------------------------------
app.put('/api/user/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { name, email } = req.body

        // findByIdAndUpdate(id, datosNuevos, opciones)
        // new: true -> devuelve el usuario YA actualizado (si no, devuelve el viejo)
        const updatedUser = await User.findByIdAndUpdate(id, { name, email }, { new: true })

        if (!updatedUser) {
            return res.status(404).json({ message: "Usuario no encontrado" })
        }

        // 200 = OK
        res.status(200).json({ message: "OK user Updated", updatedUser })
    } catch (error) {
        res.status(400).json({ message: "Error al actualizar el usuario", error: error.message })
    }
})


// ------------------------------------------------------
// DELETE - Método HTTP DELETE - CRUD ---> DELETE
// Elimina un usuario buscándolo por su _id.
// Ejemplo: DELETE /api/user/665f1c2e9b1e8a2d4c3b2a10
// ------------------------------------------------------
app.delete('/api/user/:id', async (req, res) => {
    try {
        const { id } = req.params

        // findByIdAndDelete borra el documento y nos devuelve el que se eliminó
        const deletedUser = await User.findByIdAndDelete(id)

        if (!deletedUser) {
            return res.status(404).json({ message: "Usuario no encontrado" })
        }

        // 200 = OK (también se suele usar 204 No Content, pero ese no permite enviar body)
        res.status(200).json({ message: "OK user Deleted", deletedUser })
    } catch (error) {
        res.status(400).json({ message: "Error al eliminar el usuario", error: error.message })
    }
})

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

