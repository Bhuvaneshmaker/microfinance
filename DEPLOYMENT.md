# Deployment Guide

This project has two deploys:

- Backend API: Render
- Frontend React app: Netlify

The frontend should call `/api/...` in production. Netlify rewrites `/api/*` to the Render backend, which avoids browser CORS problems.

## 1. Push The Latest Code

Commit and push the repository after these files are included:

- `frontend/netlify.toml`
- `frontend/public/_redirects`
- `frontend/.env.production`
- `frontend/src/api.js`
- `render.yaml`

Do not deploy an old build that still contains `microfinance-sooty.vercel.app`.

## 2. Deploy Backend On Render

Recommended method: use the root `render.yaml` as a Render Blueprint.

1. Open Render Dashboard.
2. Choose New > Blueprint.
3. Connect your GitHub repository.
4. Select the repository root, not the `backend` folder only.
5. Render should detect `render.yaml`.
6. Apply the Blueprint.

The Blueprint creates:

- Web service: `microfinance-backend`
- PostgreSQL database: `microfinance-postgres`
- Health check path: `/api/health`

Important backend values:

```txt
Root directory: backend
Build command: npm ci && npm run build && npm run prisma:migrate:deploy && npm run prisma:seed
Start command: npm start
Health check path: /api/health
```

Environment variables:

```txt
NODE_ENV=production
CORS_ORIGIN=https://microfinancelive.netlify.app,https://microfinanceapplive.netlify.app
DATABASE_URL=<Render PostgreSQL internal connection string>
JWT_SECRET=<secure random value>
```

After deploy, open:

```txt
https://microfinance-backend-37jz.onrender.com/api/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

## 3. Deploy Frontend On Netlify

Create or update each Netlify site with these exact settings.

```txt
Base directory: frontend
Build command: npm ci && npm run build
Publish directory: dist
```

Environment variables:

```txt
VITE_API_URL=/api
```

If Netlify has this old value, delete it:

```txt
VITE_API_URL=https://microfinance-sooty.vercel.app
```

The frontend includes this Netlify proxy:

```txt
/api/* https://microfinance-backend-37jz.onrender.com/api/:splat 200!
/* /index.html 200
```

This means browser calls to:

```txt
https://microfinancelive.netlify.app/api/auth/login
```

are forwarded by Netlify to:

```txt
https://microfinance-backend-37jz.onrender.com/api/auth/login
```

## 4. Redeploy With Cache Cleared

For both Netlify sites:

1. Open the Netlify site dashboard.
2. Go to Deploys.
3. Trigger deploy.
4. Choose clear cache and deploy site.

Do this after removing the old `microfinance-sooty.vercel.app` environment value.

## 5. Verify Login

Open both:

```txt
https://microfinancelive.netlify.app/login
https://microfinanceapplive.netlify.app/login
```

Use demo credentials:

```txt
Username: admin
Password: Password123!
```

In browser DevTools > Network, login should call:

```txt
/api/auth/login
```

It should not call:

```txt
https://microfinance-sooty.vercel.app/api/auth/login
```

## 6. Fix Common Errors

### Error: blocked by CORS

Cause: the frontend is calling the backend directly or using an old backend URL.

Fix:

- Set `VITE_API_URL=/api` in Netlify, or remove `VITE_API_URL`.
- Clear cache and redeploy.
- Confirm the production bundle no longer contains `microfinance-sooty.vercel.app`.

### Error: `/api/auth/login` returns 404

Cause: Netlify did not load the redirect/proxy rules.

Fix:

- Confirm Netlify Base directory is `frontend`.
- Confirm Publish directory is `dist`.
- Confirm `frontend/public/_redirects` exists before build.
- Confirm `dist/_redirects` exists after build.

### Error: backend health works but login fails

Cause: database, seed data, or JWT environment is wrong.

Fix:

- Check Render logs.
- Confirm `DATABASE_URL` points to Render PostgreSQL.
- Confirm `JWT_SECRET` exists.
- Confirm Render ran Prisma migration and seed successfully.
