import mongoose from "mongoose"

// Se conecta a MongoDB. Si falla, lanza el error para que lo maneje quien la llama
export const connectDB = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');
}
