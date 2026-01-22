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
- `VITE_API_URL` - Backend URL (http://localhost:3001 for local, App Runner URL for prod)

Backend (.env):
- `PORT` - Server port (3001)
- `FRONTEND_URL` - Frontend URL for CORS (leave empty for local, add Amplify URL for prod)
