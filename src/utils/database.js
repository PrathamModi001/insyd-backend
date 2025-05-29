const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = "mongodb+srv://prathammodi001:modimodi@cluster0.87gdpim.mongodb.net/insyd";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB; 