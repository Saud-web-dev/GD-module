import { connectDatabase, disconnectDatabase } from './config/database.js'
import config from './config/environment.js'
import { createApp } from './app.js'
import { startBackupScheduler } from './services/backupScheduler.js'

async function startServer() {
  try {
    // Connect to database
    await connectDatabase()

    // Create Express app
    const app = createApp()

    // Start HTTP server
    const server = app.listen(config.port, () => {
      console.log(`\n${'═'.repeat(60)}`)
      console.log(`🚀 Backend Server Started`)
      console.log(`${'═'.repeat(60)}`)
      console.log(`  URL: http://localhost:${config.port}`)
      console.log(`  Environment: ${config.nodeEnv}`)
      console.log(`  Database: Connected`)
      console.log(`${'═'.repeat(60)}\n`)

      // Start automatic backup scheduler if enabled
      if (config.backup.enabled) {
        console.log(`📦 Automatic backup scheduler enabled`)
        console.log(`  Interval: Every ${config.backup.intervalMinutes} minute(s)\n`)
        startBackupScheduler(config.backup.intervalMinutes)
      } else {
        console.log(`ℹ️  Automatic backup disabled`)
        console.log(`  Set ENABLE_AUTO_BACKUP=true to enable\n`)
      }
    })

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n⏸️  Received ${signal}, shutting down gracefully...`)
      server.close(async () => {
        console.log('🛑 Server closed')
        await disconnectDatabase()
        console.log('✅ Shutdown complete')
        process.exit(0)
      })
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    console.error('❌ Server startup failed:', error.message)
    process.exitCode = 1
  }
}

startServer()
