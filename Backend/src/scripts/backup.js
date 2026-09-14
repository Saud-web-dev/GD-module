import '../config/environment.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { createAndUploadCompleteBackup } from '../services/backupService.js'

async function runBackup() {
  try {
    console.log('🚀 Starting manual backup...')
    console.log(`⏰ ${new Date().toLocaleString()}`)
    console.log('─'.repeat(50))

    await connectDatabase()

    const result = await createAndUploadCompleteBackup({
      uploadToDrive: true,
      excludedDatabases: ['admin', 'config', 'local'],
    })

    console.log('─'.repeat(50))
    console.log('\n📊 BACKUP SUMMARY:')
    console.log(`  Databases: ${result.databases.join(', ')}`)
    console.log(`  Collections: ${result.collections.length}`)
    console.log(`  Total Records: ${result.totalRecords}`)
    console.log(`  File Name: ${result.fileName}`)
    console.log(`  Upload Status: ${result.uploadStatus}`)

    if (result.uploaded && result.driveFile) {
      console.log(`\n✅ Successfully uploaded to Google Drive!`)
      console.log(`  Link: ${result.driveFile.webViewLink}`)
    } else if (result.driveFile?.localPath) {
      console.log(`\n⚠️  File saved locally (Drive upload failed)`)
      console.log(`  Path: ${result.driveFile.localPath}`)
    }

    console.log('\n✅ Backup completed successfully!')
  } catch (error) {
    console.error('\n❌ Backup failed:')
    console.error(`  Error: ${error.message}`)
    process.exit(1)
  } finally {
    await disconnectDatabase()
  }
}

runBackup()
