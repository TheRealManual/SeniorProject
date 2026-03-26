const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load this early

const app = express(); // 1. Initialize app FIRST

// 2. Now apply middleware to the initialized app
app.use(express.json());

// 3. The rest of your imports
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fetch = global.fetch || require('node-fetch');
const chessAI = require('./chessAI');





const mongoose = require('mongoose')
require('dotenv').config()

const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me'

const isDev = process.env.NODE_ENV === 'development'
const normalizeOrigin = (value) => {
  if (!value) return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const configuredOrigins = [
  process.env.FRONTEND_URL_DEV,
  process.env.FRONTEND_URL_PROD,
  ...(process.env.FRONTEND_URLS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]
  .map(normalizeOrigin)
  .filter(Boolean)

const defaultFrontendOrigin =
  (isDev ? normalizeOrigin(process.env.FRONTEND_URL_DEV) : null) ||
  normalizeOrigin(process.env.FRONTEND_URL_PROD) ||
  normalizeOrigin(process.env.FRONTEND_URL_DEV) ||
  'http://localhost:5173'

const parseOAuthState = (state) => {
  if (!state) return null

  try {
    return JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

const createOAuthState = (payload) =>
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')

const getAllowedFrontendOrigin = (value) => {
  const normalized = normalizeOrigin(value)
  if (!normalized) return null

  return allowedOrigins.includes(normalized) ? normalized : null
}

const getFrontendOriginFromRequest = (req) => {
  const state = parseOAuthState(req.query.state)
  const candidates = [
    state?.frontendOrigin,
    req.query.frontend_origin,
    req.get('origin'),
    req.get('referer'),
    defaultFrontendOrigin,
  ]

  for (const candidate of candidates) {
    const allowedOrigin = getAllowedFrontendOrigin(candidate)
    if (allowedOrigin) return allowedOrigin
  }

  return defaultFrontendOrigin
}

const getBackendBaseUrl = (req) => {
  const configured = process.env.BACKEND_URL
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  const forwardedProto = req.get('x-forwarded-proto')
  const forwardedHost = req.get('x-forwarded-host')
  const host = forwardedHost || req.get('host')

  if (host) {
    return `${forwardedProto || req.protocol || 'http'}://${host}`
  }

  return `http://localhost:${PORT}`
}

const allowedOrigins = Array.from(new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  ...configuredOrigins,
])).filter(Boolean)

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
    // Tracks win/loss/draw statistics for each game mode
    // Used for leaderboards and player rankings
    gameStats: {
      classic: {
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        rating: { type: Number, default: 0 },
      },
      training: {
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        rating: { type: Number, default: 0 },
      },
      timed: {
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        rating: { type: Number, default: 0 },
      },
    },
  },
  { timestamps: true }
)

const User = mongoose.models.User || mongoose.model('User', userSchema)

const gameSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Which game mode was being played
    gameMode: {
      type: String,
      enum: ['classic', 'training', 'timed'],
      required: true,
    },
    // How the game ended (by resignation or normal game end)
    result: {
      type: String,
      enum: ['white_wins', 'black_wins', 'draw', 'white_resigned', 'black_resigned'],
      required: true,
    },
    // Tracks which side resigned (if applicable)
    resignedBy: {
      type: String,
      enum: ['white', 'black'],
      default: null,
    },
    // The winner (either by resignation or checkmate/draw)
    winner: {
      type: String,
      enum: ['white', 'black'],
      default: null,
    },
    // Final score (used in timed mode)
    score: {
      type: Number,
      default: 0,
    },
    // Board position snapshot for replay/analysis
    fen: String,
    // Number of moves played before resignation/end
    moveCount: Number,
  },
  { timestamps: true }
)

