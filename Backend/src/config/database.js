import mongoose from 'mongoose'

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required')
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })
    console.log('✅ MongoDB connected successfully')
    return mongoose.connection
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message)
    throw error
  }
}

export async function disconnectDatabase() {
  try {
    await mongoose.disconnect()
    console.log('✅ MongoDB disconnected')
  } catch (error) {
    console.error('❌ Disconnect error:', error.message)
  }
}

export function getDatabaseStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  }
  return states[mongoose.connection.readyState] || 'unknown'
}
