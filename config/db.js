const mongoose = require('mongoose');

// Serverless platforms (like Vercel) can run many short-lived function
// invocations at once, so we cache the connection instead of opening a
// fresh one on every request.
let cached = global._mongooseConn;
if (!cached) cached = global._mongooseConn = { conn: null, promise: null };

async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI — set it in .env locally, or in your Vercel project settings');
    if (!process.env.VERCEL) process.exit(1);
    throw new Error('Missing MONGO_URI');
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI).then(m => {
      console.log('MongoDB connected');
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    console.error('MongoDB connection failed:', err.message);
    if (!process.env.VERCEL) process.exit(1);
    throw err;
  }

  return cached.conn;
}

module.exports = connectDB;
