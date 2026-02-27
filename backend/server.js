const express = require('express')
const cors = require('cors')
require('dotenv').config()

const chessAI = require('./chessAI')

const app = express()
const PORT = process.env.PORT || 3001

const isDev = process.env.NODE_ENV === 'development'

const allowedOrigins = isDev 
  ? ['http://localhost:3000']
  : [process.env.FRONTEND_URL_PROD].filter(Boolean)

app.use(cors({
  origin: allowedOrigins
}))

app.use(express.json())

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend is running' 
  })
})

app.get('/api/chess/health', async (req, res) => {
  try {
    const data = await chessAI.healthCheck()
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.post('/api/chess/move', async (req, res) => {
  try {
    const { fen, difficulty } = req.body
    if (!fen) return res.status(400).json({ error: 'fen is required' })
    const data = await chessAI.getMove(fen, difficulty)
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.post('/api/chess/evaluate', async (req, res) => {
  try {
    const { fen } = req.body
    if (!fen) return res.status(400).json({ error: 'fen is required' })
    const data = await chessAI.evaluate(fen)
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.post('/api/chess/analyze', async (req, res) => {
  try {
    const { fen, numSims } = req.body
    if (!fen) return res.status(400).json({ error: 'fen is required' })
    const data = await chessAI.analyze(fen, numSims)
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
