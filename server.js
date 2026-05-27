const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Configurar multer para subida de imágenes desde admin
const adminStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { tipo } = req.body;
        const dir = path.join(__dirname, 'storage', tipo || 'perfiles');
        require('fs').mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: adminStorage });

// Rutas
const authRoutes = require('./backend/routes/auth');
const casosRoutes = require('./backend/routes/casos');
const whatsappRoutes = require('./backend/routes/whatsapp');
const adminRoutes = require('./backend/routes/admin');
const testimoniosRoutes = require('./backend/routes/testimonios');
const plantillasRoutes = require('./backend/routes/plantillas');
const tiposCasoRoutes = require('./backend/routes/tiposCaso');

app.use('/api/auth', authRoutes);
app.use('/api/casos', casosRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/testimonios', testimoniosRoutes);
app.use('/api/plantillas', plantillasRoutes);
app.use('/api/tipos-caso', tiposCasoRoutes);

// Ruta especial para subir imágenes (admin)
app.post('/api/upload', upload.single('imagen'), (req, res) => {
    if (req.file) {
        const { tipo } = req.body;
        res.json({ success: true, url: `/storage/${tipo}/${req.file.filename}` });
    } else {
        res.status(400).json({ error: 'No se subió ningún archivo' });
    }
});

// Rutas frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin', 'index.html'));
});

app.get('/admin/:page', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin', `${req.params.page}.html`));
});

app.listen(PORT, () => {
    console.log(`⚖️ Servidor LexPenal corriendo en http://localhost:${PORT}`);
    console.log(`📱 WhatsApp: ${process.env.WHATSAPP_NUMBER}`);
    console.log(`👑 Admin login: cédula 1018457093 / contraseña ACT1018457093`);
});