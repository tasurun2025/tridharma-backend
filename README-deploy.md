1. Backend
   - cd backend
   - npm install
   - node migrate.js
   - set env: JWT_SECRET='isi_rahasia'
   - npm start
   - Host: Render/Heroku/VPS

2. Frontend
   - cd tridharma-app
   - npm install
   - set VITE_API_BASE to https://your-backend.example.com
   - npm run build
   - Deploy build/ to Netlify/Vercel/hosting statis

3. Integrasi ke Blogspot
   - Gunakan iframe pointing to deployed frontend (open in new tab disarankan)

Notes: For file uploads and CORS ensure backend allows origin of frontend and sets appropriate headers.
