# Guía en vivo: Autenticación con JWT (tokens, rutas protegidas y roles)

Proyecto: `api-node-rc2026` (Express 5 + Mongoose 9 + ES Modules)

> ✅ **Todo el código de esta guía fue probado** contra este mismo proyecto (Node 24, Express 5.3, Mongoose 9.12, jsonwebtoken 9.0) antes de escribirla.
> Si copiás los bloques tal cual, funciona.

> 📌 **Continúa [GUIA-AUTH.md](GUIA-AUTH.md).** Necesitás tener terminado el **paso 7** (register y login en `controllers/auth.controller.js`).
> Si todavía están dentro de `server.js`, terminá ese paso primero.

## Índice

- [Paso 0 – El problema y qué es un JWT](#paso-0--el-problema-y-qué-es-un-jwt)
- [Paso 1 – Instalar jsonwebtoken](#paso-1--instalar-jsonwebtoken)
- [Paso 2 – Agregar JWT_SECRET al .env](#paso-2--agregar-jwt_secret-al-env)
- [Paso 3 – Agregar el rol al modelo User](#paso-3--agregar-el-rol-al-modelo-user)
- [Paso 4 – Generar el token en el login](#paso-4--generar-el-token-en-el-login)
- [Paso 5 – Middleware verifyToken (¿quién sos?)](#paso-5--middleware-verifytoken-quién-sos)
- [Paso 6 – Ruta protegida /api/auth/me](#paso-6--ruta-protegida-apiauthme)
- [Paso 7 – Roles: isAdmin e isSelfOrAdmin (¿podés?)](#paso-7--roles-isadmin-e-isselforadmin-podés)
- [Paso 8 – Proteger las rutas](#paso-8--proteger-las-rutas)
- [Paso 9 – Crear el primer admin](#paso-9--crear-el-primer-admin)
- [Paso 10 – Probar con Postman / Thunder Client](#paso-10--probar-con-postman--thunder-client)
- [Paso 11 – Usar el token desde React](#paso-11--usar-el-token-desde-react)
- [Errores comunes](#errores-comunes)

---

## Paso 0 – El problema y qué es un JWT

Hoy el login responde "Login correcto"... y nada más. En la próxima petición, el servidor **no recuerda**
quién se logueó: HTTP no tiene memoria, cada petición llega sola.

**La solución:** al loguearse, el servidor le entrega al cliente un **token** (una credencial).
El cliente lo guarda y lo manda en **cada** petición. El servidor lo revisa y así sabe quién es.

```
   CLIENTE (Postman / React)                            SERVIDOR (Express)
        │                                                       │
   1.   │── POST /api/auth/login { email, password } ──────────▶│ bcrypt.compare(...)
        │                                                       │ jwt.sign(...)  → crea el token
   2.   │◀────────────── 200 { user, token } ───────────────────│
        │                                                       │
        │  guarda el token                                      │
        │                                                       │
   3.   │── GET /api/auth/me ──────────────────────────────────▶│ verifyToken:
        │   Authorization: Bearer eyJhbGciOi...                 │   jwt.verify(...) → ¿es válido?
        │                                                       │   busca al usuario → req.user
   4.   │◀────────────── 200 { user } ──────────────────────────│
```

### ¿Qué es un JWT?

**JWT** (JSON Web Token) es un texto con **3 partes separadas por puntos**:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjUwZjFhMmIzYzRkNWU2ZjdhOGI5YzAiLCJyb2xlIjoidXNlciIsImlhdCI6MTc5NTcyNTM5MiwiZXhwIjoxNzk1NzMyNTkyfQ.SWxe6GZs1sMSDNuaulPHZBhHjY62yAiS84w6AVFBqvE
└────────────── header ─────────────┘ └──────────────────────────────── payload ────────────────────────────────┘ └──────────── firma ──────────────┘
```

| Parte | Decodificada | Para qué sirve |
|---|---|---|
| **Header** | `{"alg":"HS256","typ":"JWT"}` | Con qué algoritmo se firmó |
| **Payload** | `{"sub":"6650f1a2b3c4d5e6f7a8b9c0","role":"user","iat":1795725392,"exp":1795732592}` | Los datos del usuario |
| **Firma** | (bytes) | Prueba de que **lo creó nuestro servidor** y que **nadie lo modificó** |

- `sub` (*subject*): el `_id` del usuario. **Es el dato clave**: con él sabemos quién hace la petición.
- `role`: el rol del usuario.
- `iat` (*issued at*): cuándo se creó · `exp` (*expiration*): cuándo vence. Son segundos desde 1970.

### ⚠️ Dos ideas que hay que llevarse

1. **El payload NO está encriptado**: está en base64 y cualquiera lo puede leer (probá pegar un token en [jwt.io](https://jwt.io)).
   Por eso **nunca** se pone la password ni datos sensibles en el payload.
2. **Nadie lo puede modificar sin la clave secreta** (`JWT_SECRET`). Si alguien cambia `"role":"user"` por `"role":"admin"`,
   la firma deja de coincidir y el servidor lo rechaza.

> Es como una pulsera de un recital: cualquiera ve qué dice, pero nadie puede falsificarla porque tiene un sello que solo pone la organización.

---

## Paso 1 – Instalar jsonwebtoken

```bash
npm install jsonwebtoken
```

Tiene las dos funciones que vamos a usar:

| Función | Qué hace | Dónde la usamos |
|---|---|---|
| `jwt.sign(payload, secreto, opciones)` | Crea un token | En el **login** |
| `jwt.verify(token, secreto)` | Revisa la firma y el vencimiento. Si algo está mal, **lanza un error** | En el **middleware** |

---

## Paso 2 – Agregar JWT_SECRET al .env

El **secreto** es la clave con la que se firman los tokens. Quien la tenga puede fabricar tokens válidos
(incluso de admin), así que tiene que ser **larga, aleatoria y privada**.

Generala con este comando:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Agregá estas dos líneas al `.env` (pegando lo que te dio el comando):

```
JWT_SECRET=pegá_acá_el_texto_largo_que_generaste
JWT_EXPIRES_IN=2h
```

- `JWT_EXPIRES_IN`: cuánto dura un token. Ejemplos: `15m`, `2h`, `1d`.
- El `.env` ya está en `.gitignore`: **nunca** se sube a GitHub. ✅
- Después de cambiar el `.env`, **reiniciá el servidor** (`node --watch` no lo relee solo).

---

## Paso 3 – Agregar el rol al modelo User

Para que haya usuarios con permisos distintos (por ejemplo, solo un admin crea productos), cada usuario necesita un **rol**.

En `models/User.js`, agregar el campo `role` al Schema. El Schema queda así:

```js
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // Rol del usuario: "user" (común) o "admin".
    // enum -> Mongoose rechaza cualquier otro valor.
    // default -> todos los usuarios nuevos son "user" (incluso los que ya existían sin rol)
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
});
```

(El hook `pre('save')` y el `export` quedan igual).

### 🔒 Regla de oro: el rol NUNCA viene del cliente

Mirá el `register` que ya tenemos:

```js
const { name, email, password } = req.body          // 👈 role NO se lee
const newUser = await User.create({ name, email, password })
```

Si alguien manda `{ ..., "role": "admin" }`, **se ignora** y el usuario se crea como `"user"`.
Si hubiéramos hecho `User.create(req.body)`, cualquiera podría registrarse como admin. **No cambies esto.**

Lo mismo en el `updateUser`: solo toma `name` y `email`, así que nadie puede subirse el rol con un PUT. ✅

> ¿Y los usuarios que ya estaban en la base sin `role`? Mongoose les aplica el `default` al leerlos: son `"user"`.

---

## Paso 4 – Generar el token en el login

### 4.1 – Crear `utils/jwt.js`

```bash
mkdir utils
```

```js
import jwt from 'jsonwebtoken'

// Crea un token JWT para el usuario que se acaba de loguear
export const generateToken = (user) => {
    // payload = los datos que viajan DENTRO del token.
    // ⚠️ Cualquiera puede leerlos (no están encriptados): NUNCA poner la password.
    const payload = {
        sub: user._id.toString(), // "sub" (subject) = el id del usuario: así sabemos QUIÉN es
        role: user.role           // para que el frontend sepa si mostrar opciones de admin
    }

    // jwt.sign(payload, clave secreta, opciones) -> devuelve el token (un string)
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '2h' // después de este tiempo el token no sirve más
    })
}
```

### 4.2 – Usarlo en `controllers/auth.controller.js`

Agregar el import arriba de todo:

```js
import { generateToken } from "../utils/jwt.js";
```

Y en `login`, reemplazar el `res.status(200).json(...)` del final por:

```js
        // 4) Credenciales OK: generamos el token y se lo mandamos al cliente
        const token = generateToken(user)

        res.status(200).json({
            message: "Login correcto",
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
            token
        })
```

> El token se genera **solo si la password es correcta** (después del `if (!passwordOk)`).

Probalo: `POST /api/auth/login` ahora devuelve un `token`. Copialo y pegalo en [jwt.io](https://jwt.io) para ver el payload.

---

## Paso 5 – Middleware verifyToken (¿quién sos?)

Un **middleware** es una función que se ejecuta **antes** del controlador. Puede:
- cortar la petición respondiendo un error (`return res.status(401)...`), o
- dejarla seguir llamando a `next()`.

```bash
mkdir middlewares
```

Crear `middlewares/auth.middleware.js` (en el paso 7 le agregamos dos funciones más):

```js
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'

// ======================================================
// verifyToken: "¿QUIÉN SOS?"
// Si no hay token o no sirve -> 401 Unauthorized
// ======================================================
export const verifyToken = async (req, res, next) => {
    // 1) El token viaja en el header:  Authorization: Bearer eyJhbGciOi...
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Falta el token. Mandalo en el header Authorization: Bearer <token>" })
    }

    // "Bearer eyJhbGciOi..." -> split(' ') -> ["Bearer", "eyJhbGciOi..."] -> nos quedamos con [1]
    const token = authHeader.split(' ')[1]

    // 2) Verificamos el token: que lo hayamos firmado nosotros y que no esté vencido.
    //    Si algo falla, jwt.verify LANZA un error (por eso el try/catch)
    let payload
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET)
    } catch (error) {
        const message = error.name === 'TokenExpiredError'
            ? "El token venció. Volvé a iniciar sesión"
            : "Token inválido"
        return res.status(401).json({ message })
    }

    // 3) Buscamos al usuario en la base con el id que viene en el token (payload.sub).
    //    Así, si lo borraron o le cambiaron el rol, nos enteramos ahora.
    try {
        const user = await User.findById(payload.sub).select('-password')

        if (!user) {
            return res.status(401).json({ message: "El usuario de este token ya no existe" })
        }

        // 4) Guardamos el usuario en req: los próximos middlewares y el controlador lo pueden usar
        req.user = user
    } catch (error) {
        return res.status(500).json({ message: "Error al verificar el usuario", error: error.message })
    }

    // 5) Todo OK: seguimos al siguiente middleware o al controlador
    next()
}
```

### Detalles a explicar

- **`Bearer`** (en inglés, "portador") es el formato estándar: `Authorization: Bearer <token>`. Postman, Thunder Client y cualquier frontend lo mandan así.
- **Siempre 401** si no hay token o no sirve. Nunca 400 ni 500: el frontend usa el 401 para saber que tiene que mandar al usuario al login.
- **¿Por qué buscar al usuario en la base si el token ya tiene el id?** Porque el token no se entera de lo que pasa después de crearlo.
  Si borramos al usuario o le cambiamos el rol, su token sigue "vigente" hasta que vence. Al buscarlo, esos cambios aplican **en el momento**.
- **`next()` va afuera de los `try`**: así, si el controlador que viene después falla, ese error no se confunde con un error del token.

---

## Paso 6 – Ruta protegida /api/auth/me

Una ruta que devuelve "quién soy" según el token. Sirve para probar el middleware y la usa el frontend para saber quién está logueado.

### 6.1 – En `controllers/auth.controller.js`, agregar al final:

```js
// ME - GET /api/auth/me  (ruta protegida)
// Devuelve el usuario dueño del token. verifyToken ya lo dejó en req.user
export const me = (req, res) => {
    res.status(200).json({ message: "request ok!", user: req.user })
}
```

### 6.2 – `routes/auth.routes.js` (reemplazar todo)

```js
import { Router } from "express";
import { register, login, me } from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router()

// Prefijo en server.js: "/api/auth"
router.post('/register', register)   // POST /api/auth/register  (pública)
router.post('/login', login)         // POST /api/auth/login     (pública)
router.get('/me', verifyToken, me)   // GET  /api/auth/me        (necesita token)

export default router
```

**Así se protege una ruta:** se pone el middleware **entre la URL y el controlador**.
Express ejecuta las funciones en orden, de izquierda a derecha:

```
router.get('/me',  verifyToken,  me)
                       │          │
                       │          └── 2) solo llega acá si verifyToken llamó a next()
                       └── 1) ¿token válido? si no -> responde 401 y corta
```

---

## Paso 7 – Roles: isAdmin e isSelfOrAdmin (¿podés?)

Hay **dos preguntas distintas** y por eso dos códigos distintos:

| Pregunta | Nombre | Middleware | Si falla |
|---|---|---|---|
| ¿**Quién** sos? | Autenticación | `verifyToken` | **401** Unauthorized |
| ¿**Podés** hacer esto? | Autorización | `isAdmin`, `isSelfOrAdmin` | **403** Forbidden |

> **401** = "no sé quién sos, logueate" · **403** = "ya sé quién sos, pero no tenés permiso"

Agregar al final de `middlewares/auth.middleware.js`:

```js
// ======================================================
// isAdmin: "¿TENÉS PERMISO?"
// Va SIEMPRE después de verifyToken (necesita req.user)
// Si está logueado pero no es admin -> 403 Forbidden
// ======================================================
export const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Necesitás ser admin para hacer esto" })
    }
    next()
}

// ======================================================
// isSelfOrAdmin: solo el MISMO usuario (o un admin)
// Para rutas con :id, ej: GET /api/user/:id
// ======================================================
export const isSelfOrAdmin = (req, res, next) => {
    // req.user._id es un ObjectId y req.params.id es un string: los comparamos como strings
    const isSelf = req.user._id.toString() === req.params.id

    if (!isSelf && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Solo podés ver o modificar tu propio usuario" })
    }
    next()
}
```

> ⚠️ El orden importa: `isAdmin` usa `req.user`, que lo crea `verifyToken`. Si ponés `isAdmin` primero, explota con
> `Cannot read properties of undefined (reading 'role')`.

---

## Paso 8 – Proteger las rutas

Decidimos qué puede hacer cada uno:

| Ruta | Quién puede |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login` | 🌐 Cualquiera |
| `GET` de categorías y productos | 🌐 Cualquiera (es un catálogo) |
| `GET /api/auth/me` | 🔑 Cualquier usuario logueado |
| `GET /api/user/:id`, `PUT /api/user/:id` | 👤 El mismo usuario, o un admin |
| `GET /api/users`, `POST /api/user`, `DELETE /api/user/:id` | 👑 Solo admin |
| `POST`, `PUT`, `DELETE` de categorías y productos | 👑 Solo admin |

### 8.1 – `routes/user.routes.js` (reemplazar todo)

```js
import { Router } from "express";
import { getUsers, getUserById, createUser, updateUser, deleteUser } from "../controllers/user.controller.js";
import { verifyToken, isAdmin, isSelfOrAdmin } from "../middlewares/auth.middleware.js";

// Router = un "mini app" de Express donde agrupamos rutas relacionadas
const router = Router()

// Los middlewares se ejecutan EN ORDEN, de izquierda a derecha:
// verifyToken (¿quién sos?) -> isAdmin / isSelfOrAdmin (¿podés?) -> controlador
router.get('/users', verifyToken, isAdmin, getUsers)                // solo admin
router.get('/user/:id', verifyToken, isSelfOrAdmin, getUserById)    // vos mismo o admin
router.post('/user', verifyToken, isAdmin, createUser)              // solo admin (el público usa /register)
router.put('/user/:id', verifyToken, isSelfOrAdmin, updateUser)     // vos mismo o admin
router.delete('/user/:id', verifyToken, isAdmin, deleteUser)        // solo admin

export default router
```

> Los controladores **no cambian**: la seguridad la ponen los middlewares en las rutas.

### 8.2 – Categorías y productos (si hiciste esa parte)

En `routes/category.routes.js` y `routes/product.routes.js`:

1. Agregar el import (debajo del import de los controladores):

```js
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";
```

2. Agregar `verifyToken, isAdmin` **solo** en `post`, `put` y `delete`. Los `get` quedan públicos.

`routes/product.routes.js` queda:

```js
router.get('/', getProducts)                                // GET    /api/products  (público)
router.get('/:id', getProductById)                          // GET    /api/products/:id  (público)
router.post('/', verifyToken, isAdmin, createProduct)       // POST   /api/products
router.put('/:id', verifyToken, isAdmin, updateProduct)     // PUT    /api/products/:id
router.delete('/:id', verifyToken, isAdmin, deleteProduct)  // DELETE /api/products/:id
```

Y `routes/category.routes.js`:

```js
router.get('/', getCategories)                               // GET    /api/categories  (público)
router.get('/:id', getCategoryById)                          // GET    /api/categories/:id  (público)
router.get('/:id/products', getProductsByCategory)           // GET    /api/categories/:id/products  (público)
router.post('/', verifyToken, isAdmin, createCategory)       // POST   /api/categories
router.put('/:id', verifyToken, isAdmin, updateCategory)     // PUT    /api/categories/:id
router.delete('/:id', verifyToken, isAdmin, deleteCategory)  // DELETE /api/categories/:id
```

---

## Paso 9 – Crear el primer admin

Problema: el register siempre crea usuarios `"user"` y para cambiar roles hay que ser admin... ¿cómo nace el primero?
Se crea **"desde adentro"**, sin pasar por la API. Dos opciones:

**Opción A – A mano en MongoDB Atlas / Compass:** abrir la colección `users`, editar el documento del usuario y agregar el campo `role` con el valor `admin`.

**Opción B – Con un script** (más prolijo, y sirve siempre):

```bash
mkdir scripts
```

Crear `scripts/make-admin.js`:

```js
// Convierte en admin a un usuario que ya existe.
// Uso:  npm run make-admin -- ana@mail.com
//
// ¿Por qué un script? Porque el rol NUNCA se puede elegir desde la API
// (si no, cualquiera se registraría como admin). El primer admin se crea "desde adentro".
import mongoose from 'mongoose'
import 'dotenv/config'
import { User } from '../models/User.js'

const email = process.argv[2]

if (!email) {
    console.log('❌ Falta el email. Uso: npm run make-admin -- ana@mail.com')
    process.exit(1)
}

await mongoose.connect(process.env.MONGO_URI)

const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { returnDocument: 'after' })

if (user) {
    console.log(`✅ ${user.email} ahora es admin`)
} else {
    console.log(`❌ No existe un usuario con el email ${email}`)
}

await mongoose.disconnect()
```

En `package.json`, agregar el script:

```json
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "make-admin": "node scripts/make-admin.js"
  },
```

Usarlo (el `--` le pasa el email al script):

```bash
npm run make-admin -- ana@mail.com
```

> 💡 **No hace falta volver a loguearse**: `verifyToken` lee el rol de la base en cada petición, así que el token que Ana ya tenía pasa a funcionar como admin al instante.

---

## Paso 10 – Probar con Postman / Thunder Client

### Cómo mandar el token

- **Postman:** pestaña **Authorization** → Type: **Bearer Token** → pegar el token (sin la palabra Bearer).
- **Thunder Client:** pestaña **Auth** → **Bearer** → pegar el token.
- **A mano:** pestaña **Headers** → `Authorization` = `Bearer eyJhbGciOi...` (con un espacio después de Bearer).

> 💡 En Postman podés guardar el token en una variable para no pegarlo cada vez: en la pestaña **Scripts → Post-response** del login:
> `pm.environment.set("token", pm.response.json().token)` y en las demás requests usar `{{token}}`.

### Pruebas

Antes de empezar: borrá (o usá otros emails) los usuarios de pruebas anteriores.

| # | Request | Token | Esperado |
|---|---|---|---|
| 1 | `POST /api/auth/register` `{ "name": "Ana", "email": "ana@mail.com", "password": "secreta123", "role": "admin" }` | – | **201** (el `role` se ignora) |
| 2 | `POST /api/auth/register` `{ "name": "Beto", "email": "beto@mail.com", "password": "secreta123" }` | – | **201** |
| 3 | `POST /api/auth/login` (Ana) | – | **200** con `token` y `"role": "user"` |
| 4 | Pegar el token en [jwt.io](https://jwt.io) | – | Se ve `sub`, `role`, `iat`, `exp`. **No** se ve la password |
| 5 | `GET /api/auth/me` | Ana | **200** con los datos de Ana, sin password |
| 6 | `GET /api/auth/me` | ninguno | **401** "Falta el token..." |
| 7 | `GET /api/auth/me` con header `Authorization: <token>` (sin "Bearer ") | Ana | **401** |
| 8 | `GET /api/auth/me` cambiando la última letra del token | Ana | **401** "Token inválido" |
| 9 | `GET /api/users` | Ana | **403** "Necesitás ser admin..." |
| 10 | `GET /api/user/:id` (id de Ana) | Ana | **200** |
| 11 | `GET /api/user/:id` (id de Beto) | Ana | **403** "Solo podés ver o modificar tu propio usuario" |
| 12 | `PUT /api/user/:id` (id de Ana) `{ "name": "Ana María", "role": "admin" }` | Ana | **200**, cambió el nombre pero el `role` sigue `user` |
| 13 | `POST /api/categories` `{ "name": "Mates" }` | Ana | **403** |
| 14 | En la terminal: `npm run make-admin -- ana@mail.com` | – | `✅ ana@mail.com ahora es admin` |
| 15 | `GET /api/users` (**el mismo token** del #3) | Ana | **200**: ahora es admin, sin volver a loguearse |
| 16 | `POST /api/categories` `{ "name": "Mates" }` | Ana | **201** |
| 17 | `GET /api/products` | ninguno | **200** (los GET son públicos) |
| 18 | `GET /api/user/:id` (id de Beto) | Ana | **200** (un admin puede ver a otros) |
| 19 | `POST /api/auth/login` (Beto) y guardar su token | – | **200** |
| 20 | `DELETE /api/user/:id` (id de Beto) | Ana | **200** |
| 21 | `GET /api/auth/me` | **Beto** (token del #19) | **401** "El usuario de este token ya no existe" |

👀 **Para mostrar el vencimiento:** poner `JWT_EXPIRES_IN=30s` en el `.env`, reiniciar, loguearse y esperar 30 segundos:
`GET /api/auth/me` responde **401** "El token venció. Volvé a iniciar sesión". (Después volver a `2h`).

---

## Paso 11 – Usar el token desde React

El frontend tiene que hacer 3 cosas: **guardar** el token al loguearse, **mandarlo** en cada petición y **borrarlo** al cerrar sesión.

```js
const API_URL = 'http://localhost:5000/api' // el PORT de tu .env

// 1) LOGIN: guardar el token
const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)

    localStorage.setItem('token', data.token)
    return data.user
}

// 2) PETICIONES PROTEGIDAS: mandar el token con "Bearer "
const getMe = async () => {
    const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })

    // 401 = el token no sirve (venció, lo borraron...): hay que volver a loguearse
    if (res.status === 401) {
        localStorage.removeItem('token')
        // acá: redirigir al login
    }
    return res.json()
}

// 3) LOGOUT: con JWT, cerrar sesión es borrar el token del navegador
const logout = () => localStorage.removeItem('token')
```

> **Logout:** el servidor no "guarda sesiones", así que no hay nada que borrar del lado del backend.
> El token borrado deja de mandarse; si alguien lo hubiera copiado, sigue sirviendo hasta que vence. Por eso conviene que dure poco.

---

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `secretOrPrivateKey must have a value` (500 en el login) | No está `JWT_SECRET` en el `.env`, o no reiniciaste el servidor | Paso 2 y reiniciar |
| `Cannot find package 'jsonwebtoken'` | No se instaló | `npm install jsonwebtoken` |
| Siempre **401** "Falta el token" aunque lo mando | Falta la palabra `Bearer ` (con espacio), o el token está en el body | Header `Authorization: Bearer <token>`. En Postman, pestaña Authorization → Bearer Token |
| **401** "Token inválido" con un token recién creado | El token se copió con comillas o cortado, o cambiaste `JWT_SECRET` después de crearlo | Copiar el token sin comillas. Si cambiaste el secreto, volvé a loguearte |
| **403** siendo admin | Le cambiaste el rol a otro usuario, o el campo quedó mal escrito (`rol`, `Admin`) | En la base tiene que ser `role: "admin"` (minúsculas). Revisar con Compass |
| `Cannot read properties of undefined (reading 'role')` | `isAdmin` o `isSelfOrAdmin` sin `verifyToken` antes | Orden correcto: `verifyToken, isAdmin, controlador` |
| `Cannot find module '.../middlewares/auth.middleware'` | Falta el `.js` o la ruta está mal | `../middlewares/auth.middleware.js` desde `routes/` |
| `[MONGOOSE] Warning: the 'new' option ... is deprecated` | En Mongoose 9, `{ new: true }` cambió de nombre | Es solo un aviso. Para sacarlo: `{ returnDocument: 'after' }` (ej. en `updateUser`) |
| Me registro como admin mandando `"role": "admin"` | El register usa `User.create(req.body)` | Tomar solo `{ name, email, password }` (paso 3) |
| La password aparece en `/api/auth/me` | Falta `.select('-password')` en `verifyToken` | Ver paso 5 |
