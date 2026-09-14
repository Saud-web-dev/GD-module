import express from 'express'
import mongoose from 'mongoose'
import { createAndUploadCompleteBackup } from '../services/backupService.js'
import { getBackupStatus } from '../services/backupScheduler.js'

const router = express.Router()

/**
 * Complete backup - Extract ALL databases and collections
 * Direct upload to Google Drive (Service Account)
 */
router.post('/exports', async (request, response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return response.status(503).json({ message: 'Database is not connected' })
    }

    const result = await createAndUploadCompleteBackup({
      uploadToDrive: true,
      workbookName: request.body?.workbookName,
      folderId: request.body?.folderId,
      excludedDatabases: request.body?.excludedDatabases || ['admin', 'config', 'local'],
    })
    return response.status(201).json({ message: 'Backup created and uploaded successfully', ...result })
  } catch (error) {
    console.error('Backup failed:', error)
    return response.status(500).json({ message: error.message || 'Backup failed' })
  }
})

/**
 * Get backup status
 */
router.get('/backup/status', (_request, response) => {
  response.json(getBackupStatus())
})

export default router
