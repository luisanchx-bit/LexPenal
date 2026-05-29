const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const JWT_SECRET = 'lexpenal_seguro_2026_muy_secreto';
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de multer para subir archivos
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

// ============ BASE DE DATOS EN MEMORIA ============
let memoriaDB = {
    usuarios: [],
    consultas: [],
    citas: [],
    testimonios: [],
    plantillas: [],
    tipos_caso: [],
    configuracion: {},
    abogado: {}
};

function initDB() {
    const adminHash = bcrypt.hashSync("ACT1018457093", 10);
    
    memoriaDB.usuarios = [{ id: 1, cedula: "1018457093", nombre_completo: "Asmairo De Jesus Conde Torres", contrasena_hash: adminHash, rol: "super_admin", fecha_registro: new Date().toISOString() }];
    memoriaDB.testimonios = [{ id: 1, cliente: "Cliente anónimo", texto: "Excelente profesional", aprobado: true, fecha: new Date().toISOString().split('T')[0] }];
    memoriaDB.tipos_caso = [
        { id: 1, nombre: "Homicidio", icono: "⚖️", orden: 1 },
        { id: 2, nombre: "Violación", icono: "🛡️", orden: 2 },
        { id: 3, nombre: "Robo", icono: "🔒", orden: 3 },
        { id: 4, nombre: "Apelaciones", icono: "📄", orden: 4 },
        { id: 5, nombre: "Citaciones", icono: "📅", orden: 5 },
        { id: 6, nombre: "Trámites Legales", icono: "📋", orden: 6 }
    ];
    memoriaDB.configuracion = { colores: { dorado: "#C8A951", azul: "#0A1628", fondo: "#000000" }, textos: { hero_titulo: "Defensa Penal Estratégica", hero_subtitulo: "Más de 6 años protegiendo tus derechos" } };
    memoriaDB.abogado = { nombre: "Asmairo Conde Torres", telefono: "573145879875", email: "asmairo.conde.torres@hotmail.com" };
    memoriaDB.consultas = [];
    memoriaDB.citas = [];
    memoriaDB.plantillas = [];

    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const archivoDB = JSON.parse(data);
            if (archivoDB.consultas) memoriaDB.consultas = archivoDB.consultas;
            if (archivoDB.citas) memoriaDB.citas = archivoDB.citas;
            if (archivoDB.usuarios) memoriaDB.usuarios = archivoDB.usuarios;
            if (archivoDB.testimonios) memoriaDB.testimonios = archivoDB.testimonios;
            if (archivoDB.plantillas) memoriaDB.plantillas = archivoDB.plantillas;
            if (archivoDB.tipos_caso) memoriaDB.tipos_caso = archivoDB.tipos_caso;
            if (archivoDB.configuracion) memoriaDB.configuracion = archivoDB.configuracion;
            if (archivoDB.abogado) memoriaDB.abogado = archivoDB.abogado;
            console.log('✅ Datos cargados del archivo database.json');
        } catch (e) {
            console.log('⚠️ Error al leer database.json, usando datos por defecto');
        }
    } else {
        guardarDB();
        console.log('✅ Base de datos inicializada con valores por defecto');
    }
}

function guardarDB() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(memoriaDB, null, 2));
        console.log('💾 Datos guardados en database.json');
    } catch (e) {
        console.log('⚠️ Error al guardar database.json');
    }
}

function readDB() { return memoriaDB; }
function writeDB(data) { 
    memoriaDB = data; 
    guardarDB();
}

initDB();

function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    try {
        req.usuario = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        next();
    } catch (error) { return res.status(401).json({ error: 'Token inválido' }); }
}

function verificarAdmin(req, res, next) {
    if (req.usuario.rol !== 'super_admin' && req.usuario.cedula !== '1018457093') return res.status(403).json({ error: 'Acceso denegado' });
    next();
}

