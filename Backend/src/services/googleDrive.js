import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXPORTS_DIR = './exports'

// Create exports directory if it doesn't exist
if (!existsSync(EXPORTS_DIR)) {
  mkdirSync(EXPORTS_DIR, { recursive: true })
}

/**
 * Get authenticated Google Drive client using Service Account
 * NO OAUTH REQUIRED - Works automatically!
 */
async function getDriveClient() {
  let serviceAccount
  
  // Try reading from file first (recommended)
  const serviceAccountPath = join(process.cwd(), 'config', 'service-account.json')
  
  if (existsSync(serviceAccountPath)) {
    console.log('📂 Loading Service Account from config file...')
    const fileContent = readFileSync(serviceAccountPath, 'utf-8')
    serviceAccount = JSON.parse(fileContent)
  } else {
    // Fallback to .env variable
    console.log('📂 Loading Service Account from .env...')
    try {
      serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    } catch (error) {
      throw new Error(
        'Service Account not found! Create config/service-account.json or set GOOGLE_SERVICE_ACCOUNT_JSON in .env'
      )
    }
  }

  // Create JWT auth client
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })

  // Get authenticated client
  const client = await auth.getClient()
  
  // Create Drive API client
  const drive = google.drive({ version: 'v3', auth: client })
  
  return drive
}

/**
 * Upload Excel file to Google Drive using Service Account
 * NO manual OAuth required - automatic upload!
 */
export async function uploadExcelToGoogleDrive({ buffer, fileName, contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', folderId } = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('buffer must be a Buffer')
  }
  if (!fileName) {
    throw new Error('fileName is required')
  }

  // Ensure fileName has .xlsx extension
  if (!fileName.endsWith('.xlsx')) {
    fileName = `${fileName}.xlsx`
  }

  // Step 1: Save locally first (always backup locally)
  const localPath = join(EXPORTS_DIR, fileName)
  const writeStream = createWriteStream(localPath)
  
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
    writeStream.write(buffer)
    writeStream.end()
  })

  console.log(`📁 File saved locally: ${localPath}`)

  // Step 2: Upload to Google Drive using Service Account
  try {
    console.log('🔐 Authenticating with Service Account...')
    const drive = await getDriveClient()

    console.log(`📤 Uploading to Google Drive: ${fileName}`)
    
    // Create readable stream from buffer
    const bufferStream = Readable.from(buffer)

    // Upload file
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId || process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: contentType,
        body: bufferStream,
      },
      fields: 'id, name, webViewLink, size',
    })

    const file = response.data

    console.log(`✅ Uploaded to Google Drive!`)
    console.log(`   File ID: ${file.id}`)
    console.log(`   View: ${file.webViewLink}`)

    return {
      id: file.id,
      name: file.name,
      webViewLink: file.webViewLink,
      localPath: localPath,
      downloadPath: `/download/${fileName}`,
      status: 'uploaded',
      message: 'File uploaded to Google Drive successfully!',
      size: file.size || buffer.length,
    }
  } catch (error) {
    // Check if it's a quota error
    if (error.message && error.message.includes('storage quota')) {
      console.error('❌ Service Account has no storage quota!')
      console.error('')
      console.error('🔧 SOLUTION:')
      console.error('   1. Go to your Google Drive')
      console.error('   2. Right-click on the folder you want to use')
      console.error('   3. Click "Share"')
      console.error('   4. Add this email: gd-uploader@gd-uploader-saud.iam.gserviceaccount.com')
      console.error('   5. Give "Editor" permission')
      console.error('   6. Click Send')
      console.error('')
      console.error('   OR use a Shared Drive (Team Drive)')
      console.error('')
    } else {
      console.error('❌ Google Drive upload failed:', error.message)
    }
    
    // Return local file info even if Drive upload fails
    return {
      id: 'local-only',
      name: fileName,
      webViewLink: null,
      localPath: localPath,
      downloadPath: `/download/${fileName}`,
      status: 'local_only',
      message: `Saved locally. Drive upload failed: ${error.message}`,
      size: buffer.length,
      error: error.message,
    }
  }
}

/**
 * List files in Google Drive folder
 */
export async function listDriveFiles(folderId, maxResults = 100) {
  try {
    const drive = await getDriveClient()
    
    const response = await drive.files.list({
      q: `'${folderId || process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents`,
      pageSize: maxResults,
      fields: 'files(id, name, createdTime, size, webViewLink)',
      orderBy: 'createdTime desc',
    })

    return response.data.files
  } catch (error) {
    console.error('Failed to list files:', error.message)
    return []
  }
}

/**
 * Delete old backup files (older than X days)
 */
export async function deleteOldBackups(folderId, daysOld = 30) {
  try {
    const drive = await getDriveClient()
    const files = await listDriveFiles(folderId)
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    
    let deletedCount = 0
    
    for (const file of files) {
      const createdDate = new Date(file.createdTime)
      if (createdDate < cutoffDate) {
        await drive.files.delete({ fileId: file.id })
        console.log(`🗑️ Deleted old backup: ${file.name}`)
        deletedCount++
      }
    }
    
    console.log(`✅ Deleted ${deletedCount} old backup(s)`)
    return deletedCount
  } catch (error) {
    console.error('Failed to delete old backups:', error.message)
    return 0
  }
}
