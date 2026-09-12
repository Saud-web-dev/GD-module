import express from 'express'
import { getAuthorizationUrl, handleAuthCallback } from '../services/googleAuth.js'

const router = express.Router()

/**
 * Google OAuth redirect
 */
router.get('/google', (_request, response) => {
  const authUrl = getAuthorizationUrl()
  response.redirect(authUrl)
})

/**
 * Google OAuth callback
 */
router.get('/google/callback', async (request, response) => {
  const { code } = request.query
  if (!code) return response.status(400).json({ message: 'No authorization code provided' })

  try {
    await handleAuthCallback(code)
    response.json({ message: 'Authentication successful! You can now use the export feature.' })
  } catch (error) {
    console.error('OAuth callback error:', error)
    response.status(500).json({ message: 'Authentication failed: ' + error.message })
  }
})

export default router
