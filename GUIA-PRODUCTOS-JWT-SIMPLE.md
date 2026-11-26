# Guía simple: JWT + localStorage (con Productos)

En el proyecto hay **una sola ruta protegida de ejemplo**: `POST /api/product`.
Proteger el resto queda como ejercicio (ver el final).

---

## 1. El problema

HTTP **no tiene memoria**. Cada petición llega sola: si hacés login y después pedís crear un producto,
el servidor no sabe que sos el mismo que se logueó recién.

**Solución:** en el login el servidor te da un **token** (una credencial firmada).
Vos lo guardás y lo mandás en cada petición. El servidor lo revisa y así sabe quién sos.

```
  FRONTEND                                              BACKEND
     │                                                     │
  1  │── POST /api/auth/login { email, password } ────────▶│  bcrypt.compare  → ¿password OK?
     │                                                     │  jwt.sign        → crea el token
  2  │◀──────────── { token, user } ───────────────────────│
     │                                                     │
  3  │  localStorage.setItem('token', token)               │
     │                                                     │
  4  │── POST /api/product ───────────────────────────────▶│  verifyToken:
     │   Authorization: Bearer eyJhbGciOi...               │    jwt.verify → ¿firma OK? ¿vencido?
     │                                                     │    req.user = payload → next()
  5  │◀──────────── 201 { newProduct } ────────────────────│  createProduct usa req.user.id
```

---

## 2. ¿Qué es un JWT?

Un texto con **3 partes separadas por puntos**: `HEADER.PAYLOAD.FIRMA`

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjY2NTAuLi4iLCJuYW1lIjoiQW5hIiwiaWF0IjoxNzk1NzI1MzkyLCJleHAiOjE3OTU3MzI1OTJ9.SWxe6GZs1sMS...
```

| Parte | Contiene |
|---|---|
| **Header** | El algoritmo: `{ "alg": "HS256", "typ": "JWT" }` |
| **Payload** | Nuestros datos: `{ "id": "6650...", "name": "Ana", "email": "...", "iat": 1795725392, "exp": 1795732592 }` |
| **Firma** | Se calcula con header + payload + `JWT_SECRET`. Prueba que **lo hizo nuestro server** y que **nadie lo tocó** |

- `iat` (*issued at*) = cuándo se creó · `exp` (*expiration*) = cuándo vence. Los agrega `jsonwebtoken` solo.

> ⚠️ **El payload NO está encriptado**, solo está en base64: cualquiera lo lee (pegá un token en [jwt.io](https://jwt.io)).
> **Nunca** pongas la password ni datos sensibles.
>
> ✅ **Pero nadie lo puede modificar.** Si alguien cambia `"name":"Ana"` por `"name":"Admin"`, la firma deja de coincidir y el server lo rechaza.
>
> Es como la pulsera de un recital: cualquiera ve lo que dice, pero nadie la puede falsificar.

---

## 3. Instalar y configurar

```bash
npm install jsonwebtoken
```

En el `.env` va **solo la clave secreta** (cualquier texto largo; nunca se sube a GitHub):

```
JWT_SECRET=un_texto_largo_y_secreto
```

La **duración** del token está fija en el código, en [controllers/auth.controller.js](controllers/auth.controller.js):

```js
const JWT_EXPIRES_IN = '2h'   // formatos: '60s', '15m', '2h', '7d'
```

> 💡 Para mostrar en clase qué pasa cuando vence: ponelo en `'30s'`, logueate, esperá y probá crear un producto.

---

## 4. CREAR el token (en el login)

[controllers/auth.controller.js](controllers/auth.controller.js), función `login`:

```js
// 1) ¿Existe el usuario?
const user = await User.findOne({ email })
if (!user) return res.status(401).json({ message: "Email o password incorrectos" })

// 2) ¿La password es correcta?
const passwordOK = await bcrypt.compare(password, user.password)
if (!passwordOK) return res.status(401).json({ message: "Email o password incorrectos" })

// 3) Armamos el payload: lo que queremos "llevar" dentro del token
const payload = { id: user._id, name: user.name, email: user.email }

// 4) Firmamos: jwt.sign(payload, clave secreta, opciones)
const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

