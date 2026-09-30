import mongoose from 'mongoose';
import dns from 'dns';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('[DevaSetu DB] MONGODB_URI not provided. Running in persistent fallback mode.');
    return;
  }

  // Set standard DNS servers to resolve MongoDB Atlas SRV records
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {
    // ignore if restricted
  }

  // Prevent uncaught error events from crashing the server process
  mongoose.connection.on('error', (err) => {
    // Handled gracefully so the server remains active in resilient mode
  });

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[DevaSetu DB] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`[DevaSetu DB] MongoDB connection notice: ${error.message}`);
    console.warn('[DevaSetu DB] Server operating with resilient local document persistence fallback.');
  }
}
