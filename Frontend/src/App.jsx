import { useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function App() {
  const [health, setHealth] = useState('checking')
  const [workbookName, setWorkbookName] = useState('database-export')
  const [folderId, setFolderId] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((response) => response.json())
      .then((data) => setHealth(data.database === 'connected' ? 'connected' : 'offline'))
      .catch(() => setHealth('offline'))
  }, [])

  function handleExport(event) {
    event.preventDefault()
    setIsExporting(true)
    setError('')
    setResult(null)

    fetch(`${API_URL}/api/exports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workbookName, folderId: folderId || undefined }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message?.toLowerCase().includes('error') || data.message?.toLowerCase().includes('failed')) {
          setError(data.message || 'Export failed')
        } else {
          setResult(data)
          setError('')
        }
        setIsExporting(false)
      })
      .catch((requestError) => {
        setError(requestError.message)
        setIsExporting(false)
      })
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">GD Uploader / MERN utility</p>
        <div className="hero-heading">
          <h1>Move your MongoDB data to Drive, cleanly.</h1>
          <span className={`status-dot ${health}`} aria-label={`Backend ${health}`} />
        </div>
        <p className="hero-copy">Automatically extracts all databases and collections into a structured Excel workbook.</p>
      </section>

      <section className="workspace-grid">
        <form className="export-form" onSubmit={handleExport}>
          <div className="section-heading">
            <div><span className="section-index">01</span><h2>Prepare export</h2></div>
            <span className="connection-label">Backend: {health}</span>
          </div>

          <label>
            Workbook name
            <input value={workbookName} onChange={(event) => setWorkbookName(event.target.value)} required />
          </label>
          <label>
            Drive folder ID <span>(optional - uses .env default)</span>
            <input value={folderId} onChange={(event) => setFolderId(event.target.value)} placeholder="Leave empty for default" />
          </label>
          <button type="submit" disabled={isExporting || health === 'offline'}>
            {isExporting ? 'Extracting & uploading...' : 'Extract & upload to Google Drive'} <span>↗</span>
          </button>
          {error && <p className="message error">{error}</p>}
        </form>

        <aside className="result-panel">
          <div className="section-heading"><div><span className="section-index">02</span><h2>Latest result</h2></div></div>
          {result ? (
            <>
              <div className="success-mark">✓</div>
              <p className="result-title">Export ready!</p>
              <p className="file-name">{result.fileName}</p>
              <div className="model-list">
                <p style={{fontSize: '0.9em', color: '#666', marginBottom: '10px'}}>
                  Databases: <strong>{result.databases?.join(', ') || 'N/A'}</strong>
                </p>
                <p style={{fontSize: '0.9em', color: '#666', marginBottom: '10px'}}>
                  Total Records: <strong>{result.totalRecords || 0}</strong>
                </p>
                <p style={{fontSize: '0.9em', color: '#666', marginBottom: '10px'}}>
                  Collections: <strong>{result.sheetCount || 0}</strong>
                </p>
                {result.collections && Array.isArray(result.collections) && result.collections.length > 0 ? (
                  <div style={{maxHeight: '300px', overflowY: 'auto', marginTop: '10px'}}>
                    {result.collections.map((col, idx) => (
                      <div className="model-row" key={idx}>
                        <span>{col.database}/{col.collectionName}</span>
                        <strong>{col.records || 0}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{fontSize: '0.9em', color: '#999'}}>No collections found</p>
                )}
              </div>
              <a 
                href={`${API_URL}/download/${result.fileName}`} 
                download
                style={{display: 'inline-block', marginTop: '15px', padding: '10px 20px', backgroundColor: '#4caf50', color: 'white', textDecoration: 'none', borderRadius: '4px', cursor: 'pointer'}}
              >
                📥 Download File
              </a>
            </>
          ) : <p className="empty-state">Your export summary will appear here after the first successful upload.</p>}
        </aside>
      </section>
    </main>
  )
}

export default App
