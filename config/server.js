// Levanta el servidor HTTP en el puerto del .env
// Recibe la app de Express como parámetro

const PORT = process.env.PORT

export const startServer = (app) => {

    app.listen(PORT, () => {
        console.log(`✅ Api corriendo en el puerto ${PORT}`)
    });

}
