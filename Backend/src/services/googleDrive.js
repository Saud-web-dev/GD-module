import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { join } from 'node:path'

const EXPORTS_DIR = './exports'

// Create exports directory if it doesn't exist
if (!existsSync(EXPORTS_DIR)) {
  mkdirSync(EXPORTS_DIR, { recursive: true })
}

/**
 * Get authenticated Google Drive client
 * 1. Checks for OAuth 2.0 tokens (google-tokens.json) -> Works with Personal Google Drive (15 GB free quota)
 * 2. Fallback to Service Account (service-account.json) -> For Google Workspace / Shared Drives
 */
async function getDriveClient() {
  const tokensPath = process.env.GOOGLE_TOKENS_PATH || join(process.cwd(), 'google-tokens.json')

  // 1. Try OAuth 2.0 first if tokens exist
  if (
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    existsSync(tokensPath)
  ) {
    try {
      console.log('🔐 Authenticating with Google OAuth 2.0 (User Account)...')
      const tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'))

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
      )

      oauth2Client.setCredentials(tokens)

      // Auto-save refreshed tokens when Google issues new tokens
      oauth2Client.on('tokens', (newTokens) => {
        try {
          const currentTokens = existsSync(tokensPath)
            ? JSON.parse(readFileSync(tokensPath, 'utf-8'))
            : {}
          const mergedTokens = { ...currentTokens, ...newTokens }
          writeFileSync(tokensPath, JSON.stringify(mergedTokens, null, 2))
          console.log('🔄 Google OAuth tokens refreshed and saved.')
        } catch (saveErr) {
          console.warn('⚠️ Could not auto-save refreshed tokens:', saveErr.message)
        }
      })

      const drive = google.drive({ version: 'v3', auth: oauth2Client })
      return { drive, authType: 'oauth' }
    } catch (oauthError) {
      console.warn('⚠️ OAuth authentication failed, trying Service Account fallback:', oauthError.message)
    }
  }

  // 2. Service Account Auth (fallback)
  let serviceAccount

  const serviceAccountPath = join(process.cwd(), 'config', 'service-account.json')

  if (existsSync(serviceAccountPath)) {
    console.log('📂 Loading Service Account from config file...')
    const fileContent = readFileSync(serviceAccountPath, 'utf-8')
    serviceAccount = JSON.parse(fileContent)
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('📂 Loading Service Account from .env...')
    try {
      serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    } catch (error) {
      throw new Error(
        'Service Account JSON parse error in .env'
      )
    }
  } else {
    throw new Error(
      'Authentication failed! No valid Google OAuth tokens (google-tokens.json) or Service Account found.'
    )
  }

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })

  const client = await auth.getClient()
  const drive = google.drive({ version: 'v3', auth: client })
  return { drive, authType: 'service_account' }
}

/**
 * Upload Excel file to Google Drive
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

  // Step 2: Upload to Google Drive
  try {
    const { drive, authType } = await getDriveClient()
    const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID

    console.log(`📤 Uploading to Google Drive (${authType}): ${fileName}`)

    // Create readable stream from buffer
    const bufferStream = Readable.from(buffer)

    const requestBody = {
      name: fileName,
      ...(targetFolderId ? { parents: [targetFolderId] } : {}),
    }

    // Upload file
    const response = await drive.files.create({
      requestBody,
      media: {
        mimeType: contentType,
        body: bufferStream,
      },
      fields: 'id, name, webViewLink, size',
      supportsAllDrives: true,
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
      console.error('ℹ️ Google Service Accounts have 0 MB storage quota on personal Google Drive (@gmail.com).')
      console.error('   Please use OAuth 2.0 authentication (google-tokens.json) or a Google Workspace Shared Drive.')
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
    const { drive } = await getDriveClient()
    const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID

    const response = await drive.files.list({
      q: targetFolderId ? `'${targetFolderId}' in parents` : undefined,
      pageSize: maxResults,
      fields: 'files(id, name, createdTime, size, webViewLink)',
      orderBy: 'createdTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
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
    const { drive } = await getDriveClient()
    const files = await listDriveFiles(folderId)

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    let deletedCount = 0

    for (const file of files) {
      const createdDate = new Date(file.createdTime)
      if (createdDate < cutoffDate) {
        await drive.files.delete({ fileId: file.id, supportsAllDrives: true })
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