const GameSession = mongoose.models.GameSession || mongoose.model('GameSession', gameSessionSchema)

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

  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${getBackendBaseUrl(req)}/api/auth/discord/callback`
  const discordAuthUrl = new URL('https://discord.com/oauth2/authorize')
  const frontendOrigin = getFrontendOriginFromRequest(req)

  discordAuthUrl.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID)
  discordAuthUrl.searchParams.set('response_type', 'code')
  discordAuthUrl.searchParams.set('redirect_uri', redirectUri)
  discordAuthUrl.searchParams.set('scope', 'identify email')
  discordAuthUrl.searchParams.set('state', createOAuthState({ frontendOrigin }))

  return res.redirect(discordAuthUrl.toString())
})

app.get('/api/auth/discord/callback', async (req, res) => {
  const frontendOrigin = getFrontendOriginFromRequest(req)

  const redirectWithError = (message, statusCode = 500) => {
    const target = `${frontendOrigin}/?auth_error=${encodeURIComponent(message)}`
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

    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${getBackendBaseUrl(req)}/api/auth/discord/callback`
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
    const redirectTarget = `${frontendOrigin}/?auth_token=${encodeURIComponent(token)}`
    return res.redirect(redirectTarget)
  } catch (error) {
    console.error('Discord OAuth callback failed:', error)
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

app.post('/api/games/resign', authRequired, async (req, res) => {
  try {
    const { gameMode, resigned_by, winner, fen, score, opponentId } = req.body
    const userId = req.user._id

    // Determine the game result status
    const resignedSide = resigned_by === 'white' ? 'white_resigned' : 'black_resigned'

    // Create a game session record to track this resignation
    const gameSession = new GameSession({
      userId,
      gameMode,
      result: resignedSide,
      resignedBy: resigned_by,
      winner,
      score: score || 0,
      fen, // Board state at resignation
      moveCount: fen ? fen.split(' ')[5] : 0,
    })

    // Save the game session to database
    await gameSession.save()

    // Validate game mode
    const validGameMode = ['classic', 'training', 'timed'].includes(gameMode) ? gameMode : 'classic'
    
    // Update loser's statistics
    await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          [`gameStats.${validGameMode}.losses`]: 1,
          [`gameStats.${validGameMode}.rating`]: -16, // Rating decrease on loss
        },
      },
      { new: true }
    )

    // If opponent ID provided, update winner's statistics (AI games may not have opponent)
    if (opponentId) {
      await User.findByIdAndUpdate(
        opponentId,
        {
          $inc: {
            [`gameStats.${validGameMode}.wins`]: 1,
            [`gameStats.${validGameMode}.rating`]: 16, // Rating increase on win
          },
        },
        { new: true }
      )
    }

    res.json({ ok: true, message: 'Resignation recorded', gameSession })
  } catch (err) {
    console.error('Resignation error:', err.message, err)
    res.status(500).json({ error: 'Failed to record resignation', details: err.message })
  }
})

// GET /api/leaderboard - Retrieve top players ranked by wins
// Supports filtering by game mode (classic, training, timed) and pagination
// Query params: mode (default: classic), limit (default: 50), offset (default: 0)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { mode = 'classic', limit = 50, offset = 0 } = req.query
    const validModes = ['classic', 'training', 'timed']
    const gameMode = validModes.includes(mode) ? mode : 'classic'

    // Calculate win rate for sorting
    // Project only the fields we need for leaderboard display
    const leaderboard = await User.aggregate([
      // Project relevant fields
      {
        $project: {
          username: 1,
          email: 1,
          rating: `$gameStats.${gameMode}.rating`,
          wins: `$gameStats.${gameMode}.wins`,
          losses: `$gameStats.${gameMode}.losses`,
          draws: `$gameStats.${gameMode}.draws`,
          totalGames: {
            $add: [
              `$gameStats.${gameMode}.wins`,
              `$gameStats.${gameMode}.losses`,
              `$gameStats.${gameMode}.draws`,
            ],
          },
        },
      },
      // Only include players who have played at least one game
      {
        $match: {
          totalGames: { $gt: 0 },
        },
      },
      // Add calculated win rate field
      {
        $addFields: {
          winRate: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: ['$wins', '$totalGames'],
                  },
                  100,
                ],
              },
              2,
            ],
          },
        },
      },
      // Sort by rating (descending), then by wins (descending), then by win rate (descending)
      // This matches Chess.com's leaderboard system where rating is the primary sort
      {
        $sort: { rating: -1, wins: -1, winRate: -1 },
      },
      // Pagination: skip and limit
      { $skip: parseInt(offset) || 0 },
      { $limit: parseInt(limit) || 50 },
    ])

    // Get total count for pagination info
    const totalCount = await User.countDocuments({
      [`gameStats.${gameMode}.totalGames`]: { $exists: true },
    })

    res.json({
      ok: true,
      mode: gameMode,
      leaderboard,
      totalCount,
      offset: parseInt(offset) || 0,
      limit: parseInt(limit) || 50,
    })
  } catch (err) {
    console.error('Leaderboard error:', err.message, err)
    res.status(500).json({ error: 'Failed to fetch leaderboard', details: err.message })
  }
})

