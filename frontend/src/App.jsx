import { useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const checkConnection = async () => {
    setLoading(true)
    setStatus('')
    
    const apiUrl = import.meta.env.MODE === 'development' 
      ? import.meta.env.VITE_API_URL_DEV 
      : import.meta.env.VITE_API_URL_PROD
    
    try {
      const response = await fetch(`${apiUrl}/api/status`)
      const data = await response.json()
      
      if (response.ok) {
        setStatus('Connected to backend!')
      } else {
        setStatus('Backend responded but with an error')
      }
    } catch (error) {
      setStatus('Could not connect to backend')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>Senior Project</h1>
      <button 
        onClick={checkConnection} 
        disabled={loading}
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        {loading ? 'Checking...' : 'Check Connection to Backend'}
      </button>
      {status && <p style={{ marginTop: '20px', fontSize: '18px' }}>{status}</p>}
    </div>
  )
}

export default App
