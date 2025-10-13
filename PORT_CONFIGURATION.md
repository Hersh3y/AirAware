# 🎯 Port Configuration Guide for Railway

## Quick Answer: DON'T Set Target Ports Manually! ✨

Railway automatically detects and manages ports for you.

---

## 📋 Port Configuration Summary

| Service | Local Port | Railway Port | Configuration |
|---------|-----------|--------------|---------------|
| **Backend (Flask)** | `5001` | `$PORT` (auto) | Uses environment variable |
| **Frontend (Vite)** | `5173` (dev)<br>`4173` (preview) | `$PORT` (auto) | Configured in railway.json |

---

## 🔧 How It Works

### Backend (Flask API)

**Local Development:**
```python
# Runs on http://localhost:5001
app.run(debug=True, port=5001)
```

**Production (Railway):**
```python
# Uses Railway's $PORT environment variable
port = int(os.getenv('PORT', 5001))
app.run(host='0.0.0.0', port=port, debug=False)
```

**How Railway Handles It:**
1. Railway sets `$PORT` environment variable (e.g., `8080` or `5000`)
2. Your app reads `$PORT` and listens on that port
3. Railway routes `https://your-app.railway.app` to that port
4. ✅ No manual configuration needed!

---

### Frontend (Vite/React)

**Local Development:**
```bash
npm run dev  # Runs on http://localhost:5173
```

**Production (Railway):**
```bash
npm run preview -- --port $PORT --host 0.0.0.0
```

**How Railway Handles It:**
1. Railway sets `$PORT` environment variable
2. Vite preview server listens on `$PORT`
3. Railway routes traffic to your app
4. ✅ No manual configuration needed!

---

## 🚀 Railway Dashboard - What to Set

### Backend Service Settings

**Root Directory:**
```
backend
```

**Environment Variables:**
```
OPENWEATHER_API_KEY=your_key_here
OPENAQ_API_KEY=your_key_here
NASA_FIRMS_API_KEY=your_key_here
FLASK_ENV=production
```

**Port Settings:**
- ❌ DON'T set "Target Port" manually
- ✅ Railway auto-detects from your app
- ✅ Let Railway manage the `$PORT` variable

**Domain:**
- Click "Generate Domain" to get your public URL
- Example: `https://nasa-backend.railway.app`

---

### Frontend Service Settings

**Root Directory:**
```
frontend
```

**Environment Variables:**
```
VITE_API_BASE_URL=https://your-backend.railway.app
```

**Port Settings:**
- ❌ DON'T set "Target Port" manually
- ✅ Railway uses `$PORT` from `railway.json`
- ✅ Preview server automatically binds to Railway's port

**Domain:**
- Click "Generate Domain"
- Example: `https://nasa-frontend.railway.app`

---

## 🎓 Understanding Railway Ports

### What is `$PORT`?
- Environment variable Railway automatically sets
- Different for each service
- Your app should listen on this port
- Railway routes external traffic to it

### Why `0.0.0.0` for host?
```python
app.run(host='0.0.0.0', port=port)
```
- `0.0.0.0` = Accept connections from any IP
- Required for Railway to route traffic
- `localhost` or `127.0.0.1` won't work in production

---

## ✅ Checklist for Port Configuration

### Backend
- [x] App uses `os.getenv('PORT', 5001)`
- [x] App runs with `host='0.0.0.0'`
- [x] Procfile uses: `gunicorn app:app`
- [x] No hardcoded ports in production code

### Frontend
- [x] `railway.json` has: `--port $PORT`
- [x] Preview script includes `--host`
- [x] No hardcoded ports

---

## 🧪 Testing Ports

### Local Development
**Backend:**
```bash
cd backend
python app.py
# Should see: Running on http://0.0.0.0:5001
```

**Frontend:**
```bash
cd frontend
npm run dev
# Should see: http://localhost:5173
```

### After Railway Deployment
**Backend:**
```bash
curl https://your-backend.railway.app/health
# Should return: {"status": "healthy"}
```

**Frontend:**
```bash
# Visit in browser
https://your-frontend.railway.app
# Map should load
```

---

## 🐛 Common Port Issues

### Issue: "Port already in use"
**Local Dev:**
```bash
# Kill process on port 5001
netstat -ano | findstr :5001
taskkill /PID <pid> /F
```

### Issue: "Connection refused" on Railway
**Cause:** App listening on `localhost` instead of `0.0.0.0`

**Fix:** Update app.run():
```python
app.run(host='0.0.0.0', port=port)  # ✅ Correct
app.run(port=port)                  # ❌ Wrong
```

### Issue: Railway shows "Application failed to respond"
**Cause:** App not reading `$PORT` environment variable

**Fix:** Use environment variable:
```python
port = int(os.getenv('PORT', 5001))  # ✅ Correct
port = 5001                          # ❌ Wrong
```

---

## 📊 Port Summary Table

| Environment | Backend Port | Frontend Port | Notes |
|-------------|--------------|---------------|-------|
| **Local Dev** | `5001` | `5173` | Hardcoded for convenience |
| **Railway** | `$PORT` (auto) | `$PORT` (auto) | Railway assigns dynamically |
| **Production** | Usually `8080` or `5000` | Usually `3000` or `4173` | Varies by Railway |

---

## 💡 Key Takeaways

1. **DON'T manually set target ports in Railway** - it's automatic!
2. **DO use `$PORT` environment variable** in your code
3. **DO use `host='0.0.0.0'`** for production
4. **Railway handles everything else** - routing, SSL, domains

---

## 🎯 Final Answer to Your Question

**For Railway deployment:**

❌ **Don't set target port manually**  
✅ **Railway auto-detects from your app**  
✅ **Your app uses `$PORT` environment variable**  
✅ **Railway routes traffic automatically**

**In Railway Dashboard:**
- Settings → No port configuration needed
- Just set Root Directory and Environment Variables
- Generate Domain and you're done!

---

**Last Updated:** October 5, 2025