// GET /api/leaderboard/my-rank - Get personal leaderboard stats and rank
// Requires authentication
app.get('/api/leaderboard/my-rank', authRequired, async (req, res) => {
  try {
    const { mode = 'classic' } = req.query
    const validModes = ['classic', 'training', 'timed']
    const gameMode = validModes.includes(mode) ? mode : 'classic'
    const userId = req.user._id

    // Get the current user's stats
    const user = await User.findById(userId)
    const stats = user.gameStats[gameMode]
    const totalGames = stats.wins + stats.losses + stats.draws

    // Calculate win rate
    const winRate = totalGames > 0 ? ((stats.wins / totalGames) * 100).toFixed(2) : 0

    // Find the user's rank by counting players with better win records
    const rank = await User.countDocuments({
      $expr: {
        $gt: [
          {
            $getField: `gameStats.${gameMode}.wins`,
          },
          stats.wins,
        ],
      },
    })

    res.json({
      ok: true,
      mode: gameMode,
      username: user.username,
      email: user.email,
      stats: {
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        totalGames,
        winRate: parseFloat(winRate),
        rating: user.gameStats[gameMode].rating,
      },
      rank: rank + 1, // 1-indexed rank
    })
  } catch (err) {
    console.error('My rank error:', err.message, err)
    res.status(500).json({ error: 'Failed to fetch personal rank', details: err.message })
  }
})

// GET /api/game-history - Get user's recent games
// Requires authentication
app.get('/api/game-history', authRequired, async (req, res) => {
  try {
    const { mode = 'classic', limit = 20, offset = 0 } = req.query
    const userId = req.user._id
    const validModes = ['classic', 'training', 'timed']
    const gameMode = validModes.includes(mode) ? mode : 'classic'

    // Fetch user's recent games sorted by date (newest first)
    const games = await GameSession.find({ userId, gameMode })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 20)
      .skip(parseInt(offset) || 0)

    // Get total count
    const totalCount = await GameSession.countDocuments({ userId, gameMode })

    // Format response
    const formattedGames = games.map(game => ({
      id: game._id,
      mode: game.gameMode,
      result: game.result,
      winner: game.winner,
      score: game.score,
      moveCount: game.moveCount,
      date: game.createdAt,
      // Show brief result description (e.g., "Won by checkmate", "Lost by resignation")
      description: game.result.includes('resigned') 
        ? `${game.winner === 'white' ? 'Won' : 'Lost'} by resignation`
        : game.result,
    }))

    res.json({
      ok: true,
      mode: gameMode,
      games: formattedGames,
      totalCount,
      offset: parseInt(offset) || 0,
      limit: parseInt(limit) || 20,
    })
  } catch (err) {
    console.error('Game history error:', err.message, err)
    res.status(500).json({ error: 'Failed to fetch game history', details: err.message })
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
