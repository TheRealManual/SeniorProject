const express = require('express')
const cors = require('cors')
require('dotenv').config()

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// A simple health check route to verify backend connectivity from the frontend
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'connected' });
});
