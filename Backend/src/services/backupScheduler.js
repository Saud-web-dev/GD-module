import mongoose from 'mongoose'
import { createAndUploadCompleteBackup } from './backupService.js'
import dotenv from 'dotenv'

dotenv.config()

let isBackupRunning = false
let lastBackupTime = null
let backupCount = 0
let totalBackups = 0

/**
 * Connect to MongoDB
 */
async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return // Already connected
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })
    console.log('✅ MongoDB connected')
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message)
    throw error
  }
}

/**
 * Perform backup operation
 */
async function performBackup() {
  if (isBackupRunning) {
    console.log('⚠️  Backup already in progress, skipping...')
    return
  }

  isBackupRunning = true
  const startTime = Date.now()
  const timestamp = new Date().toLocaleString()

  try {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`📦 BACKUP #${++totalBackups} - ${timestamp}`)
    console.log(`${'═'.repeat(60)}`)

    await connectToDatabase()

    const result = await createAndUploadCompleteBackup({
      uploadToDrive: true,
      excludedDatabases: ['admin', 'config', 'local'],
    })

    lastBackupTime = new Date()
    backupCount++

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('\n📊 BACKUP SUMMARY:')
    console.log(`  └─ Databases: ${result.databases.join(', ')}`)
    console.log(`  └─ Collections: ${result.collections.length}`)
    console.log(`  └─ Total Records: ${result.totalRecords.toLocaleString()}`)
    console.log(`  └─ File Size: ${(result.driveFile?.size || 0).toLocaleString()} bytes`)
    console.log(`  └─ Duration: ${duration}s`)
    console.log(`  └─ Status: ✅ SUCCESS`)

    if (result.uploaded && result.driveFile?.webViewLink) {
      console.log(`\n☁️  Google Drive Link: ${result.driveFile.webViewLink}`)
    }
  } catch (error) {
    console.error('\n❌ BACKUP FAILED:')
    console.error(`  Error: ${error.message}`)
  } finally {
    isBackupRunning = false
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n⏱️  Execution time: ${duration}s`)
    console.log(`${'═'.repeat(60)}\n`)
  }
}

/**
 * Start scheduler with specified interval
 * @param {number} intervalMinutes - Interval in minutes
 */
export function startBackupScheduler(intervalMinutes = 60) {
  console.log(`\n${'╔' + '═'.repeat(58) + '╗'}`)
  console.log(`║ 🕐 BACKUP SCHEDULER STARTED                              ║`)
  console.log(`║ Interval: Every ${intervalMinutes} minute(s)${' '.repeat(32 - String(intervalMinutes).length)}║`)
  console.log(`║ Next backup: ${new Date(Date.now() + intervalMinutes * 60000).toLocaleString()}${' '.repeat(23 - new Date(Date.now() + intervalMinutes * 60000).toLocaleString().length)}║`)
  console.log(`╚${'═'.repeat(58)}╝\n`)

  // First backup immediately
  performBackup()

  // Then schedule periodic backups
  const intervalMs = intervalMinutes * 60 * 1000
  const scheduledInterval = setInterval(() => {
    performBackup()
  }, intervalMs)

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n⏸️  Stopping backup scheduler...')
    clearInterval(scheduledInterval)

    // Print statistics
    console.log(`\n📈 SCHEDULER STATISTICS:`)
    console.log(`  └─ Total backups: ${totalBackups}`)
    console.log(`  └─ Successful: ${backupCount}`)
    console.log(`  └─ Failed: ${totalBackups - backupCount}`)
    if (lastBackupTime) {
      console.log(`  └─ Last backup: ${lastBackupTime.toLocaleString()}`)
    }

    await mongoose.disconnect()
    console.log('✅ Scheduler stopped\n')
    process.exit(0)
  })

  return scheduledInterval
}

/**
 * Get scheduler status
 */
export function getBackupStatus() {
  return {
    isRunning: isBackupRunning,
    lastBackupTime,
    totalBackups,
    successfulBackups: backupCount,
    failedBackups: totalBackups - backupCount,
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const interval = process.env.BACKUP_INTERVAL_MINUTES || 60
  startBackupScheduler(parseInt(interval))
}