// ==================== RUTAS DE AUTENTICACIÓN ====================
app.post('/api/auth/registro', async (req, res) => {
    try {
        const { cedula, nombre_completo, contrasena } = req.body;
        if (!cedula || !nombre_completo || !contrasena) return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        if (cedula.length < 6) return res.status(400).json({ error: 'La cédula debe tener al menos 6 dígitos' });
        if (contrasena.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        
        const db = readDB();
        if (db.usuarios.find(u => u.cedula === cedula)) return res.status(400).json({ error: 'Esta cédula ya está registrada' });
        
        const hashedPassword = await bcrypt.hash(contrasena, 10);
        const nuevoUsuario = { id: db.usuarios.length + 1, cedula, nombre_completo, contrasena_hash: hashedPassword, rol: 'cliente', fecha_registro: new Date().toISOString() };
        db.usuarios.push(nuevoUsuario);
        writeDB(db);
        
        const token = jwt.sign({ id: nuevoUsuario.id, cedula, nombre: nombre_completo, rol: 'cliente' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, nombre: nombre_completo, cedula, isAdmin: false });
    } catch (error) { res.status(500).json({ error: 'Error en el servidor' }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { cedula, contrasena } = req.body;
        const db = readDB();
        const usuario = db.usuarios.find(u => u.cedula === cedula);
        if (!usuario) return res.status(401).json({ error: 'Cédula no registrada' });
        if (!await bcrypt.compare(contrasena, usuario.contrasena_hash)) return res.status(401).json({ error: 'Contraseña incorrecta' });
        
        const token = jwt.sign({ id: usuario.id, cedula: usuario.cedula, nombre: usuario.nombre_completo, rol: usuario.rol }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, nombre: usuario.nombre_completo, cedula: usuario.cedula, isAdmin: usuario.rol === 'super_admin' });
    } catch (error) { res.status(500).json({ error: 'Error en el servidor' }); }
});

// ==================== RUTAS DE CONSULTAS ====================
app.post('/api/consultas/nueva', upload.array('archivos'), async (req, res) => {
    try {
        console.log('📝 Recibiendo consulta...');
        const { nombre, telefono, email, hechos, rama } = req.body;
        const codigo = `CON-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        const archivos = req.files ? req.files.map(f => ({ 
            nombre: f.originalname, 
            ruta: `/uploads/${f.filename}`,
            tamaño: (f.size / 1024).toFixed(2) + ' KB',
            tipo: f.mimetype
        })) : [];
        
        const db = readDB();
        const nuevaConsulta = {
            id: db.consultas.length + 1,
            codigo,
            nombre,
            telefono,
            email,
            hechos,
            rama: rama || 'general',
            archivos: archivos,
            tieneAudio: archivos.some(a => a.tipo && a.tipo.startsWith('audio')),
            fecha: new Date().toISOString(),
            estado: 'pendiente',
            tipo: 'consulta'
        };
        db.consultas.push(nuevaConsulta);
        writeDB(db);
        
        console.log(`✅ Consulta guardada: ${codigo} - ${nombre}`);
        res.json({ success: true, codigo, mensaje: 'Consulta guardada exitosamente' });
    } catch (error) { 
        console.error('❌ Error en consulta:', error);
        res.status(500).json({ error: error.message }); 
    }
});

// ==================== RUTAS DE CITAS ====================
app.post('/api/citas/nueva', (req, res) => {
    try {
        console.log('📝 Recibiendo cita...');
        const { nombre, telefono, email, motivo, fecha, rama } = req.body;
        const codigo = `CIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        const db = readDB();
        
        const fechaStr = fecha ? fecha.split('T')[0] : null;
        const citaExistente = db.citas.find(c => c.fecha && c.fecha.includes(fechaStr) && c.estado !== 'cancelada');
        if (citaExistente && fechaStr) {
            return res.status(400).json({ error: 'La fecha seleccionada ya no está disponible' });
        }
        
        const nuevaCita = {
            id: db.citas.length + 1,
            codigo,
            nombre,
            telefono,
            email,
            motivo,
            fecha,
            rama: rama || 'general',
            fecha_registro: new Date().toISOString(),
            estado: 'pendiente',
            tipo: 'cita'
        };
        db.citas.push(nuevaCita);
        writeDB(db);
        
        console.log(`✅ Cita guardada: ${codigo} - ${nombre} - ${fecha}`);
        res.json({ success: true, codigo, mensaje: 'Cita agendada exitosamente' });
    } catch (error) { 
        console.error('❌ Error en cita:', error);
        res.status(500).json({ error: error.message }); 
    }
});

// ==================== OBTENER TODOS LOS REGISTROS ====================
app.get('/api/casos/todos', verificarToken, verificarAdmin, (req, res) => {
    try {
        const db = readDB();
        console.log(`📊 Enviando datos: ${db.consultas.length} consultas, ${db.citas.length} citas`);
        res.json({ 
            consultas: db.consultas || [], 
            citas: db.citas || [], 
            total: (db.consultas?.length || 0) + (db.citas?.length || 0)
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== OBTENER CITAS OCUPADAS ====================
app.get('/api/citas/ocupadas', (req, res) => {
    const db = readDB();
    const citas = db.citas || [];
    const fechasOcupadas = citas.filter(c => c.estado !== 'cancelada').map(c => c.fecha ? c.fecha.split('T')[0] : null).filter(f => f);
    res.json(fechasOcupadas);
});

// ==================== ACTUALIZAR ESTADO ====================
app.put('/api/casos/:id/estado', verificarToken, verificarAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { estado, notas_admin, tipo } = req.body;
        const db = readDB();
        
        let lista = tipo === 'consulta' ? db.consultas : db.citas;
        const index = lista.findIndex(c => c.id === parseInt(id));
        
        if (index !== -1) {
            if (estado) lista[index].estado = estado;
            if (notas_admin !== undefined) lista[index].notas_admin = notas_admin;
            writeDB(db);
            res.json({ success: true });
        } else { 
            res.status(404).json({ error: 'No encontrado' }); 
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ELIMINAR REGISTRO ====================
app.delete('/api/casos/:id', verificarToken, verificarAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { tipo } = req.body;
        const db = readDB();
        
        if (tipo === 'consulta') {
            db.consultas = db.consultas.filter(c => c.id !== parseInt(id));
        } else {
            db.citas = db.citas.filter(c => c.id !== parseInt(id));
        }
        writeDB(db);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ADMIN DASHBOARD ====================
app.get('/api/admin/dashboard', verificarToken, verificarAdmin, (req, res) => {
    const db = readDB();
    const consultas = db.consultas || [];
    const citas = db.citas || [];
    res.json({ 
        total_consultas: consultas.length,
        total_citas: citas.length,
        consultas_pendientes: consultas.filter(c => c.estado === 'pendiente').length,
        citas_pendientes: citas.filter(c => c.estado === 'pendiente').length,
        testimonios_activos: db.testimonios.filter(t => t.aprobado).length,
        tipos_caso_total: db.tipos_caso.length 
    });
});

// ==================== RUTAS DE PLANTILLAS ====================
app.get('/api/plantillas', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); res.json(db.plantillas || []); });
app.get('/api/plantillas/public/:clave', (req, res) => {
    const db = readDB();
    const plantilla = db.plantillas.find(p => p.clave === req.params.clave);
    if (plantilla) { res.json(plantilla); } else { res.status(404).json({ error: 'Plantilla no encontrada' }); }
});
app.post('/api/plantillas/subir', verificarToken, verificarAdmin, upload.single('archivo'), async (req, res) => {
    try {
        const archivo = req.file;
        const { nombre, clave, ubicacion, sububicacion } = req.body;
        if (!archivo) return res.status(400).json({ error: 'No se subió ningún archivo' });
        const filePath = archivo.path;
        const extension = archivo.originalname.split('.').pop().toLowerCase();
        if (extension !== 'txt') { fs.unlinkSync(filePath); return res.status(400).json({ error: 'Solo se aceptan archivos .txt' }); }
        const texto = fs.readFileSync(filePath, 'utf8');
        const regex = /\[([A-Z_]+)\]/g;
        const campos = [];
        let match;
        while ((match = regex.exec(texto)) !== null) { if (!campos.includes(match[1])) campos.push(match[1]); }
        const db = readDB();
        const nuevaPlantilla = { id: db.plantillas.length + 1, nombre, clave, ubicacion: ubicacion || 'tramites', sububicacion: sububicacion || '', titulo: nombre, cuerpo: texto, campos_editables: campos.length > 0 ? campos : ['NOMBRE_CLIENTE', 'CEDULA_CLIENTE', 'DESCRIPCION_HECHOS'], fecha_creacion: new Date().toISOString().split('T')[0] };
        db.plantillas.push(nuevaPlantilla);
        writeDB(db);
        fs.unlinkSync(filePath);
        res.json({ success: true, plantilla: nuevaPlantilla, campos_detectados: campos });
    } catch (error) { res.status(500).json({ error: 'Error al procesar el archivo: ' + error.message }); }
});
app.delete('/api/plantillas/:id', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.plantillas = db.plantillas.filter(p => p.id !== parseInt(req.params.id)); writeDB(db); res.json({ success: true }); });

// ==================== RUTAS DE TESTIMONIOS ====================
app.get('/api/testimonios', (req, res) => { const db = readDB(); res.json(db.testimonios.filter(t => t.aprobado)); });
app.post('/api/testimonios', verificarToken, verificarAdmin, (req, res) => {
    const { cliente, texto, aprobado } = req.body;
    const db = readDB();
    const nuevoTestimonio = { id: db.testimonios.length + 1, cliente: cliente || 'Cliente anónimo', texto, aprobado: aprobado !== undefined ? aprobado : true, fecha: new Date().toISOString().split('T')[0] };
    db.testimonios.push(nuevoTestimonio);
    writeDB(db);
    res.json({ success: true, testimonio: nuevoTestimonio });
});
app.put('/api/testimonios/:id', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const { cliente, texto, aprobado } = req.body;
    const db = readDB();
    const index = db.testimonios.findIndex(t => t.id === parseInt(id));
    if (index !== -1) {
        db.testimonios[index] = { ...db.testimonios[index], cliente, texto, aprobado };
        writeDB(db);
        res.json({ success: true });
    } else { res.status(404).json({ error: 'Testimonio no encontrado' }); }
});
app.delete('/api/testimonios/:id', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const db = readDB();
    db.testimonios = db.testimonios.filter(t => t.id !== parseInt(id));
    writeDB(db);
    res.json({ success: true });
});

// ==================== RUTAS DE TIPOS DE CASO ====================
app.get('/api/tipos-caso', (req, res) => { const db = readDB(); res.json(db.tipos_caso); });
app.post('/api/tipos-caso', verificarToken, verificarAdmin, (req, res) => {
    const { nombre, icono, orden } = req.body;
    const db = readDB();
    const nuevoTipo = { id: db.tipos_caso.length + 1, nombre, icono: icono || '⚖️', orden: orden || db.tipos_caso.length + 1 };
    db.tipos_caso.push(nuevoTipo);
    writeDB(db);
    res.json({ success: true, tipo: nuevoTipo });
});
app.put('/api/tipos-caso/:id', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const { nombre, icono, orden } = req.body;
    const db = readDB();
    const index = db.tipos_caso.findIndex(t => t.id === parseInt(id));
    if (index !== -1) {
        db.tipos_caso[index] = { ...db.tipos_caso[index], nombre, icono, orden };
        writeDB(db);
        res.json({ success: true });
    } else { res.status(404).json({ error: 'Tipo no encontrado' }); }
});
app.delete('/api/tipos-caso/:id', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const db = readDB();
    db.tipos_caso = db.tipos_caso.filter(t => t.id !== parseInt(id));
    writeDB(db);
    res.json({ success: true });
});

// ==================== RUTAS DE ADMIN GENERAL ====================
app.get('/api/admin/abogado', (req, res) => { const db = readDB(); res.json(db.abogado); });
app.put('/api/admin/abogado', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.abogado = { ...db.abogado, ...req.body }; writeDB(db); res.json({ success: true }); });
app.get('/api/admin/configuracion', (req, res) => { const db = readDB(); res.json(db.configuracion); });
app.put('/api/admin/configuracion', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.configuracion = { ...db.configuracion, ...req.body }; writeDB(db); res.json({ success: true }); });

// ==================== WHATSAPP ====================
app.get('/api/whatsapp/contacto', verificarToken, (req, res) => {
    res.json({ url: `https://wa.me/573145879875?text=Hola,%20soy%20el%20cliente%20con%20cédula%20${req.usuario.cedula}` });
});

// ==================== FRONTEND ====================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'index.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'admin', 'index.html')); });
app.get('/admin/:page', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'admin', `${req.params.page}.html`)); });

app.listen(PORT, () => {
    console.log(`⚖️ Servidor LexPenal corriendo en http://localhost:${PORT}`);
    console.log(`👑 Admin: cédula 1018457093 / contraseña ACT1018457093`);
    console.log(`📊 Diagnóstico: http://localhost:${PORT}/api/diagnostico`);
});