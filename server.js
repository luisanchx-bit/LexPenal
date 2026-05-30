const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const JWT_SECRET = 'lexpenal_seguro_2026_muy_secreto';
const app = express();
const PORT = process.env.PORT || 3000;

// Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://fxfwcfanzqnegdyheklv.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const DATA_FILE = path.join(__dirname, 'database.json');

let memoriaDB = {
    usuarios: [],
    consultas: [],
    citas: [],
    testimonios: [],
    plantillas: [],
    documentos_generados: [],
    tipos_caso: [],
    configuracion: {},
    abogado: {},
    tokens_recuperacion: []
};

function initDB() {
    const adminHash = bcrypt.hashSync("ACT1018457093", 10);
    
    memoriaDB.usuarios = [
        { id: 1, cedula: "1018457093", nombre_completo: "Asmairo De Jesus Conde Torres", email: "asmairo.conde.torres@hotmail.com", contrasena_hash: adminHash, rol: "super_admin", fecha_registro: new Date().toISOString() }
    ];
    memoriaDB.testimonios = [{ id: 1, cliente: "Cliente anónimo", texto: "Excelente profesional", aprobado: true, fecha: new Date().toISOString().split('T')[0] }];
    memoriaDB.tipos_caso = [
        { id: 1, nombre: "Homicidio", icono: "⚖️", orden: 1 },
        { id: 2, nombre: "Violación", icono: "🛡️", orden: 2 },
        { id: 3, nombre: "Robo", icono: "🔒", orden: 3 },
        { id: 4, nombre: "Apelaciones", icono: "📄", orden: 4 },
        { id: 5, nombre: "Citaciones", icono: "📅", orden: 5 },
        { id: 6, nombre: "Trámites Legales", icono: "📋", orden: 6 }
    ];
    memoriaDB.configuracion = { 
        colores: { dorado: "#C8A951", azul: "#0A1628", fondo: "#000000" }, 
        textos: { hero_titulo: "Defensa Penal Estratégica", hero_subtitulo: "Más de 6 años protegiendo tus derechos" },
        tema: 'oscuro'
    };
    memoriaDB.abogado = { nombre: "Asmairo Conde Torres", telefono: "573145879875", email: "asmairo.conde.torres@hotmail.com" };
    memoriaDB.consultas = [];
    memoriaDB.citas = [];
    memoriaDB.plantillas = [];
    memoriaDB.documentos_generados = [];
    memoriaDB.tokens_recuperacion = [];

    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const archivoDB = JSON.parse(data);
            if (archivoDB.consultas) memoriaDB.consultas = archivoDB.consultas;
            if (archivoDB.citas) memoriaDB.citas = archivoDB.citas;
            if (archivoDB.usuarios) memoriaDB.usuarios = archivoDB.usuarios;
            if (archivoDB.testimonios) memoriaDB.testimonios = archivoDB.testimonios;
            if (archivoDB.plantillas) memoriaDB.plantillas = archivoDB.plantillas;
            if (archivoDB.documentos_generados) memoriaDB.documentos_generados = archivoDB.documentos_generados;
            if (archivoDB.tipos_caso) memoriaDB.tipos_caso = archivoDB.tipos_caso;
            if (archivoDB.configuracion) memoriaDB.configuracion = archivoDB.configuracion;
            if (archivoDB.abogado) memoriaDB.abogado = archivoDB.abogado;
            console.log('✅ Datos cargados');
        } catch (e) {
            console.log('⚠️ Error al leer database.json');
        }
    } else {
        guardarDB();
        console.log('✅ Base de datos inicializada');
    }
}

function guardarDB() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(memoriaDB, null, 2));
    } catch (e) {
        console.log('⚠️ Error al guardar');
    }
}

function readDB() { return memoriaDB; }
function writeDB(data) { memoriaDB = data; guardarDB(); }

initDB();

function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    try {
        req.usuario = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        next();
    } catch (error) { 
        return res.status(401).json({ error: 'Token inválido' }); 
    }
}

