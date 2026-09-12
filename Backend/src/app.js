import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import config from './config/environment.js'
import authRoutes from './routes/authRoutes.js'
import backupRoutes from './routes/backupRoutes.js'
import { getDatabaseStatus } from './config/database.js'

export function createApp() {
  const app = express()

  // Middleware
  app.use(cors({ origin: config.frontendUrl }))
  app.use(express.json())

  // Health check endpoint
  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      database: getDatabaseStatus(),
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
    })
  })

  // Routes
  app.use('/auth', authRoutes)
  app.use('/api', backupRoutes)

  // 404 handler
  app.use((_request, response) => {
    response.status(404).json({ message: 'Route not found' })
  })

  // Error handler
  app.use((error, _request, response, _next) => {
    console.error('Server error:', error)
    response.status(500).json({
      message: 'Internal server error',
      error: config.nodeEnv === 'development' ? error.message : undefined,
    })
  })

  return app
}

export default createApp
