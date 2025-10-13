# 🚨 Railway "Service Unavailable" Error - FIXED!

## The Problem
```
Attempt #1 failed with service unavailable. Continuing to retry...
1/1 replicas never became healthy!
```

## ✅ What I Fixed

### 1. **Updated Procfile** - Explicit binding
```procfile
# OLD (didn't specify binding)
web: gunicorn app:app

# NEW (explicit binding to Railway's port)
web: gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 app:app
```

**Why this matters:**
- `--bind 0.0.0.0:$PORT` - Listen on all interfaces with Railway's assigned port
- `--workers 1` - Single worker (sufficient for free tier, prevents memory issues)
- `--timeout 120` - Longer timeout for slow API calls

### 2. **Updated railway.json** - Better health check
```json
{
  "deploy": {
    "healthcheckPath": "/health",     // Check /health endpoint
    "healthcheckTimeout": 300,        // Wait 5 minutes for startup
    "startCommand": "gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 app:app"
  }
}
```

### 3. **Added Root Endpoint** - Backup health check
```python
@app.route('/', methods=['GET'])
def home():
    return jsonify({'status': 'online'})
```

Now Railway can check if app is healthy at `/` or `/health`

---

## 🚀 How to Deploy Now

### Step 1: Push Updated Code
```bash
git add .
git commit -m "Fix Railway deployment with explicit port binding"
git push origin main
```

### Step 2: Railway Will Auto-Redeploy
- Railway detects the push
- Rebuilds with new configuration
- Should now pass health checks! ✅

### Step 3: Monitor Deployment
1. Go to Railway dashboard
2. Click on your backend service
3. Watch the "Deployments" tab
4. Look for:
   ```
   ✅ Build successful
   ✅ Starting deployment
   ✅ Replica became healthy!
   ```

---

## 🧪 Verify It's Working

### Test 1: Check Root Endpoint
```bash
curl https://your-backend.railway.app/
```

**Expected Response:**
```json
{
  "status": "online",
  "message": "AirAware + CleanMap API",
  "version": "1.0.0"
}
```

### Test 2: Check Health Endpoint
```bash
curl https://your-backend.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "message": "AirAware backend is running!"
}
```

### Test 3: Check API Endpoint
```bash
curl "https://your-backend.railway.app/api/airquality?lat=40.7128&lon=-74.0060"
```

**Expected Response:**
```json
{
  "location": {...},
  "air_quality": {...},
  "weather": {...}
}
```

---

## 🔍 Understanding the Error

### Why "Service Unavailable"?

Railway tries to health-check your app by sending HTTP requests:

```
Railway → GET /health → Your App
         ↓
    Is app responding?
         ↓
    NO → Service Unavailable
    YES → Replica healthy ✅
```

**Common causes:**
1. ❌ App not binding to `0.0.0.0` (was binding to `127.0.0.1`)
2. ❌ App not reading `$PORT` environment variable
3. ❌ Health check endpoint doesn't exist
4. ❌ App taking too long to start (timeout)
5. ❌ Gunicorn not configured properly

**Our fixes:**
1. ✅ Explicit `--bind 0.0.0.0:$PORT`
2. ✅ Using `$PORT` in binding
3. ✅ `/health` endpoint exists + added `/` as backup
4. ✅ Increased timeout to 300 seconds
5. ✅ Proper Gunicorn configuration

---

## 📊 Deployment Flow (Fixed)

```
1. Railway receives code
   ↓
2. Installs dependencies (pip install -r requirements.txt)
   ↓
3. Runs: gunicorn --bind 0.0.0.0:$PORT app:app
   ↓
4. App starts on port $PORT (e.g., 8080)
   ↓
5. Railway checks: GET /health
   ↓
6. App responds: {"status": "healthy"}
   ↓
7. ✅ Replica becomes healthy!
   ↓
8. Railway routes traffic → https://your-app.railway.app
```

---

## 🐛 If It Still Fails

### Check Railway Logs
1. Railway Dashboard → Your service
2. Click "Logs" tab
3. Look for errors:

**Common log messages:**

❌ **"Address already in use"**
```bash
# Fix: Railway assigns unique ports, shouldn't happen
# If it does, restart the deployment
```

❌ **"ModuleNotFoundError"**
```bash
# Fix: Missing dependency in requirements.txt
# Add it and redeploy
```

❌ **"Bind failed"**
```bash
# Fix: Check Procfile has --bind 0.0.0.0:$PORT
```

✅ **"Booting worker with pid"**
```bash
# Good! Gunicorn is starting
```

✅ **"Listening at: http://0.0.0.0:8080"**
```bash
# Perfect! App is listening on Railway's port
```

---

## 🔧 Gunicorn Configuration Explained

```bash
gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 app:app
```

| Flag | Value | Why? |
|------|-------|------|
| `--bind` | `0.0.0.0:$PORT` | Listen on all IPs, Railway's assigned port |
| `--workers` | `1` | Single worker (enough for free tier) |
| `--timeout` | `120` | 2-minute timeout for slow API responses |
| `app:app` | Module:App | Import `app` from `app.py` |

---

## ✅ Updated Files Summary

| File | Change | Why |
|------|--------|-----|
| `Procfile` | Added explicit binding | Gunicorn knows exactly where to bind |
| `railway.json` | Updated health check timeout | More time for startup |
| `app.py` | Added `/` root route | Backup health check endpoint |

---

## 🎉 Success Indicators

You'll know it worked when you see:

**In Railway Logs:**
```
[INFO] Booting worker with pid: 1
[INFO] Listening at: http://0.0.0.0:8080
✅ Replica became healthy
```

**In Railway Dashboard:**
```
🟢 Active
Last deployed: Just now
Replicas: 1/1 healthy
```

**In Browser:**
```
Visit: https://your-backend.railway.app/
Shows: {"status": "online", "message": "AirAware + CleanMap API"}
```

---

## 💡 Pro Tips

1. **Always use `0.0.0.0`** in production, not `localhost`
2. **Always read `$PORT`** from environment variables
3. **Have multiple health check endpoints** (`/`, `/health`)
4. **Use Railway's logs** - they tell you exactly what's wrong
5. **Start with 1 worker** - scale up later if needed

---

## 📞 Still Having Issues?

1. **Check Railway Logs** (most important!)
2. **Verify environment variables** are set
3. **Test locally** with Gunicorn:
   ```bash
   cd backend
   gunicorn --bind 0.0.0.0:5001 app:app
   # Visit http://localhost:5001
   ```
4. **Join Railway Discord** for help

---

**Your deployment should work now!** 🚀

Push your code and watch it succeed! ✅
