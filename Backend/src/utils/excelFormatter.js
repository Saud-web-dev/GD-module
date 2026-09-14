import ExcelJS from 'exceljs'

function flattenObject(value, prefix = '') {
  if (value === null || value === undefined) return { [prefix || 'value']: '' }
  if (Array.isArray(value)) return { [prefix || 'value']: JSON.stringify(value) }
  if (typeof value !== 'object' || value instanceof Date) return { [prefix || 'value']: value }

  return Object.entries(value).reduce(
    (result, [key, nestedValue]) => ({
      ...result,
      ...flattenObject(nestedValue, prefix ? `${prefix}.${key}` : key),
    }),
    {},
  )
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value)
  return value
}

export async function createExcelWorkbook(extractedData, { workbookName = 'database-export' } = {}) {
  if (!Array.isArray(extractedData)) throw new TypeError('extractedData must be an array')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'GD Uploader - Complete Backup'
  workbook.created = new Date()

  // Group collections by database
  const groupedByDatabase = {}
  for (const item of extractedData) {
    if (!groupedByDatabase[item.database]) {
      groupedByDatabase[item.database] = []
    }
    groupedByDatabase[item.database].push(item)
  }

  // Create one sheet per database
  for (const [database, collections] of Object.entries(groupedByDatabase)) {
    const worksheet = workbook.addWorksheet(database.slice(0, 31))
    
    if (collections.length === 0) continue

    // Row 1: Database name (merged header)
    const totalColumns = collections.length * 2
    worksheet.mergeCells(1, 1, 1, totalColumns)
    const dbHeaderCell = worksheet.getCell(1, 1)
    dbHeaderCell.value = database
    dbHeaderCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
    dbHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
    dbHeaderCell.alignment = { horizontal: 'center', vertical: 'center' }
    worksheet.getRow(1).height = 25

    // Row 2: Collection names
    let colIdx = 1
    for (const collection of collections) {
      const rows = Array.isArray(collection.data) ? collection.data : []
      worksheet.mergeCells(2, colIdx, 2, colIdx + 1)
      const collCell = worksheet.getCell(2, colIdx)
      collCell.value = `${collection.collectionName} (${rows.length})`
      collCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
      collCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      collCell.alignment = { horizontal: 'center', vertical: 'center' }
      colIdx += 2
    }
    worksheet.getRow(2).height = 20

    // Row 3: Key/Value headers
    colIdx = 1
    for (const _collection of collections) {
      worksheet.getCell(3, colIdx).value = 'key'
      worksheet.getCell(3, colIdx + 1).value = 'value'
      for (let i = colIdx; i <= colIdx + 1; i++) {
        const cell = worksheet.getCell(3, i)
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } }
        cell.alignment = { horizontal: 'center', vertical: 'center' }
      }
      colIdx += 2
    }
    worksheet.getRow(3).height = 18

    // Calculate max rows
    const maxRows = Math.max(...collections.map(c => (Array.isArray(c.data) ? c.data.length : 0)), 0)

    // Data rows - each document gets multiple rows (one per key-value pair)
    let currentExcelRow = 4
    
    for (let docIdx = 0; docIdx < maxRows; docIdx++) {
      // Find max fields needed for this document index across all collections
      let maxFieldsThisDoc = 0
      for (const collection of collections) {
        const rows = Array.isArray(collection.data) ? collection.data : []
        if (docIdx < rows.length) {
          const flatDoc = flattenObject(rows[docIdx])
          maxFieldsThisDoc = Math.max(maxFieldsThisDoc, Object.keys(flatDoc).length)
        }
      }

      // Create rows for each field
      for (let fieldIdx = 0; fieldIdx < maxFieldsThisDoc; fieldIdx++) {
        colIdx = 1
        
        for (const collection of collections) {
          const rows = Array.isArray(collection.data) ? collection.data : []
          
          if (docIdx < rows.length) {
            const flatDoc = flattenObject(rows[docIdx])
            const entries = Object.entries(flatDoc)
            
            if (fieldIdx < entries.length) {
              const [key, value] = entries[fieldIdx]
              worksheet.getCell(currentExcelRow, colIdx).value = key
              worksheet.getCell(currentExcelRow, colIdx + 1).value = normalizeCellValue(value)
            }
          }
          
          colIdx += 2
        }
        
        currentExcelRow++
      }
    }

    // Set column widths
    for (let col = 1; col <= totalColumns; col++) {
      worksheet.getColumn(col).width = 22
    }

    // Add borders to all cells
    for (let row = 1; row < currentExcelRow; row++) {
      for (let col = 1; col <= totalColumns; col++) {
        const cell = worksheet.getCell(row, col)
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
        cell.alignment = { wrapText: true, vertical: 'top' }
      }
    }
  }

  if (workbook.worksheets.length === 0) workbook.addWorksheet('No data')
  const buffer = await workbook.xlsx.writeBuffer()
  return {
    buffer: Buffer.from(buffer),
    fileName: `${workbookName.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
}
