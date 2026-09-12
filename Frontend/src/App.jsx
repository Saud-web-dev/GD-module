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

  function handleGoogleAuth() {
    window.location.href = `${API_URL}/auth/google`
  }

  async function handleExport(event) {
    event.preventDefault()
    setIsExporting(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch(`${API_URL}/api/exports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workbookName, folderId: folderId || undefined }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please authenticate with Google first by clicking "Login with Google"')
        } else {
          throw new Error(data.message || 'Export failed')
        }
      } else {
        setResult(data)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsExporting(false)
    }
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

          <button type="button" onClick={handleGoogleAuth} className="auth-button">
            🔐 Login with Google
          </button>

          <label>
            Workbook name
            <input value={workbookName} onChange={(event) => setWorkbookName(event.target.value)} required />
          </label>
          <label>
            Drive folder ID <span>(optional)</span>
            <input value={folderId} onChange={(event) => setFolderId(event.target.value)} placeholder="Use configured default" />
          </label>
          <button type="submit" disabled={isExporting || health === 'offline'}>
            {isExporting ? 'Building workbook...' : 'Extract & upload'} <span>↗</span>
          </button>
          {error && <p className="message error">{error}</p>}
        </form>

        <aside className="result-panel">
          <div className="section-heading"><div><span className="section-index">02</span><h2>Latest result</h2></div></div>
          {result ? (
            <>
              <div className="success-mark">✓</div>
              <p className="result-title">Upload complete</p>
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
              {result.driveFile?.webViewLink && <a href={result.driveFile.webViewLink} target="_blank" rel="noreferrer">Open in Google Drive ↗</a>}
            </>
          ) : <p className="empty-state">Your export summary will appear here after the first successful upload.</p>}
        </aside>
      </section>
    </main>
  )
}

export default App
