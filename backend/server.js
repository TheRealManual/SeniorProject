const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load this early

const app = express(); // 1. Initialize app FIRST

// 2. Now apply middleware to the initialized app
app.use(express.json());
app.use(cors());

// 3. The rest of your imports
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const chessAI = require('./chessAI');





const mongoose = require('mongoose')
require('dotenv').config()

const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me'

const isDev = process.env.NODE_ENV === 'development'
const frontendUrl = isDev
  ? (process.env.FRONTEND_URL_DEV || 'http://localhost:5173')
  : process.env.FRONTEND_URL_PROD

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://your-production-frontend.vercel.app', // Add your actual prod URL here
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS Policy: Origin not allowed'), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
    },
    username: {
      type: String,
      trim: true,
      default: '',
    },
    passwordHash: {
      type: String,
      default: '',
    },
    discordId: {
      type: String,
      sparse: true,
      unique: true,
    },
    provider: {
      type: String,
      enum: ['local', 'discord'],
      default: 'local',
    },
  },
  { timestamps: true }
)

const User = mongoose.models.User || mongoose.model('User', userSchema)

const sanitizeUser = (user) => ({
  id: user._id,
  email: user.email || null,
  username: user.username || null,
  provider: user.provider,
})

const signToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email || null,
      provider: user.provider,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

const getTokenFromHeader = (req) => {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

const authRequired = async (req, res, next) => {
  const token = getTokenFromHeader(req)
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(payload.sub)
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' })
    }
    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is running',
  })
})

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'connected' })
})

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' })
    }

    const existing = await User.findOne({ email: normalizedEmail })
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      email: normalizedEmail,
      username: String(username || '').trim() || normalizedEmail.split('@')[0],
      passwordHash,
      provider: 'local',
    })

    const token = signToken(user)
    return res.status(201).json({ user: sanitizeUser(user), token })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to register account' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const user = await User.findOne({ email: normalizedEmail })
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = signToken(user)
    return res.json({ user: sanitizeUser(user), token })
  } catch (error) {
    console.error("DETAILED LOGIN CRASH:", error);
    return res.status(500).json({ error: 'Failed to sign in' })
  }
})

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: sanitizeUser(req.user) })
})

app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true })
})

app.get('/api/auth/discord', (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID) {
    return res.status(500).json({ error: 'Missing DISCORD_CLIENT_ID' })
  }

  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${process.env.BACKEND_URL || `http://localhost:${PORT}`}/api/auth/discord/callback`
  const discordAuthUrl = new URL('https://discord.com/oauth2/authorize')

  discordAuthUrl.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID)
  discordAuthUrl.searchParams.set('response_type', 'code')
  discordAuthUrl.searchParams.set('redirect_uri', redirectUri)
  discordAuthUrl.searchParams.set('scope', 'identify email')

  return res.redirect(discordAuthUrl.toString())
})

app.get('/api/auth/discord/callback', async (req, res) => {
  const redirectWithError = (message, statusCode = 500) => {
    const target = `${frontendUrl || 'http://localhost:5173'}/?auth_error=${encodeURIComponent(message)}`
    return res.status(statusCode).redirect(target)
  }

  try {
    const { code } = req.query
    if (!code) {
      return redirectWithError('Missing OAuth code', 400)
    }

    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
      return redirectWithError('Discord OAuth is not configured on server')
    }

    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${process.env.BACKEND_URL || `http://localhost:${PORT}`}/api/auth/discord/callback`
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token) {
      return redirectWithError('Failed to exchange Discord OAuth code', 502)
    }

    const profileResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    const profile = await profileResponse.json()
    if (!profileResponse.ok || !profile.id) {
      return redirectWithError('Failed to fetch Discord profile', 502)
    }

    let user = await User.findOne({ discordId: profile.id })

    if (!user && profile.email) {
      user = await User.findOne({ email: String(profile.email).toLowerCase() })
      if (user) {
        user.discordId = profile.id
        user.provider = user.provider === 'local' ? 'local' : 'discord'
      }
    }

    if (!user) {
      user = new User({
        discordId: profile.id,
        email: profile.email ? String(profile.email).toLowerCase() : undefined,
        username: profile.global_name || profile.username || 'Discord User',
        provider: 'discord',
      })
    } else if (!user.username) {
      user.username = profile.global_name || profile.username || user.username
    }

    await user.save()

    const token = signToken(user)
    const redirectTarget = `${frontendUrl || 'http://localhost:5173'}/?auth_token=${encodeURIComponent(token)}`
    return res.redirect(redirectTarget)
  } catch (error) {
    return redirectWithError('Discord sign-in failed')
  }
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

app.post('/api/chess/training/analyze-move', async (req, res) => {
  try {
    const { fen, player_move } = req.body
    if (!fen || !player_move) return res.status(400).json({ error: 'fen and player_move are required' })
    const data = await chessAI.analyzePlayerMove(fen, player_move)
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.post('/api/chess/training/suggest', async (req, res) => {
  try {
    const { fen } = req.body
    if (!fen) return res.status(400).json({ error: 'fen is required' })
    const data = await chessAI.suggestMove(fen)
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.post('/api/chess/training/piece-info', async (req, res) => {
  try {
    const { fen, square } = req.body
    if (!fen || !square) return res.status(400).json({ error: 'fen and square are required' })
    const data = await chessAI.getPieceInfo(fen, square)
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

const start = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('Missing MONGO_URI in environment')
    }

    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB')

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Server failed to start:', error.message)
    process.exit(1)
  }
}

start()
