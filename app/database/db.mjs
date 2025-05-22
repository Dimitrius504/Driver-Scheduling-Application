import { MongoClient } from 'mongodb';
import dotenv from 'dotenv'
let dbInstance = null;
let clientInstance = null;

dotenv.config()

const uri = `${process.env.MONGO_URI}`

const connectToServer = async () => {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        dbInstance = client.db("driver-schedule");
        clientInstance = client;
        console.log("Successfully connected to MongoDB.");
        return dbInstance;
    } catch (e) {
        console.error("Failed to connect to MongoDB:", e);
        throw e;
    }
};

const getDb = () => {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call connectToServer first.');
    }
    return dbInstance;
};

const closeConnection = () => {
    if (clientInstance) {
        clientInstance.close();
        console.log("MongoDB connection closed.");
    }
};

export { connectToServer, getDb, closeConnection };
