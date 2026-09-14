import express from 'express'

const router = express.Router()

/**
 * Health check endpoint
 */
router.get('/status', (_request, response) => {
  response.json({ 
    message: 'Service Account authentication enabled',
    authenticated: true 
  })
})

export default router
