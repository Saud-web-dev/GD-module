import { connectDatabase } from '../config/database.js'
import config from '../config/environment.js'
import { startBackupScheduler } from '../services/backupScheduler.js'

async function startScheduler() {
  try {
    await connectDatabase()
    startBackupScheduler(config.backup.intervalMinutes)
  } catch (error) {
    console.error('❌ Scheduler startup failed:', error.message)
    process.exit(1)
  }
}

startScheduler()
