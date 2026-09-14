/**
 * Google Authentication Service
 * Uses Service Account - No OAuth needed
 */

export function getAuthStatus() {
  return {
    authenticated: true,
    method: 'Service Account',
    message: 'Direct upload to Google Drive enabled'
  }
}