function verificarAdmin(req, res, next) {
    // Permitir acceso a super_admin e ingeniero
    if (req.usuario.rol === 'super_admin' || req.usuario.rol === 'ingeniero') {
        next();
    } else {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
}

// ==================== LOGIN UNIFICADO ====================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { cedula, contrasena } = req.body;
        
        console.log(`🔐 Intento de login: ${cedula}`);
        
        // INGENIERO (hardcodeado)
        if (cedula === "1052041627" && contrasena === "123luisancho") {
            const token = jwt.sign(
                { id: 999, cedula: "1052041627", nombre: "Luis Angel Caballero Ortega", rol: 'ingeniero' },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            console.log('✅ Login ingeniero exitoso');
            return res.json({ 
                success: true, 
                token, 
                nombre: "Luis Angel Caballero Ortega", 
                cedula: "1052041627", 
                rol: 'ingeniero'
            });
        }
        
        // ADMIN (hardcodeado)
        if (cedula === "1018457093" && contrasena === "ACT1018457093") {
            const token = jwt.sign(
                { id: 1, cedula: "1018457093", nombre: "Asmairo De Jesus Conde Torres", rol: 'super_admin' },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            console.log('✅ Login admin exitoso');
            return res.json({ 
                success: true, 
                token, 
                nombre: "Asmairo De Jesus Conde Torres", 
                cedula: "1018457093", 
                rol: 'super_admin'
            });
        }
        
        // Usuarios normales (base de datos)
        const db = readDB();
        const usuario = db.usuarios.find(u => u.cedula === cedula);
        if (!usuario) {
            console.log('❌ Cédula no registrada');
            return res.status(401).json({ error: 'Cédula no registrada' });
        }
        if (!await bcrypt.compare(contrasena, usuario.contrasena_hash)) {
            console.log('❌ Contraseña incorrecta');
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, cedula: usuario.cedula, nombre: usuario.nombre_completo, rol: usuario.rol || 'cliente' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        console.log('✅ Login usuario normal exitoso');
        res.json({ success: true, token, nombre: usuario.nombre_completo, cedula: usuario.cedula, rol: usuario.rol || 'cliente' });
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// ==================== RUTA PARA VERIFICAR TOKEN ====================
app.get('/api/auth/verificar', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ valid: true, usuario: decoded });
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

// ==================== RUTA DE DIAGNÓSTICO ====================
app.get('/api/diagnostico', verificarToken, verificarAdmin, (req, res) => {
    const db = readDB();
    res.json({
        status: 'ok',
        usuario: req.usuario,
        timestamp: new Date().toISOString(),
        servidor: {
            uptime: process.uptime(),
            memoria: process.memoryUsage().heapUsed / 1024 / 1024,
            node_version: process.version
        },
        base_datos: {
            consultas: db.consultas.length,
            citas: db.citas.length,
            usuarios: db.usuarios.length,
            plantillas: db.plantillas.length
        }
    });
});

// ==================== RUTA DE LOGS ====================
let logs = [];
app.post('/api/logs', verificarToken, verificarAdmin, (req, res) => {
    const { mensaje, tipo } = req.body;
    logs.unshift({ timestamp: new Date().toISOString(), mensaje, tipo });
    if (logs.length > 100) logs.pop();
    res.json({ success: true });
});
app.get('/api/logs', verificarToken, verificarAdmin, (req, res) => {
    res.json(logs);
});

// ==================== RUTAS DE PLANTILLAS ====================
app.get('/api/plantillas', verificarToken, verificarAdmin, (req, res) => { 
    const db = readDB(); 
    res.json(db.plantillas || []); 
});

app.post('/api/plantillas/subir', verificarToken, verificarAdmin, upload.single('archivo'), async (req, res) => {
    try {
        const archivo = req.file;
        const { nombre, clave } = req.body;
        if (!archivo) return res.status(400).json({ error: 'No se subió ningún archivo' });
        
        const texto = fs.readFileSync(archivo.path, 'utf8');
        const regex = /\[([A-Z_]+)\]/g;
        const campos = [];
        let match;
        while ((match = regex.exec(texto)) !== null) {
            if (!campos.includes(match[1])) campos.push(match[1]);
        }
        
        const db = readDB();
        const nuevaPlantilla = { 
            id: db.plantillas.length + 1, 
            nombre, 
            clave, 
            cuerpo: texto,
            campos_editables: campos.length > 0 ? campos : ['NOMBRE_CLIENTE', 'CEDULA_CLIENTE', 'DESCRIPCION_HECHOS'], 
            fecha_creacion: new Date().toISOString().split('T')[0] 
        };
        db.plantillas.push(nuevaPlantilla);
        writeDB(db);
        fs.unlinkSync(archivo.path);
        
        res.json({ success: true, plantilla: nuevaPlantilla });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

app.delete('/api/plantillas/:id', verificarToken, verificarAdmin, (req, res) => { 
    const db = readDB(); 
    db.plantillas = db.plantillas.filter(p => p.id !== parseInt(req.params.id)); 
    writeDB(db); 
    res.json({ success: true }); 
});

// ==================== ADMIN DASHBOARD ====================
app.get('/api/admin/dashboard', verificarToken, verificarAdmin, (req, res) => {
    const db = readDB();
    res.json({ 
        total_consultas: db.consultas.length,
        total_citas: db.citas.length,
        consultas_pendientes: db.consultas.filter(c => c.estado === 'pendiente').length,
        citas_pendientes: db.citas.filter(c => c.estado === 'pendiente').length
    });
});

// ==================== WHATSAPP ====================
app.get('/api/whatsapp/contacto', verificarToken, (req, res) => {
    res.json({ url: `https://wa.me/573145879875?text=Hola,%20soy%20${req.usuario.nombre}` });
});

// ==================== FRONTEND ====================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'index.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'admin', 'index.html')); });
app.get('/admin/ingeniero.html', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'admin', 'ingeniero.html')); });
app.get('/admin/:page', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'admin', `${req.params.page}.html`)); });

app.listen(PORT, () => {
    console.log(`⚖️ Servidor LexPenal corriendo en http://localhost:${PORT}`);
    console.log(`👑 Admin: 1018457093 / ACT1018457093`);
    console.log(`🔧 Ingeniero: 1052041627 / 123luisancho`);
    console.log(`📊 Diagnóstico: /api/diagnostico (requiere token)`);
});