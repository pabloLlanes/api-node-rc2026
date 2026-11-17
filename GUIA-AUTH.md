# Guía en vivo: Register + Login con bcrypt y separación en controladores

Proyecto: `api-node-rc2026` (Express 5 + Mongoose 9 + ES Modules)

> ✅ **Todo el código de esta guía fue probado** contra este mismo proyecto (Node 24, Express 5.3, Mongoose 9.12, bcryptjs 3.0) antes de escribirla.
> Si copiás los bloques tal cual, funciona.

## Índice

- [Paso 0 – Punto de partida](#paso-0--punto-de-partida)
- [Paso 1 – Instalar bcryptjs](#paso-1--instalar-bcryptjs)
- [Paso 2 – Agregar password al modelo y hashearla](#paso-2--agregar-password-al-modelo-y-hashearla)
- [Paso 3 – Ajustar el CRUD para no exponer la password](#paso-3--ajustar-el-crud-para-no-exponer-la-password)
- [Paso 4 – Endpoint REGISTER](#paso-4--endpoint-register)
- [Paso 5 – Endpoint LOGIN](#paso-5--endpoint-login)
- [Paso 6 – Probar con Postman / Thunder Client](#paso-6--probar-con-postman--thunder-client)
- [Paso 7 – Separar en controladores y rutas](#paso-7--separar-en-controladores-y-rutas)
- [Extra – Alternativa nativa sin librerías (`node:crypto`)](#extra--alternativa-nativa-sin-librerías-nodecrypto)
- [Errores comunes](#errores-comunes)

---

## Paso 0 – Punto de partida

Hoy tenemos un CRUD de usuarios funcionando, todo dentro de `server.js`:

| Método | Ruta | Acción |
|---|---|---|
| GET | `/api/users` | Listar todos |
| GET | `/api/user/:id` | Traer uno |
| POST | `/api/user` | Crear |
| PUT | `/api/user/:id` | Actualizar |
| DELETE | `/api/user/:id` | Borrar |

**Qué vamos a agregar:**

| Método | Ruta | Acción |
|---|---|---|
| POST | `/api/auth/register` | Registrar usuario con password hasheada |
| POST | `/api/auth/login` | Verificar email + password |

### ¿Por qué hashear la password?

**Nunca** se guarda una contraseña en texto plano. Si alguien roba la base de datos, vería todas las contraseñas.

Un **hash** es una transformación de **una sola vía**:

```
"secreta123"  --bcrypt-->  "$2b$10$yVCFwLsbujSz82HFIjXG0O4/JyGIizIih0A50iJiqfccPy7bXCyOS"
```

- No se puede "deshashear".
- Para el login no desencriptamos: **hasheamos la password que llega y comparamos** (eso lo hace `bcrypt.compare`).
- El **salt** es un valor aleatorio que se mezcla con la password, así dos usuarios con la misma contraseña tienen hashes distintos.

---

## Paso 1 – Instalar bcryptjs

```bash
npm install bcryptjs
```

> **¿bcrypt o bcryptjs?** Son lo mismo para nosotros. `bcrypt` está escrito en C++ y a veces da problemas al instalar en Windows/Mac. `bcryptjs` es 100% JavaScript, se instala sin drama y genera hashes compatibles.

---

## Paso 2 – Agregar password al modelo y hashearla

Reemplazar **todo** el contenido de `models/User.js`:

```js
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

// Hook "pre save": se ejecuta automáticamente ANTES de guardar un usuario
// (con User.create() o con user.save())
userSchema.pre('save', async function () {
    // "this" es el usuario que se está por guardar
    // Si la contraseña no cambió, no la volvemos a hashear
    if (!this.isModified('password')) return

    // El "salt" es un valor aleatorio que se mezcla con la contraseña.
    // 10 = cantidad de rondas (más rondas = más seguro pero más lento)
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
})

export const User = mongoose.model('User', userSchema);
```

### Detalles a explicar

- Usamos `function () {}` y **no** arrow function `() => {}`, porque necesitamos `this` (el documento que se está guardando).
- `isModified('password')` evita re-hashear un hash si se vuelve a guardar el usuario sin cambiar la password.
- El hook se dispara con `User.create()` y `user.save()`, **pero NO** con `findByIdAndUpdate()`. Por eso en el PUT no vamos a permitir cambiar la password.
- Mantenemos el campo `name` (no `nombre`) para que el CRUD que ya tenemos siga funcionando.

---

## Paso 3 – Ajustar el CRUD para no exponer la password

Ahora el usuario tiene `password`, y **nunca** hay que devolverla en una respuesta (ni siquiera hasheada).
`.select('-password')` significa: "traé todos los campos **menos** password".

### 3.1 – GET todos

En `server.js`, dentro de `app.get('/api/users', ...)` cambiar:

```js
const users = await User.find()
```

por:

```js
const users = await User.find().select('-password')
```

### 3.2 – GET por id

Dentro de `app.get('/api/user/:id', ...)` cambiar:

```js
const user = await User.findById(id)
```

por:

```js
const user = await User.findById(id).select('-password')
```

### 3.3 – POST /api/user (crear)

Como ahora `password` es obligatoria, este endpoint tiene que recibirla. Reemplazar el endpoint completo:

```js
app.post('/api/user', async (req, res) => {
    try {
        // req.body contiene el JSON enviado por el cliente (gracias a express.json())
        const { name, email, password } = req.body

        // User.create valida contra el Schema (name, email y password son required)
        // y el hook "pre save" del modelo hashea la password antes de guardar
        const newUser = await User.create({ name, email, password })

        // 201 = Created. Respondemos sin la password
        res.status(201).json({
            message: "OK user Created",
            newUser: { id: newUser._id, name: newUser.name, email: newUser.email }
        })
    } catch (error) {
        // 400 = Bad Request: faltan campos obligatorios o el email ya existe (unique)
        res.status(400).json({ message: "Error al crear el usuario", error: error.message })
    }
})
```

### 3.4 – PUT

Solo cambia la línea del `findByIdAndUpdate` (le agregamos `.select('-password')`). Endpoint completo:

```js
app.put('/api/user/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { name, email } = req.body

        // findByIdAndUpdate(id, datosNuevos, opciones)
        // new: true -> devuelve el usuario YA actualizado (si no, devuelve el viejo)
        const updatedUser = await User.findByIdAndUpdate(id, { name, email }, { new: true }).select('-password')

        if (!updatedUser) {
            return res.status(404).json({ message: "Usuario no encontrado" })
        }

        // 200 = OK
        res.status(200).json({ message: "OK user Updated", updatedUser })
    } catch (error) {
        res.status(400).json({ message: "Error al actualizar el usuario", error: error.message })
    }
})
```

### 3.5 – DELETE

Igual, agregamos `.select('-password')`. Endpoint completo:

```js
app.delete('/api/user/:id', async (req, res) => {
    try {
        const { id } = req.params

        // findByIdAndDelete borra el documento y nos devuelve el que se eliminó
        const deletedUser = await User.findByIdAndDelete(id).select('-password')

        if (!deletedUser) {
            return res.status(404).json({ message: "Usuario no encontrado" })
        }

        // 200 = OK (también se suele usar 204 No Content, pero ese no permite enviar body)
        res.status(200).json({ message: "OK user Deleted", deletedUser })
    } catch (error) {
        res.status(400).json({ message: "Error al eliminar el usuario", error: error.message })
    }
})
```

---

## Paso 4 – Endpoint REGISTER

### 4.1 – Importar bcrypt en `server.js`

Debajo del import de `User`, agregar:

```js
import bcrypt from "bcryptjs";
```

(En el register no lo usamos directamente, lo necesitamos para el login del paso 5).

> 💡 **¿Sin librerías?** Node trae `node:crypto` incorporado y se puede usar en lugar de bcrypt. Ver [Extra – Alternativa nativa](#extra--alternativa-nativa-sin-librerías-nodecrypto).

### 4.2 – Pegar REGISTER y LOGIN

Pegar este bloque en `server.js` **antes** del bloque `CONEXIÓN A MONGODB Y ARRANQUE DEL SERVIDOR`:

```js
// ======================================================
// AUTH - REGISTER
// ======================================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body

        // 1) Validamos que vengan todos los datos
        if (!name || !email || !password) {
            return res.status(400).json({ message: "name, email y password son obligatorios" })
        }

        // 2) Revisamos si el email ya está registrado
        const userExists = await User.findOne({ email })
        if (userExists) {
            // 409 = Conflict: el recurso ya existe
            return res.status(409).json({ message: "El email ya está registrado" })
        }

        // 3) Creamos el usuario. El hook "pre save" del modelo hashea la password
        const newUser = await User.create({ name, email, password })

        // 4) Respondemos SIN la password
        res.status(201).json({
            message: "Usuario registrado",
            user: { id: newUser._id, name: newUser.name, email: newUser.email }
        })
    } catch (error) {
        res.status(500).json({ message: "Error al registrar", error: error.message })
    }
})

// ======================================================
// AUTH - LOGIN
// ======================================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: "email y password son obligatorios" })
        }

        // 1) Buscamos el usuario por email
        const user = await User.findOne({ email })

        // 2) Comparamos la password que llega con el hash guardado
        //    bcrypt.compare hashea la que llega y la compara con la de la base
        //    (si el usuario no existe o es viejo y no tiene password -> false)
        let passwordOk = false
        if (user && user.password) {
            passwordOk = await bcrypt.compare(password, user.password)
        }

        // 3) Mismo mensaje para "no existe" y "password incorrecta"
        //    (así no le decimos a un atacante qué emails están registrados)
        if (!passwordOk) {
            // 401 = Unauthorized
            return res.status(401).json({ message: "Email o password incorrectos" })
        }

        res.status(200).json({
            message: "Login correcto",
            user: { id: user._id, name: user.name, email: user.email }
        })
    } catch (error) {
        res.status(500).json({ message: "Error al iniciar sesión", error: error.message })
    }
})
```

### Códigos HTTP que usamos

| Código | Significado | Cuándo |
|---|---|---|
| **201** | Created | Usuario registrado |
| **200** | OK | Login correcto |
| **400** | Bad Request | Faltan datos |
| **401** | Unauthorized | Email o password incorrectos |
| **409** | Conflict | El email ya está registrado |
| **500** | Internal Server Error | Falló algo del servidor / base de datos |

---

## Paso 5 – Endpoint LOGIN

(El código ya quedó pegado en el paso 4.2). Lo que hay que explicar:

1. Buscamos el usuario con `User.findOne({ email })`.
2. `bcrypt.compare(passwordQueLlega, hashGuardado)` devuelve `true` o `false`.
3. **Mismo mensaje** si el email no existe o si la password está mal: así no le confirmamos a un atacante qué emails están registrados.
4. `if (user && user.password)`: los usuarios que se crearon **antes** de esta clase no tienen password. Sin ese chequeo, `bcrypt.compare` explota con `Illegal arguments: string, undefined` y la API devuelve 500.

> 💡 **Próximo paso (otra clase):** hoy el login solo responde "Login correcto". En una app real, acá se genera un **token JWT** que el frontend guarda y manda en cada request para demostrar que está logueado.

---

## Paso 6 – Probar con Postman / Thunder Client

En POST y PUT: **Body → raw → JSON** (eso agrega el header `Content-Type: application/json`; sin él, `req.body` llega `undefined`).

| # | Request | Body | Esperado |
|---|---|---|---|
| 1 | `POST /api/auth/register` | `{ "name": "Ana", "email": "ana@mail.com", "password": "secreta123" }` | **201** + usuario sin password |
| 2 | Repetir el #1 | igual | **409** "El email ya está registrado" |
| 3 | `POST /api/auth/register` | `{ "name": "X", "email": "x@mail.com" }` | **400** faltan datos |
| 4 | `POST /api/auth/login` | `{ "email": "ana@mail.com", "password": "secreta123" }` | **200** "Login correcto" |
| 5 | `POST /api/auth/login` | `{ "email": "ana@mail.com", "password": "mal" }` | **401** |
| 6 | `POST /api/auth/login` | `{ "email": "noexiste@mail.com", "password": "x" }` | **401** (mismo mensaje) |
| 7 | `GET /api/users` | – | **200**, ningún usuario muestra `password` |
| 8 | `PUT /api/user/:id` (id de Ana) | `{ "name": "Ana María" }` | **200**, sin password en la respuesta |
| 9 | Repetir el #4 | igual | **200** (el PUT no rompió la password) |
| 10 | `DELETE /api/user/:id` (id de Ana) | – | **200**, sin password en la respuesta |

👀 **Antes del #10, mostrar en MongoDB Atlas / Compass** el documento de Ana: la password se ve como `$2b$10$...`, nunca como `secreta123`.

> El #10 borra a Ana, así las pruebas se pueden repetir desde el #1 (si no, el #1 da 409 porque el email ya existe).

---

## Paso 7 – Separar en controladores y rutas

Hoy `server.js` hace **todo**: configura la app, define rutas, tiene la lógica y conecta a la base. A medida que crece se vuelve imposible de mantener.

Vamos a separar responsabilidades:

```
api-node-rc2026/
├── controllers/
│   ├── auth.controller.js    ← lógica de register y login
│   └── user.controller.js    ← lógica del CRUD
├── models/
│   └── User.js               ← forma de los datos (Schema)
├── routes/
│   ├── auth.routes.js        ← qué URL llama a qué controlador (auth)
│   └── user.routes.js        ← qué URL llama a qué controlador (CRUD)
├── .env
├── package.json
└── server.js                 ← solo configura la app y la levanta
```

**Idea clave:**
- **Ruta** = "cuando llegue `POST /api/auth/login`, ejecutá `login`".
- **Controlador** = la función `login` en sí: qué hace con `req` y qué responde con `res`.

Las funciones de los controladores tienen **la misma lógica** que teníamos en `app.get(...)`, `app.post(...)`, etc. Solo las movemos a otro archivo, les ponemos nombre y las exportamos.

### 7.1 – Crear las carpetas

```bash
mkdir controllers routes
```

### 7.2 – `controllers/user.controller.js`

```js
import { User } from "../models/User.js";

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
        const user = await User.findById(id).select('-password')

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

        res.status(200).json({ message: "OK user Deleted", deletedUser })
    } catch (error) {
        res.status(400).json({ message: "Error al eliminar el usuario", error: error.message })
    }
}
```

### 7.3 – `controllers/auth.controller.js`

```js
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";

// REGISTER - POST /api/auth/register
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body

        // 1) Validamos que vengan todos los datos
        if (!name || !email || !password) {
            return res.status(400).json({ message: "name, email y password son obligatorios" })
        }

        // 2) Revisamos si el email ya está registrado
        const userExists = await User.findOne({ email })
        if (userExists) {
            // 409 = Conflict: el recurso ya existe
            return res.status(409).json({ message: "El email ya está registrado" })
        }

        // 3) Creamos el usuario. El hook "pre save" del modelo hashea la password
        const newUser = await User.create({ name, email, password })

        // 4) Respondemos SIN la password
        res.status(201).json({
            message: "Usuario registrado",
            user: { id: newUser._id, name: newUser.name, email: newUser.email }
        })
    } catch (error) {
        res.status(500).json({ message: "Error al registrar", error: error.message })
    }
}

// LOGIN - POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: "email y password son obligatorios" })
        }

        // 1) Buscamos el usuario por email
        const user = await User.findOne({ email })

        // 2) Comparamos la password que llega con el hash guardado
        //    (si el usuario no existe o es viejo y no tiene password -> false)
        let passwordOk = false
        if (user && user.password) {
            passwordOk = await bcrypt.compare(password, user.password)
        }

        // 3) Mismo mensaje para "no existe" y "password incorrecta"
        //    (así no le decimos a un atacante qué emails están registrados)
        if (!passwordOk) {
            // 401 = Unauthorized
            return res.status(401).json({ message: "Email o password incorrectos" })
        }

        res.status(200).json({
            message: "Login correcto",
            user: { id: user._id, name: user.name, email: user.email }
        })
    } catch (error) {
        res.status(500).json({ message: "Error al iniciar sesión", error: error.message })
    }
}
```

### 7.4 – `routes/user.routes.js`

```js
import { Router } from "express";
import { getUsers, getUserById, createUser, updateUser, deleteUser } from "../controllers/user.controller.js";

// Router = un "mini app" de Express donde agrupamos rutas relacionadas
const router = Router()

// Las rutas acá son RELATIVAS al prefijo que se pone en server.js ("/api")
router.get('/users', getUsers)
router.get('/user/:id', getUserById)
router.post('/user', createUser)
router.put('/user/:id', updateUser)
router.delete('/user/:id', deleteUser)

export default router
```

### 7.5 – `routes/auth.routes.js`

```js
import { Router } from "express";
import { register, login } from "../controllers/auth.controller.js";

const router = Router()

// Prefijo en server.js: "/api/auth"
router.post('/register', register)   // POST /api/auth/register
router.post('/login', login)         // POST /api/auth/login

export default router
```

### 7.6 – `server.js` final (reemplazar todo)

```js
import express from "express"
import morgan from "morgan"
import cors from "cors"
import mongoose from "mongoose"
import 'dotenv/config';
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";

const app = express()

// ======================================================
// MIDDLEWARES
// ======================================================
app.use(cors())
app.use(morgan('dev'))
app.use(express.json())

// ======================================================
// RUTAS
// ======================================================
app.get('/', (req, res) => {
    res.json({ message: "Hola desde la ruta raiz / " })
})

// Todas las rutas de userRoutes empiezan con /api
app.use('/api', userRoutes)

// Todas las rutas de authRoutes empiezan con /api/auth
app.use('/api/auth', authRoutes)

// ======================================================
// CONEXIÓN A MONGODB Y ARRANQUE DEL SERVIDOR
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
```

> Notar que `server.js` **ya no importa** `User` ni `bcrypt`: eso ahora vive en los controladores.

### 7.7 – Cómo se arma la URL final

```
app.use('/api/auth', authRoutes)   +   router.post('/login', login)
        ^^^^^^^^^                               ^^^^^^
              └────────────  /api/auth/login  ──────┘
```

Volver a correr **todas** las pruebas del paso 6: las URLs no cambiaron, así que todo debe responder igual.

---

## Extra – Alternativa nativa sin librerías (`node:crypto`)

Node trae el módulo `crypto` incorporado, con el algoritmo **scrypt**, que también es seguro para passwords. **No hay que instalar nada.**

**Cómo usarla:** seguí la guía normal (pasos 2 a 7) **salteando el paso 1** y después aplicá estos 3 cambios (E.1, E.2 y E.3). Se pueden aplicar en cualquier momento, antes o después de separar en controladores.

### E.1 – Crear `utils/password.js`

```js
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// scrypt usa callbacks; promisify lo convierte para poder usar await
const scryptAsync = promisify(scrypt)

// Devuelve un string "salt:hash" para guardar en la base
export const hashPassword = async (password) => {
    const salt = randomBytes(16).toString('hex')
    const hash = await scryptAsync(password, salt, 64)
    return `${salt}:${hash.toString('hex')}`
}

// Compara la password que llega con la guardada ("salt:hash")
export const comparePassword = async (password, stored) => {
    const [salt, hash] = stored.split(':')
    const hashGuardado = Buffer.from(hash, 'hex')
    const hashNuevo = await scryptAsync(password, salt, 64)
    // timingSafeEqual compara sin filtrar información por el tiempo que tarda
    return timingSafeEqual(hashGuardado, hashNuevo)
}
```

### E.2 – En `models/User.js`

Cambiar el import:

```js
import bcrypt from 'bcryptjs'
```

por:

```js
import { hashPassword } from '../utils/password.js'
```

y dentro del hook, cambiar:

```js
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
```

por:

```js
    this.password = await hashPassword(this.password)
```

### E.3 – En el login

El login puede estar en `server.js` (pasos 4 y 5) o en `controllers/auth.controller.js` (paso 7). Cambiar el import según dónde esté:

**Si todavía está todo en `server.js`**, cambiar:

```js
import bcrypt from "bcryptjs";
```

por:

```js
import { comparePassword } from "./utils/password.js";
```

**Si ya separaste en controladores** (`controllers/auth.controller.js`), cambiar:

```js
import bcrypt from "bcryptjs";
```

por:

```js
import { comparePassword } from "../utils/password.js";
```

> La diferencia es la ruta: `./` desde la raíz (`server.js`), `../` desde una carpeta (`controllers/`).

y en el login cambiar:

```js
            passwordOk = await bcrypt.compare(password, user.password)
```

por:

```js
            passwordOk = await comparePassword(password, user.password)
```

### bcrypt vs crypto nativo

| | bcryptjs | `node:crypto` (scrypt) |
|---|---|---|
| Instalación | `npm install bcryptjs` | Ya viene con Node |
| Código | Muy corto (`hash` / `compare`) | Hay que armar salt y comparar a mano |
| Hash guardado | `$2b$10$...` (incluye el salt) | `salt:hash` (lo armamos nosotros) |
| Uso en la industria | Muy común en tutoriales y proyectos Express | Muy seguro, menos común en cursos |

> ⚠️ **No mezclar:** los usuarios registrados con bcrypt no pueden loguearse si después cambiás a scrypt (y al revés), porque los formatos de hash son distintos. Elegir uno.

---

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `TypeError: next is not a function` | Hook `pre('save')` con `next` (código de Mongoose 8) | Sacar `next`, ver paso 2 |
| `Illegal arguments: string, undefined` en login | Usuario viejo sin password | Usar el `if (user && user.password)` del paso 5 |
| `password is required` en `POST /api/user` | Ahora la password es obligatoria | Mandar `password` en el body (paso 3.3) |
| `req.body` es `undefined` | Falta `Content-Type: application/json` | En Postman: Body → raw → JSON |
| `Cannot find module '.../controllers/user.controller'` | Falta el `.js` en el import | En ES Modules el import **siempre** lleva `.js` |
| `Cannot find package 'bcryptjs'` | No se instaló | `npm install bcryptjs` (o, si usás la versión nativa, revisar que no quede ningún `import bcrypt`: ver Extra) |
| `Cannot find module '.../utils/password.js'` (versión nativa) | Ruta del import mal | `./utils/...` desde `server.js`, `../utils/...` desde `models/` o `controllers/` |
| La password aparece en las respuestas | Falta `.select('-password')` | Ver paso 3 |
