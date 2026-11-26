import { Product } from "../models/Product.js";
import { User } from "../models/User.js";

// READ (todos) - GET /api/products  (pública)
export const getProducts = async (req, res) => {
    try {
        // populate('owner', 'name email') -> reemplaza el ObjectId del owner por { _id, name, email }
        const products = await Product.find().populate('owner', 'name email')
        res.status(200).json({ message: "request ok!", products })
    } catch (error) {
        res.status(500).json({ message: "Error al obtener los productos", error: error.message })
    }
}

// READ (uno) - GET /api/product/:id  (pública)
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('owner', 'name email')

        if (!product) {
            return res.status(404).json({ message: "Producto no encontrado" })
        }

        res.status(200).json({ message: "request ok!", product })
    } catch (error) {
        res.status(400).json({ message: "Id inválido", error: error.message })
    }
}

// CREATE - POST /api/product  (🔒 protegida: req.user lo carga verifyToken)
export const createProduct = async (req, res) => {
    try {
        const { name, description, price, stock, image } = req.body

        // 1) Creamos el producto con el dueño = usuario del token
        const newProduct = await Product.create({ name, description, price, stock, image, owner: req.user.id })

        // 2) Agregamos el _id del producto al array "products" del usuario
        //    $push -> agrega un elemento al array
        await User.findByIdAndUpdate(req.user.id, { $push: { products: newProduct._id } })

        res.status(201).json({ message: "OK product Created", newProduct })
    } catch (error) {
        res.status(400).json({ message: "Error al crear el producto", error: error.message })
    }
}

// UPDATE - PUT /api/product/:id
export const updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)

        if (!product) {
            return res.status(404).json({ message: "Producto no encontrado" })
        }

        // Solo pisamos los campos que vinieron en el body (el owner NO se puede cambiar)
        const { name, description, price, stock, image } = req.body
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            { name, description, price, stock, image },
            { new: true, runValidators: true } // runValidators: aplica las reglas del schema (ej: price >= 0)
        )

        res.status(200).json({ message: "OK product Updated", updatedProduct })
    } catch (error) {
        res.status(400).json({ message: "Error al actualizar el producto", error: error.message })
    }
}

// DELETE - DELETE /api/product/:id
export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)

        if (!product) {
            return res.status(404).json({ message: "Producto no encontrado" })
        }

        await Product.findByIdAndDelete(req.params.id)

        // Sacamos el _id del array "products" de su dueño
        //    $pull -> quita un elemento del array
        await User.findByIdAndUpdate(product.owner, { $pull: { products: product._id } })

        res.status(200).json({ message: "OK product Deleted", deletedProduct: product })
    } catch (error) {
        res.status(400).json({ message: "Error al eliminar el producto", error: error.message })
    }
}
