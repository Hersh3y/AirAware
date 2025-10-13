# 🚀 Quick Deployment Guide - Railway

## 🎯 Steps to Deploy (10 minutes)

### Step 1: Push Code to GitHub ✅

```bash
# In your project root directory
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

### Step 2: Deploy Backend to Railway 🚂

1. **Visit** [railway.app](https://railway.app) and sign in with GitHub
2. **Click** "New Project" → "Deploy from GitHub repo"
3. **Select** your `nasa-spaceapps-2025` repository
4. **Configure** the service:
   - Click on the service name
   - Go to **Settings**
   - Under "Root Directory", enter: `backend`
   - Click "Save"

5. **Add Environment Variables**:
   - Go to **Variables** tab
   - Click "Raw Editor"
   - Paste this (replace with your actual keys):
   ```
   OPENWEATHER_API_KEY=your_openweather_key_here
   OPENAQ_API_KEY=your_openaq_key_here
   NASA_FIRMS_API_KEY=your_firms_key_here
   FLASK_ENV=production
   ```
   - Click "Deploy"

6. **Get Your Backend URL**:
   - Go to **Settings** → "Networking"
   - Click "Generate Domain"
   - Copy the URL (e.g., `https://nasa-spaceapps-backend.railway.app`)

### Step 3: Deploy Frontend to Vercel (Easiest) 🌐

1. **Visit** [vercel.com](https://vercel.com) and sign in with GitHub
2. **Click** "Add New" → "Project"
3. **Import** your GitHub repository
4. **Configure**:
   - Framework Preset: **Vite**
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. **Add Environment Variable**:
   - Click "Environment Variables"
   - Add:
     - Name: `VITE_API_BASE_URL`
     - Value: `https://your-backend-url.railway.app` (from Step 2.6)
   - Click "Deploy"

6. **Wait** for deployment (2-3 minutes)
7. **Visit** your live site! 🎉

### Alternative: Deploy Frontend to Railway

1. In the same Railway project, click "**New**" → "GitHub Repo"
2. Select the same repository
3. **Configure**:
   - Root Directory: `frontend`
   - Add Environment Variable:
     ```
     VITE_API_BASE_URL=https://your-backend-url.railway.app
     ```
4. Generate domain and visit your site

---

## 🔧 Update CORS After Deployment

After deploying frontend, update your backend CORS settings:

**File**: `backend/app.py`

```python
CORS(app, origins=[
    'http://localhost:5173',
    'http://localhost:3000',
    'https://your-frontend.vercel.app',  # Add your frontend URL
    '*'  # Or remove this for production security
])
```

Commit and push:
```bash
git add backend/app.py
git commit -m "Update CORS for production"
git push
```

Railway will auto-deploy the changes!

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Backend deployed to Railway
- [ ] Backend environment variables set
- [ ] Backend URL copied
- [ ] Frontend deployed to Vercel/Railway
- [ ] Frontend environment variable set with backend URL
- [ ] CORS updated in backend
- [ ] Website loads successfully
- [ ] Map displays correctly
- [ ] Search works
- [ ] Air quality data shows

---

## 🧪 Testing Your Deployment

### Test Backend API
```bash
curl "https://your-backend.railway.app/api/airquality?lat=40.7128&lon=-74.0060"
```

Should return JSON with air quality data.

### Test Frontend
Visit your frontend URL and:
1. Check if map loads
2. Search for a city (e.g., "New York")
3. Verify air quality data displays
4. Check browser console for errors (F12)

---

## 🐛 Common Issues & Fixes

### Issue: CORS Error
**Fix**: Update CORS origins in `backend/app.py` to include your frontend URL

### Issue: API_BASE_URL not found
**Fix**: Make sure `VITE_API_BASE_URL` environment variable is set in Vercel/Railway

### Issue: Build fails on Railway
**Fix**: Check Railway logs, ensure all dependencies are in `requirements.txt`

### Issue: Frontend shows blank page
**Fix**: Check browser console (F12) for errors, verify API URL is correct

---

## 📊 Cost Estimate

**Railway (Backend):**
- Free tier: $5/month credit = ~500 hours
- This project: ~720 hours/month
- Cost: **FREE** (stays within limits with sleep mode)

**Vercel (Frontend):**
- Free tier: 100 GB bandwidth, unlimited projects
- This project: Well within limits
- Cost: **FREE**

**Total: $0/month** 🎉

---

## 🎓 Pro Tips

1. **Enable Auto-Deploy**: Railway and Vercel auto-deploy when you push to GitHub
2. **Monitor Logs**: Check Railway logs for backend errors
3. **Use Custom Domain**: Both platforms support custom domains (optional)
4. **Environment Variables**: Never commit `.env` files to GitHub
5. **Sleep Mode**: Railway free tier apps sleep after 5 min inactivity (normal)

---

## 📞 Need Help?

- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Check Logs**: Railway/Vercel dashboards show detailed logs

---

## 🎉 You're Done!

Your app is now live and accessible worldwide! Share your URL and enjoy! 🌍

**Example URLs:**
- Frontend: `https://nasa-spaceapps-2025.vercel.app`
- Backend: `https://nasa-spaceapps-backend.railway.app`

---

**Last Updated**: October 5, 2025
