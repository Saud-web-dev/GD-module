/**
 * Entry point for the application
 * Redirects to src/server.js
 */

import('./src/server.js').catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
