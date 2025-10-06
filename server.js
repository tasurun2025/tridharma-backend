// backend/server.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { openDb } = require('./db');
const XLSX = require('xlsx');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname,'uploads')));

if(!fs.existsSync(path.join(__dirname,'uploads'))){ fs.mkdirSync(path.join(__dirname,'uploads')); }

const upload = multer({ dest: path.join(__dirname,'uploads/'), limits: { fileSize: 10*1024*1024 } });
const JWT_SECRET = process.env.JWT_SECRET || 'ubah_rahasia_ini';

async function query(sql, params){ const db = await openDb(); return db.run(sql, params); }
async function get(sql, params){ const db = await openDb(); return db.get(sql, params); }
async function all(sql, params){ const db = await openDb(); return db.all(sql, params); }

// Register (initial admin sebaiknya dibuat manual via migration or script)
app.post('/api/register', async (req,res)=>{
  try{
    const { name, email, password, role, prodi, nidn } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const db = await openDb();
    const r = await db.run('INSERT INTO users (name,email,password,role,prodi,nidn) VALUES (?,?,?,?,?,?)', [name,email,hash,role,prodi,nidn]);
    res.json({ ok:true, id: r.lastID });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

// Login
app.post('/api/login', async (req,res)=>{
  try{
    const { email, password } = req.body;
    const db = await openDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if(!user) return res.status(401).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ id: user.id, role: user.role, prodi: user.prodi, name: user.name, nidn: user.nidn }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, prodi: user.prodi, nidn: user.nidn } });
  }catch(e){ res.status(500).json({error: e.message}); }
});

function auth(req,res,next){
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({ error:'No token' });
  const token = h.split(' ')[1];
  try{ const data = jwt.verify(token, JWT_SECRET); req.user = data; next(); } catch(e){ return res.status(401).json({ error:'Invalid token' }); }
}

// Dosen endpoints
app.post('/api/dosen', auth, async (req,res)=>{
  if(!['admin_pusat','admin_prodi'].includes(req.user.role)) return res.status(403).json({ error:'Forbidden' });
  const { name, prodi, nidn } = req.body;
  const db = await openDb();
  const r = await db.run('INSERT INTO dosen (name,prodi,nidn) VALUES (?,?,?)', [name,prodi,nidn]);
  res.json({ ok:true, id: r.lastID });
});

app.get('/api/dosen', auth, async (req,res)=>{
  const db = await openDb();
  if(req.user.role === 'admin_pusat') return res.json(await db.all('SELECT * FROM dosen'));
  if(req.user.role === 'admin_prodi') return res.json(await db.all('SELECT * FROM dosen WHERE prodi = ?', [req.user.prodi]));
  return res.json(await db.all('SELECT * FROM dosen WHERE nidn = ?', [req.user.nidn]));
});

// Create kegiatan with optional file
app.post('/api/kegiatan', auth, upload.single('file'), async (req,res)=>{
  try{
    const body = req.body;
    let filePath = null;
    if(req.file){ filePath = `/uploads/${req.file.filename}`; }
    const db = await openDb();
    const r = await db.run('INSERT INTO kegiatan (type, prodi, user_name, user_id, data_json, file_path, created_at) VALUES (?,?,?,?,?,?,?)', [body.type, body.prodi, req.user.name, req.user.id, JSON.stringify(body), filePath, new Date().toISOString()]);
    res.json({ ok:true, id: r.lastID });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

// Get kegiatan
app.get('/api/kegiatan', auth, async (req,res)=>{
  const db = await openDb();
  let rows;
  if(req.user.role === 'admin_pusat') rows = await db.all('SELECT * FROM kegiatan ORDER BY id DESC');
  else if(req.user.role === 'admin_prodi') rows = await db.all('SELECT * FROM kegiatan WHERE prodi = ? ORDER BY id DESC', [req.user.prodi]);
  else rows = await db.all('SELECT * FROM kegiatan WHERE user_name = ? ORDER BY id DESC', [req.user.name]);
  rows = rows.map(r => ({...r, data: r.data_json ? JSON.parse(r.data_json) : null}));
  res.json(rows);
});

// Import Excel (kegiatan)
app.post('/api/import/excel', auth, upload.single('file'), async (req,res)=>{
  if(!req.file) return res.status(400).json({ error: 'No file' });
  const workbook = XLSX.readFile(req.file.path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  const db = await openDb();
  for(const row of data){
    await db.run('INSERT INTO kegiatan (type, prodi, user_name, user_id, data_json, created_at) VALUES (?,?,?,?,?,?)', [row.type || 'penelitian', row.prodi || req.user.prodi, req.user.name, req.user.id, JSON.stringify(row), new Date().toISOString()]);
  }
  res.json({ ok:true, imported: data.length });
});

// Export Excel (download kegiatan)
app.get('/api/export/excel', auth, async (req,res)=>{
  const db = await openDb();
  let rows = await db.all('SELECT * FROM kegiatan ORDER BY id DESC');
  rows = rows.map(r => ({ id: r.id, type: r.type, prodi: r.prodi, user_name: r.user_name, created_at: r.created_at, data: r.data_json }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'kegiatan');
  const tmp = path.join(__dirname, 'exports');
  if(!fs.existsSync(tmp)) fs.mkdirSync(tmp);
  const filePath = path.join(tmp, `kegiatan_${Date.now()}.xlsx`);
  XLSX.writeFile(wb, filePath);
  res.download(filePath);
});

// download file route already served via /uploads

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log('Server running on', PORT));
