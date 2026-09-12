import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // Google OAuth
  googleOAuth: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  },
  
  // Google Drive
  googleDrive: {
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    tokensPath: process.env.GOOGLE_TOKENS_PATH || './google-tokens.json',
  },
  
  // Backup Configuration
  backup: {
    enabled: process.env.ENABLE_AUTO_BACKUP === 'true',
    intervalMinutes: parseInt(process.env.BACKUP_INTERVAL_MINUTES || '60'),
    excludedDatabases: ['admin', 'config', 'local'],
  },
}

// Validate required configuration
function validateConfig() {
  const required = ['mongoUri', 'googleOAuth.clientId', 'googleOAuth.clientSecret']
  const missing = []
  
  for (const key of required) {
    const keys = key.split('.')
    let value = config
    for (const k of keys) {
      value = value?.[k]
    }
    if (!value) {
      missing.push(key)
    }
  }
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing configuration: ${missing.join(', ')}`)
  }
}

validateConfig()

export default config
