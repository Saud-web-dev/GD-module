import ExcelJS from 'exceljs'

function safeSheetName(name, usedNames) {
  const baseName = String(name || 'Sheet')
    .replace(/[\\/*?:[\]]/g, ' ')
    .replace(/\//g, '-')
    .trim()
    .slice(0, 31) || 'Sheet'
  let sheetName = baseName
  let suffix = 1
  while (usedNames.has(sheetName)) {
    const suffixText = `_${suffix++}`
    sheetName = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`
  }
  usedNames.add(sheetName)
  return sheetName
}

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
  const usedSheetNames = new Set()

  for (const modelExport of extractedData) {
    const rows = Array.isArray(modelExport.data) ? modelExport.data : []
    const worksheet = workbook.addWorksheet(safeSheetName(modelExport.modelName, usedSheetNames))
    const flattenedRows = rows.map((row) => flattenObject(row))
    const columns = [...new Set(flattenedRows.flatMap((row) => Object.keys(row)))]

    // Header with collection info
    worksheet.addRow([
      `Model: ${modelExport.modelName}`,
      `Collection: ${modelExport.collectionName}`,
      `Records: ${rows.length}`,
    ])
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }

    if (columns.length > 0) {
      worksheet.addRow(columns)
      worksheet.getRow(2).font = { bold: true }
      worksheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9F99D' } }
      for (const row of flattenedRows) {
        worksheet.addRow(columns.map((column) => normalizeCellValue(row[column])))
      }
      worksheet.autoFilter = { from: 'A2', to: `${String.fromCharCode(64 + Math.min(columns.length, 26))}2` }
      worksheet.views = [{ state: 'frozen', ySplit: 2 }]
      worksheet.columns.forEach((column) => {
        column.width = Math.min(Math.max(column.header?.length || 12, 12), 40)
      })
    } else {
      worksheet.addRow(['No records found'])
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
