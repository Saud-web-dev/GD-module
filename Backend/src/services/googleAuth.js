import { writeFileSync } from 'node:fs'
import { google } from 'googleapis'

const TOKEN_PATH = process.env.GOOGLE_TOKENS_PATH || './google-tokens.json'

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

export function getAuthorizationUrl() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
  )
  const scopes = ['https://www.googleapis.com/auth/drive.file']

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  })

  return authUrl
}

export async function handleAuthCallback(code) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
  )
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2))

  return tokens
}

export function getOAuthClientWithToken() {
  return getServiceAccountAuth()
}
