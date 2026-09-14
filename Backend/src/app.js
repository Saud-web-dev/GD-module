import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import config from './config/environment.js'
import authRoutes from './routes/authRoutes.js'
import backupRoutes from './routes/backupRoutes.js'
import { getDatabaseStatus } from './config/database.js'

const __dirname = join(fileURLToPath(import.meta.url), '..')

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

  // Download endpoint
  app.get('/download/:fileName', (request, response) => {
    const { fileName } = request.params
    const filePath = join(__dirname, '..', 'exports', fileName)
    
    // Security: prevent path traversal
    if (!filePath.startsWith(join(__dirname, '..', 'exports'))) {
      return response.status(400).json({ message: 'Invalid file' })
    }

    response.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err)
        response.status(500).json({ message: 'Download failed' })
      }
    })
  })

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