// 5) Se lo mandamos al cliente
res.status(200).json({ message: "Login correcto", token, user: { ... } })
```

> El token **solo se crea en el login**. El register crea el usuario pero no devuelve token.

---

## 5. VALIDAR el token (middleware `verifyToken`)

Un **middleware** es una función que corre **antes** del controller. Puede cortar la petición
(`return res.status(...)`) o dejarla seguir (`next()`).

[middlewares/auth.middleware.js](middlewares/auth.middleware.js):

```js
export const verifyToken = (req, res, next) => {
    // PASO A: leer el header  ->  "Bearer eyJhbGciOi..."
    const authHeader = req.headers.authorization

    // PASO B: si no vino, o no empieza con "Bearer ", cortamos con 401
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Falta el token" })
    }

    // PASO C: separar "Bearer" del token  ->  ["Bearer", "eyJhbGciOi..."]
    const token = authHeader.split(' ')[1]

    try {
        // PASO D: jwt.verify hace 2 chequeos:
        //   1. recalcula la firma con JWT_SECRET -> ¿coincide? (nadie lo modificó)
        //   2. mira "exp"                       -> ¿todavía no venció?
        // Si alguno falla, LANZA un error -> cae en el catch
        const payload = jwt.verify(token, process.env.JWT_SECRET)

        // PASO E: guardamos los datos en req para que el controller sepa quién es
        req.user = payload   // { id, name, email, iat, exp }

        // PASO F: todo OK -> que siga al controller
        next()
    } catch (error) {
        return res.status(401).json({ message: "Token inválido o vencido" })
    }
}
```

### ¿Qué casos rechaza `jwt.verify`?

| Situación | `error.name` | Respuesta |
|---|---|---|
| Token vencido (pasó `exp`) | `TokenExpiredError` | 401 |
| Alguien modificó el payload | `JsonWebTokenError` (invalid signature) | 401 |
| Firmado con otro `JWT_SECRET` | `JsonWebTokenError` (invalid signature) | 401 |
| Texto cualquiera (`abc.def.ghi`) | `JsonWebTokenError` | 401 |

---

## 6. Usar el middleware en una ruta

[routes/product.routes.js](routes/product.routes.js):

```js
router.post('/product', verifyToken, createProduct)
//                      ^^^^^^^^^^^  ^^^^^^^^^^^^^
//                      1° ¿token OK?  2° recién ahí se ejecuta
```

Y en el controller usamos `req.user`, que lo cargó el middleware:

```js
export const createProduct = async (req, res) => {
    const { name, description, price, stock, image } = req.body

    // el dueño sale del TOKEN, no del body (así nadie puede crear productos a nombre de otro)
    const newProduct = await Product.create({ name, description, price, stock, image, owner: req.user.id })

    await User.findByIdAndUpdate(req.user.id, { $push: { products: newProduct._id } })
    ...
}
```

---

## 7. Frontend: guardar y mandar el token (localStorage)

Ver [public/index.html](public/index.html).

```js
// 1) LOGIN -> guardar
const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
})
const data = await res.json()

localStorage.setItem('token', data.token)
localStorage.setItem('user', JSON.stringify(data.user)) // localStorage solo guarda strings

// 2) LEER (por ejemplo al recargar la página: si hay token, sigue logueado)
const token = localStorage.getItem('token')
const user = JSON.parse(localStorage.getItem('user'))

// 3) MANDAR en la ruta protegida
await fetch('http://localhost:5000/api/product', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`       // 👈 acá viaja el token
    },
    body: JSON.stringify({ name: 'Mate', price: 5000 })
})

// 4) LOGOUT = borrar el token (el servidor no guarda nada, así que no hay que avisarle)
localStorage.removeItem('token')
localStorage.removeItem('user')
```

> Si el server responde **401** con un token guardado, el token venció: borrarlo y mandar al login.

---

## 8. Relación User ↔ Product

```js
// models/User.js  -> un usuario tiene MUCHOS productos
products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]

// models/Product.js -> cada producto tiene UN dueño
owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
```

- **Crear** → `owner = req.user.id` y `$push` del id al array del usuario.
- **Borrar producto** → `$pull` del id del array de su dueño.
- **Borrar usuario** → `Product.deleteMany({ owner: id })`.
- **populate** → cambia los ObjectId por los documentos: `GET /api/user/:id` trae sus productos, `GET /api/products` trae el nombre del dueño.

---

## 9. Probar

1. `npm run dev`
2. Abrir [public/index.html](public/index.html) con Live Server
3. Registrarse → Login → DevTools › **Application › Local Storage** → ver el `token`
4. Copiar el token en [jwt.io](https://jwt.io) y ver el payload
5. Crear un producto (funciona) → Cerrar sesión → intentar por Postman sin token → **401**

**Postman:** login → copiar `token` → en `POST /api/product` ir a **Authorization › Bearer Token** y pegarlo.

| Método | Ruta | Token |
|---|---|---|
| POST | `/api/auth/register` | ❌ |
| POST | `/api/auth/login` | ❌ (devuelve el token) |
| GET | `/api/products` · `/api/product/:id` | ❌ |
| **POST** | **`/api/product`** | **🔒 sí** |
| PUT / DELETE | `/api/product/:id` | ❌ (ejercicio) |
| GET / POST / PUT / DELETE | `/api/users` · `/api/user/:id` | ❌ (ejercicio) |

---

## 10. Ejercicios para los alumnos

1. Proteger `PUT` y `DELETE /api/product/:id` con `verifyToken`.
2. Que **solo el dueño** pueda editar o borrar su producto: comparar `product.owner.toString()` con `req.user.id` y si no coincide responder **403**.
3. Crear `GET /api/auth/me` (protegida) que devuelva el usuario del token con sus productos (`.populate('products')`), sin la password.
4. Crear `GET /api/my-products` (protegida) con los productos del usuario logueado.
5. Proteger las rutas de `/api/user`.
6. En el middleware, distinguir el mensaje: si `error.name === 'TokenExpiredError'` → "El token venció, volvé a loguearte".

> **401** = "no sé quién sos" (falta token o no sirve) · **403** = "sé quién sos, pero no tenés permiso"

---

## Errores comunes

| Mensaje | Causa |
|---|---|
| `Falta el token` | No mandaste el header, o no empieza con `Bearer ` (con espacio) |
| `Token inválido o vencido` | Token mal copiado, venció, o cambiaste el `JWT_SECRET` |
| `secretOrPrivateKey must have a value` | Falta `JWT_SECRET` en el `.env` (reiniciar el server después de editarlo) |
| `Cannot read properties of undefined (reading 'id')` | Usaste `req.user` en una ruta **sin** `verifyToken` |
