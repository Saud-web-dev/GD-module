import { createExcelWorkbook } from '../utils/excelFormatter.js'
import { extractAllDatabasesCollections } from '../utils/dataExtract.js'
import { uploadExcelToGoogleDrive } from './googleDrive.js'

/**
 * Extract data from ALL databases and collections ONLY
 * This is the main function - extracts everything from MongoDB
 */
export async function createAndUploadCompleteBackup(options = {}) {
  const {
    uploadToDrive = true,
    workbookName,
    folderId,
    excludedDatabases = ['admin', 'config', 'local'],
  } = options

  console.log('🔍 Extracting ALL databases and collections...')
  const extractedData = await extractAllDatabasesCollections(
    process.env.MONGODB_URI,
    excludedDatabases,
  )

  if (extractedData.length === 0) {
    throw new Error('No data found in any database')
  }

  console.log(`✅ Found ${extractedData.length} collections`)

  // Format data for Excel creation - each collection gets its own sheet
  const formattedData = extractedData.map((item) => ({
    modelName: `${item.database}/${item.collectionName}`,
    collectionName: item.collectionName,
    database: item.database,
    data: item.data || [],
  }))

  const fileName =
    workbookName || `complete-backup-${new Date().toISOString().slice(0, 10)}`
  const workbook = await createExcelWorkbook(formattedData, {
    workbookName: fileName,
  })

  const result = {
    uploaded: false,
    uploadStatus: uploadToDrive === false ? 'skipped' : 'pending',
    fileName: workbook.fileName,
    databases: [...new Set(extractedData.map((d) => d.database))],
    collections: extractedData.map(({ database, collectionName, documentCount, data }) => ({
      database,
      collectionName,
      records: documentCount || data.length,
    })),
    totalRecords: extractedData.reduce((sum, item) => sum + (item.documentCount || item.data.length), 0),
    sheetCount: extractedData.length,
  }

  if (uploadToDrive === false) {
    console.log('✅ Backup created (upload skipped)')
    return result
  }

  console.log(`📤 Uploading to Google Drive...`)
  const driveFile = await uploadExcelToGoogleDrive({
    ...workbook,
    folderId: folderId || process.env.GOOGLE_DRIVE_FOLDER_ID,
  })

  console.log(`✅ Backup uploaded: ${driveFile.name}`)

  return {
    ...result,
    uploaded: true,
    uploadStatus: 'uploaded',
    driveFile,
  }
}

/**
 * Old function - kept for backward compatibility (but not recommended)
 * Use createAndUploadCompleteBackup instead
 */
export async function createAndUploadDatabaseExport(options = {}) {
  console.warn('⚠️  createAndUploadDatabaseExport is deprecated. Use createAndUploadCompleteBackup instead.')
  return createAndUploadCompleteBackup(options)
}
