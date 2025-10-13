# 🚂 Railway Deployment Guide for NASA SpaceApps 2025

This guide will help you deploy your AirAware + CleanMap application to Railway.

## 📋 Prerequisites

1. **GitHub Account** - Your code should be in a GitHub repository
2. **Railway Account** - Sign up at [railway.app](https://railway.app) (free tier available)
3. **API Keys** - You'll need:
   - OpenWeatherMap API Key
   - OpenAQ API Key (if using)
   - NASA FIRMS API Key (if using wildfire data)

## 🎯 Deployment Steps

### Step 1: Prepare Your Repository

Make sure your repository has these files:

**Backend (`/backend/`):**
- ✅ `app.py` - Your Flask application
- ✅ `requirements.txt` - Python dependencies
- ✅ `Procfile` - Tells Railway how to run your app
- ✅ `runtime.txt` - Specifies Python version
- ✅ `railway.json` - Railway configuration
- ✅ `.railwayignore` - Files to exclude from deployment

**Frontend (`/frontend/`):**
- ✅ `package.json` - Node dependencies
- ✅ `vite.config.js` - Vite configuration
- ✅ All source files in `src/`

### Step 2: Deploy Backend to Railway

1. **Go to Railway Dashboard**
   - Visit [railway.app](https://railway.app)
   - Click "New Project"

2. **Connect GitHub Repository**
   - Select "Deploy from GitHub repo"
   - Choose your `nasa-spaceapps-2025` repository
   - Railway will detect it's a Python/Flask app

3. **Configure Root Directory**
   - Go to Settings → "Root Directory"
   - Set to: `backend`
   - This tells Railway to deploy only the backend folder

4. **Add Environment Variables**
   - Go to "Variables" tab
   - Add these variables:
     ```
     OPENWEATHER_API_KEY=your_openweather_key_here
     OPENAQ_API_KEY=your_openaq_key_here
     NASA_FIRMS_API_KEY=your_firms_key_here (optional)
     PORT=5000
     FLASK_ENV=production
     ```

5. **Deploy**
   - Railway will automatically deploy
   - Wait for build to complete (2-3 minutes)
   - You'll get a URL like: `https://your-app.railway.app`

### Step 3: Deploy Frontend to Railway (or Vercel/Netlify)

#### Option A: Deploy Frontend to Railway

1. **Create Another Service**
   - In the same Railway project, click "New Service"
   - Select the same GitHub repository
   - Set Root Directory to: `frontend`

2. **Add Environment Variables**
   ```
   VITE_API_BASE_URL=https://your-backend.railway.app/api
   ```

3. **Custom Build & Start Commands**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run preview` (or use a static server)

#### Option B: Deploy Frontend to Vercel (Recommended)

1. **Go to [Vercel](https://vercel.com)**
2. **Import GitHub Repository**
3. **Configure:**
   - Framework Preset: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Add Environment Variable:**
   ```
   VITE_API_BASE_URL=https://your-backend.railway.app
   ```

### Step 4: Update Frontend API Configuration

Update your frontend to use the deployed backend URL:

**In `frontend/src/utils/api.js`:**
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
```

**In `frontend/.env.production`:**
```
VITE_API_BASE_URL=https://your-backend.railway.app/api
```

### Step 5: Update CORS in Backend

Update your Flask app to allow requests from your frontend domain:

**In `backend/app.py`:**
```python
CORS(app, origins=[
    'http://localhost:5173',
    'http://localhost:3000',
    'https://your-frontend.vercel.app',
    'https://your-frontend.railway.app'
])
```

## 🔧 Configuration Files Explained

### `Procfile`
```
web: gunicorn app:app
```
Tells Railway to use Gunicorn to run your Flask app.

### `runtime.txt`
```
python-3.11.0
```
Specifies Python version for Railway.

### `railway.json`
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "gunicorn app:app"
  }
}
```
Railway-specific configuration.

## 🌍 Environment Variables Reference

### Backend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENWEATHER_API_KEY` | Yes | OpenWeatherMap API key | `abc123def456` |
| `OPENAQ_API_KEY` | Optional | OpenAQ API key | `xyz789` |
| `NASA_FIRMS_API_KEY` | Optional | NASA FIRMS API key | `firms123` |
| `PORT` | No | Server port (Railway sets automatically) | `5000` |
| `FLASK_ENV` | No | Flask environment | `production` |

### Frontend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_BASE_URL` | Yes | Backend API URL | `https://api.example.com` |

## 🧪 Testing Your Deployment

### Test Backend
```bash
curl https://your-backend.railway.app/api/airquality?lat=40.7128&lon=-74.0060
```

### Test Frontend
Visit `https://your-frontend.vercel.app` in your browser.

## 🐛 Troubleshooting

### Build Fails
- Check Railway logs in the "Deployments" tab
- Verify `requirements.txt` has all dependencies
- Ensure Python version in `runtime.txt` is supported

### CORS Errors
- Update CORS origins in `app.py` to include your frontend URL
- Make sure frontend is using correct backend URL

### 502 Bad Gateway
- Check if Gunicorn is starting correctly
- Verify `Procfile` has correct command
- Check Railway logs for Python errors

### API Keys Not Working
- Verify environment variables are set correctly in Railway
- Check variable names match what's in your code
- Don't commit `.env` file to GitHub!

## 📊 Railway Free Tier Limits

- **Execution Time**: $5/month credit (about 500 hours)
- **Memory**: 512 MB RAM
- **Storage**: 1 GB
- **Bandwidth**: Unlimited

For this project, free tier should be sufficient!

## 🚀 Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Backend deployed to Railway
- [ ] Environment variables configured
- [ ] Frontend deployed (Vercel/Railway)
- [ ] Frontend pointing to backend URL
- [ ] CORS configured correctly
- [ ] API endpoints tested
- [ ] Map loads correctly
- [ ] Search functionality works
- [ ] Air quality data displays

## 🔗 Useful Links

- [Railway Documentation](https://docs.railway.app/)
- [Gunicorn Documentation](https://docs.gunicorn.org/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Vercel Documentation](https://vercel.com/docs)

## 💡 Best Practices

1. **Use Environment Variables** - Never commit API keys to GitHub
2. **Enable Railway's Auto-Deploy** - Pushes to main branch auto-deploy
3. **Monitor Logs** - Check Railway logs regularly for errors
4. **Use Custom Domain** - Railway allows custom domains (optional)
5. **Set Up Health Checks** - Railway can automatically restart if app crashes

## 🎉 Next Steps After Deployment

1. Share your deployed app URL
2. Monitor usage in Railway dashboard
3. Set up custom domain (optional)
4. Add analytics (Google Analytics, etc.)
5. Consider upgrading if you hit free tier limits

---

**Need Help?** 
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Railway Docs: [docs.railway.app](https://docs.railway.app)

Good luck with your deployment! 🚀
