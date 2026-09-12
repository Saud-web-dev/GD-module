import mongoose from 'mongoose'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DEFAULT_EXCLUDED_MODELS = new Set(['system.indexes'])
const EXCLUDED_SYSTEM_COLLECTIONS = new Set(['system.indexes', 'system.profile', 'system.views'])

function serializeValue(value) {
  if (value === null || value === undefined) return value
  if (value instanceof mongoose.Types.ObjectId) return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (Array.isArray(value)) return value.map(serializeValue)

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeValue(nestedValue)]),
    )
  }

  return value
}

async function importModelFiles(modelsDirectory) {
  try {
    const modelFiles = await readdir(modelsDirectory)

    await Promise.all(
      modelFiles
        .filter((file) => /\.(js|mjs)$/.test(file))
        .map((file) => import(pathToFileURL(`${modelsDirectory}/${file}`).href)),
    )
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

export async function extractAllModels({
  modelsDirectory = fileURLToPath(new URL('../models/', import.meta.url)),
  excludedModels = DEFAULT_EXCLUDED_MODELS,
  modelNames = [],
  queryOptions = {},
} = {}) {
  await importModelFiles(modelsDirectory)

  let selectedModels = mongoose.modelNames()

  if (Array.isArray(modelNames) && modelNames.length > 0) {
    selectedModels = selectedModels.filter((name) => modelNames.includes(name))
  }

  selectedModels = selectedModels.filter((name) => !excludedModels.has(name))

  const extractedData = []

  for (const modelName of selectedModels) {
    const model = mongoose.model(modelName)
    const documents = await model.find({}, null, queryOptions).lean().exec()

    extractedData.push({
      modelName,
      collectionName: model.collection.name,
      data: documents.map(serializeValue),
    })
  }

  return extractedData
}

/**
 * Extract data from all collections across all databases in MongoDB
 * @param {string} mongoUri - MongoDB connection URI
 * @param {Array<string>} excludedDatabases - Databases to exclude from extraction
 * @returns {Promise<Array>} Array of objects containing database name, collection name, and documents
 */
export async function extractAllDatabasesCollections(
  mongoUri = process.env.MONGODB_URI,
  excludedDatabases = ['admin', 'config', 'local'],
) {
  const adminDb = mongoose.connection.getClient().db('admin')
  const databases = await adminDb.admin().listDatabases()

  const extractedData = []

  for (const dbInfo of databases.databases) {
    const dbName = dbInfo.name

    // Skip excluded databases
    if (excludedDatabases.includes(dbName)) {
      continue
    }

    try {
      const db = mongoose.connection.getClient().db(dbName)
      const collections = await db.listCollections().toArray()

      for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name

        // Skip system collections
        if (EXCLUDED_SYSTEM_COLLECTIONS.has(collectionName)) {
          continue
        }

        const collection = db.collection(collectionName)
        const documents = await collection.find({}).toArray()

        extractedData.push({
          database: dbName,
          collectionName,
          documentCount: documents.length,
          data: documents.map(serializeValue),
        })
      }
    } catch (error) {
      console.error(`Error extracting data from database ${dbName}:`, error.message)
      extractedData.push({
        database: dbName,
        error: error.message,
        collectionName: null,
        data: [],
      })
    }
  }

  return extractedData
}

/**
 * Extract data from specific databases only
 * @param {string} mongoUri - MongoDB connection URI
 * @param {Array<string>} databaseNames - Specific databases to extract from
 * @returns {Promise<Array>} Array of objects containing database name, collection name, and documents
 */
export async function extractSpecificDatabases(mongoUri = process.env.MONGODB_URI, databaseNames = []) {
  const extractedData = []

  for (const dbName of databaseNames) {
    try {
      const db = mongoose.connection.getClient().db(dbName)
      const collections = await db.listCollections().toArray()

      for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name

        // Skip system collections
        if (EXCLUDED_SYSTEM_COLLECTIONS.has(collectionName)) {
          continue
        }

        const collection = db.collection(collectionName)
        const documents = await collection.find({}).toArray()

        extractedData.push({
          database: dbName,
          collectionName,
          documentCount: documents.length,
          data: documents.map(serializeValue),
        })
      }
    } catch (error) {
      console.error(`Error extracting data from database ${dbName}:`, error.message)
      extractedData.push({
        database: dbName,
        error: error.message,
        collectionName: null,
        data: [],
      })
    }
  }

  return extractedData
}

export { serializeValue }
