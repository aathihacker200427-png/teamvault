# Split Deployment: Heroku (Backend) + Vercel (Frontend)

This guide deploys TeamVault with the **Rust backend on Heroku** and the **React frontend on Vercel**.

> Developed by **[Strucureo](https://strucureo.com)**

---

## ⚠️ Heroku Limitations (read first)

| Feature | Status on Heroku |
|---------|------------------|
| Real-time chat (WebSocket) | ✅ Works |
| Voice / video calls (WebRTC) | ✅ Works (P2P, STUN) |
| Channels, DMs, settings | ✅ Works |
| **File uploads** | ⚠️ Files are lost on every restart (no persistent disk) |
| Group calls via SFU | ❌ Skipped — Heroku is single-process |
| Postgres database | ✅ Heroku Postgres ($5/mo Mini plan) |

If you need persistent file uploads → use **Render** for the backend instead (it has persistent disks).

---

## Part 1: Deploy Backend to Heroku

### Prerequisites

- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- A Heroku account with a verified payment method (Heroku no longer has a free tier)

### Steps

```bash
# 1. Login
heroku login

# 2. Create app (replace 'teamvault-api' with your unique name)
heroku create teamvault-api --stack=container

# 3. Set the project to use Docker (uses heroku.yml)
heroku stack:set container -a teamvault-api

# 4. Add Heroku Postgres (Mini = $5/mo)
heroku addons:create heroku-postgresql:mini -a teamvault-api

# 5. Set required env vars
heroku config:set \
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+\n' | head -c 64) \
  JWT_EXPIRATION_HOURS=24 \
  RUST_LOG=info \
  CORS_ORIGIN=https://YOUR-FRONTEND.vercel.app \
  -a teamvault-api

# DATABASE_URL is set automatically by Heroku Postgres

# 6. Push & deploy
cd D:\Strucureo\internal
git push https://git.heroku.com/teamvault-api.git main
```

Or, if you prefer GitHub auto-deploy:

1. Go to your Heroku app → **Deploy** tab → **GitHub**
2. Connect the `teamvault` repo
3. Enable **Automatic deploys** from `main` branch

### Your backend URL will be:

```
https://teamvault-api-<random>.herokuapp.com
```

API endpoint: `https://teamvault-api-xxx.herokuapp.com/api/v1`
WebSocket:    `wss://teamvault-api-xxx.herokuapp.com/api/v1/ws`

Test it:
```bash
curl https://teamvault-api-xxx.herokuapp.com/health
```

---

## Part 2: Deploy Frontend to Vercel

### Steps

1. Go to https://vercel.com/new
2. **Import** your GitHub repo (`teamvault`)
3. **Configure project**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (auto-detected)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
4. **Environment Variables** — add these:
   ```
   VITE_API_URL = https://teamvault-api-xxx.herokuapp.com/api/v1
   VITE_WS_URL  = wss://teamvault-api-xxx.herokuapp.com/api/v1/ws
   ```
5. Click **Deploy**

You'll get a URL like `https://teamvault.vercel.app`.

### Update the backend's CORS to allow your Vercel domain

```bash
heroku config:set CORS_ORIGIN=https://teamvault.vercel.app -a teamvault-api
```

The backend will restart automatically.

---

## Part 3: Verify Everything Works

1. Visit `https://teamvault.vercel.app`
2. Register a user → should land on workspace
3. Check browser console for any CORS or WebSocket errors
4. Test voice/video call between two browser windows

---

## Updates

**Backend** — push to Heroku:
```bash
git push https://git.heroku.com/teamvault-api.git main
```

Or with GitHub auto-deploy enabled, just `git push` to your repo.

**Frontend** — Vercel auto-deploys on every git push to `main`. No action needed.

---

## Cost Summary

| Service | Plan | Monthly cost |
|---------|------|--------------|
| Heroku Eco dyno (backend) | Eco | $5/mo |
| Heroku Postgres Mini | Mini | $5/mo |
| Vercel Hobby (frontend) | Free | $0 |
| **Total** | | **~$10/mo** |

---

## Troubleshooting

**Heroku build fails on Rust compile:**
- The `heroku.yml` uses your existing Dockerfile. Build can be slow (~10 min) but should succeed.
- If it times out, consider Render or Railway which have higher build time limits.

**WebSocket connection fails:**
- Heroku supports WS — make sure your frontend uses `wss://` (TLS) not `ws://`.
- Check `VITE_WS_URL` env var on Vercel is correct.

**CORS error in browser console:**
- Make sure `CORS_ORIGIN` on Heroku matches your exact Vercel URL (including protocol, no trailing slash).

**File uploads disappear:**
- Expected on Heroku (ephemeral storage). To fix: integrate AWS S3 / Cloudinary, or move backend to Render.

---

**TeamVault** — Developed by **[Strucureo](https://strucureo.com)**
