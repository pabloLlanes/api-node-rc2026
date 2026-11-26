import jwt from 'jsonwebtoken'

// ======================================================
// verifyToken: revisa que la petición traiga un token válido
// El token viaja en el header:  Authorization: Bearer eyJhbGciOi...
// ======================================================
export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Falta el token" })
    }

    // "Bearer eyJhbGciOi..." -> nos quedamos con la parte del token
    const token = authHeader.split(' ')[1]

    try {
        // jwt.verify chequea la firma y la expiración. Si algo falla, LANZA un error
        const payload = jwt.verify(token, process.env.JWT_SECRET)

        // Guardamos los datos del usuario en req para usarlos en el controller
        req.user = payload // { id, name, email, iat, exp }
        next()             // todo OK -> sigue al controller
    } catch (error) {
        return res.status(401).json({ message: "Token inválido o vencido" })
    }
}
