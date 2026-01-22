# Senior Project

This is our senior project using AWS Amplify for the frontend and AWS App Runner for the backend.

## For Local Development

### Prerequisites Required
- Node.js installed
- npm installed

### Setup
- Clone it
- run npm install in both frontend and backend directories
- setup .env files locally on your computer as they are ignored by git for security reasons

### Running Locally

Start the backend (in one terminal):
```bash
cd backend
npm start
```

Start the frontend (in another terminal):
```bash
cd frontend
npm run dev
```

Frontend will run on http://localhost:3000
Backend will run on http://localhost:3001

## Deployment

### Frontend (AWS Amplify)
- Pushing to main will auto update on Amplify

### Backend (AWS App Runner)
- Pushing to main will auto update on App Runner due to Github Actions

## Environment Variables

Frontend (.env):
- `VITE_API_URL_DEV` - Backend URL for local development (http://localhost:3001)
- `VITE_API_URL_PROD` - Backend URL for production (your App Runner URL)

Backend (.env):
- `PORT` - Server port (3001)
- `NODE_ENV` - Environment mode (development for local, production for App Runner)
- `FRONTEND_URL_PROD` - Frontend URL for CORS in production (your Amplify URL)
