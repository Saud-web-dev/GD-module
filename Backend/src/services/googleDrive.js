import { createWriteStream, existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { join } from 'node:path'

const EXPORTS_DIR = './exports'

// Create exports directory if it doesn't exist
if (!existsSync(EXPORTS_DIR)) {
  import('node:fs').then(fs => fs.mkdirSync(EXPORTS_DIR, { recursive: true }))
}

function getServiceAccountAuth() {
  try {
    let credentials
    
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      // Handle both string and object formats
      const credentialsData = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      credentials = typeof credentialsData === 'string' ? JSON.parse(credentialsData) : credentialsData
    } else {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not found in .env')
    }

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Missing client_email or private_key in credentials')
    }

    // Handle escaped newlines in private key
    const privateKey = credentials.private_key.replace(/\\n/g, '\n')

    return new google.auth.JWT({
      email: credentials.client_email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    })
  } catch (error) {
    console.error('❌ Auth error:', error.message)
    throw error
  }
}

export async function uploadExcelToGoogleDrive({ buffer, fileName, contentType, folderId } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('buffer must be a Buffer')
  if (!fileName) throw new Error('fileName is required')

  // First, save locally
  const localPath = join(EXPORTS_DIR, fileName)
  const writeStream = createWriteStream(localPath)
  
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
    writeStream.write(buffer)
    writeStream.end()
  })

  console.log(`📁 File saved locally: ${localPath}`)

  // Try to upload to Google Drive
  try {
    const auth = getServiceAccountAuth()
    const drive = google.drive({ version: 'v3', auth })

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ...(folderId ? { parents: [folderId] } : {}),
      },
      media: {
        mimeType: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Readable.from(buffer),
      },
      fields: 'id,name,webViewLink,size,createdTime',
    })

    console.log(`☁️ File uploaded to Google Drive: ${fileName}`)
    return response.data
  } catch (driveError) {
    console.warn(`⚠️  Google Drive upload failed, but file saved locally at: ${localPath}`)
    console.warn(`Error: ${driveError.message}`)
    
    // Return local path instead
    return {
      id: 'local',
      name: fileName,
      webViewLink: null,
      localPath: localPath,
      status: 'saved_locally',
      message: `File saved locally. Manual upload needed: ${localPath}`,
    }
  }
}
