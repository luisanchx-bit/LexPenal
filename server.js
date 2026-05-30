const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const os = require('os');

const JWT_SECRET = process.env.JWT_SECRET || 'lexpenal_seguro_2026_muy_secreto';
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de multer
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

// Datos en memoria
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

let logsSistema = [];

function agregarLogSistema(mensaje, tipo = 'info') {
    const log = {
        id: logsSistema.length + 1,
        timestamp: new Date().toISOString(),
        mensaje,
        tipo
    };
    logsSistema.unshift(log);
    if (logsSistema.length > 200) logsSistema.pop();
    console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
}

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
            agregarLogSistema('Base de datos cargada', 'success');
        } catch (e) {
            agregarLogSistema('Error al leer database.json', 'warning');
        }
    } else {
        guardarDB();
        agregarLogSistema('Base de datos inicializada', 'success');
    }
}

function guardarDB() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(memoriaDB, null, 2));
    } catch (e) {
        agregarLogSistema('Error al guardar database.json', 'error');
    }
}

function readDB() { 
    return memoriaDB; 
}

function writeDB(data) { 
    memoriaDB = data; 
    guardarDB(); 
}

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
    if (req.usuario.rol === 'super_admin') {
        next();
    } else {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
}

// ==================== LOGIN UNIFICADO ====================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { cedula, contrasena } = req.body;
        
        // INGENIERO
        if (cedula === "1052041627" && contrasena === "123luisancho") {
            const token = jwt.sign(
                { id: 999, cedula: "1052041627", nombre: "Luis Angel Caballero Ortega", rol: 'ingeniero' },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            agregarLogSistema(`🔧 Acceso ingeniero: ${cedula}`, 'info');
            return res.json({ 
                success: true, 
                token, 
                nombre: "Luis Angel Caballero Ortega", 
                cedula: "1052041627", 
                rol: 'ingeniero'
            });
        }
        
        // ADMIN
        if (cedula === "1018457093" && contrasena === "ACT1018457093") {
            const token = jwt.sign(
                { id: 1, cedula: "1018457093", nombre: "Asmairo De Jesus Conde Torres", rol: 'super_admin' },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            agregarLogSistema(`👑 Acceso administrador: ${cedula}`, 'info');
            return res.json({ 
                success: true, 
                token, 
                nombre: "Asmairo De Jesus Conde Torres", 
                cedula: "1018457093", 
                rol: 'super_admin'
            });
        }
        
        const db = readDB();
        const usuario = db.usuarios.find(u => u.cedula === cedula);
        if (!usuario) {
            return res.status(401).json({ error: 'Cédula no registrada' });
        }
        if (!await bcrypt.compare(contrasena, usuario.contrasena_hash)) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, cedula: usuario.cedula, nombre: usuario.nombre_completo, rol: usuario.rol || 'cliente' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        agregarLogSistema(`✅ Usuario autenticado: ${cedula}`, 'success');
        res.json({ success: true, token, nombre: usuario.nombre_completo, cedula: usuario.cedula, rol: usuario.rol || 'cliente' });
        
    } catch (error) {
        agregarLogSistema(`❌ Error en login: ${error.message}`, 'error');
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// ==================== ADMIN DASHBOARD ====================
app.get('/api/admin/dashboard', verificarToken, verificarAdmin, (req, res) => {
    try {
        const db = readDB();
        const consultas = db.consultas || [];
        const citas = db.citas || [];
        
        const dashboardData = {
            total_consultas: consultas.length,
            total_citas: citas.length,
            consultas_pendientes: consultas.filter(c => c.estado === 'pendiente').length,
            citas_pendientes: citas.filter(c => c.estado === 'pendiente').length,
            testimonios_activos: db.testimonios.filter(t => t.aprobado).length,
            tipos_caso_total: db.tipos_caso.length
        };
        
        console.log('📊 Dashboard data:', dashboardData);
        res.json(dashboardData);
    } catch (error) {
        console.error('❌ Error en dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== OBTENER TODOS LOS REGISTROS ====================
app.get('/api/casos/todos', verificarToken, verificarAdmin, (req, res) => {
    try {
        const db = readDB();
        const consultas = db.consultas || [];
        const citas = db.citas || [];
        
        console.log(`📋 Enviando: ${consultas.length} consultas, ${citas.length} citas`);
        
        res.json({ 
            consultas: consultas, 
            citas: citas, 
            total: consultas.length + citas.length
        });
    } catch (error) {
        console.error('❌ Error en /casos/todos:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== RUTAS DE INGENIERO ====================

// Estado del sistema
app.get('/api/ingeniero/status', verificarToken, (req, res) => {
    try {
        if (req.usuario.rol !== 'ingeniero') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        res.json({
            success: true,
            sistema: {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                memoria_total: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                memoria_libre: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                uptime: os.uptime(),
                carga: os.loadavg()
            },
            node: {
                version: process.version,
                pid: process.pid,
                memoria: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB',
                uptime: process.uptime()
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Estadísticas
app.get('/api/ingeniero/stats', verificarToken, (req, res) => {
    try {
        if (req.usuario.rol !== 'ingeniero') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const db = readDB();
        res.json({
            success: true,
            total_consultas: db.consultas.length,
            total_citas: db.citas.length,
            usuarios: db.usuarios.length,
            plantillas: db.plantillas.length,
            documentos: db.documentos_generados?.length || 0
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Variables de entorno
app.get('/api/ingeniero/env', verificarToken, (req, res) => {
    try {
        if (req.usuario.rol !== 'ingeniero') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        res.json({
            success: true,
            NODE_ENV: process.env.NODE_ENV || 'production',
            JWT_SECRET: '••••••••',
            SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Configurada' : '❌ No configurada',
            WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER || 'No configurado'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Ejecutar SQL (simulado pero con datos reales)
app.post('/api/ingeniero/sql', verificarToken, (req, res) => {
    try {
        if (req.usuario.rol !== 'ingeniero') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const { query } = req.body;
        if (!query || !query.toLowerCase().startsWith('select')) {
            return res.status(400).json({ success: false, error: 'Solo consultas SELECT están permitidas' });
        }
        
        const db = readDB();
        let resultado = [];
        
        if (query.toLowerCase().includes('consultas')) {
            resultado = db.consultas.slice(0, 5);
        } else if (query.toLowerCase().includes('citas')) {
            resultado = db.citas.slice(0, 5);
        } else {
            resultado = [{ mensaje: 'Consulta ejecutada', registros: db.consultas.length + db.citas.length }];
        }
        
        res.json({ 
            success: true, 
            data: resultado,
            query: query
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Obtener logs
app.get('/api/ingeniero/logs', verificarToken, (req, res) => {
    try {
        if (req.usuario.rol !== 'ingeniero') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        res.json({ success: true, logs: logsSistema || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Agregar log
app.post('/api/ingeniero/log', verificarToken, (req, res) => {
    try {
        if (req.usuario.rol !== 'ingeniero') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const { mensaje, tipo } = req.body;
        agregarLogSistema(mensaje, tipo || 'info');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener archivos
app.get('/api/ingeniero/files', verificarToken, (req, res) => {
    try {
        if (req.usuario.rol !== 'ingeniero') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        function getFiles(dir, level = 0) {
            if (level > 2) return [{ name: '...', type: 'dir', size: null }];
            try {
                const items = fs.readdirSync(dir);
                return items.slice(0, 20).map(item => {
                    const fullPath = path.join(dir, item);
                    const isDir = fs.statSync(fullPath).isDirectory();
                    return {
                        name: item,
                        type: isDir ? 'dir' : 'file',
                        size: isDir ? null : (fs.statSync(fullPath).size / 1024).toFixed(1) + ' KB'
                    };
                });
            } catch(e) {
                return [];
            }
        }
        
        res.json({
            success: true,
            current_dir: __dirname,
            files: getFiles(__dirname)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
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
        while ((match = regex.exec(texto)) !== null) { if (!campos.includes(match[1])) campos.push(match[1]); }
        
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
        
        agregarLogSistema(`📄 Plantilla subida: ${nombre}`, 'success');
        res.json({ success: true, plantilla: nuevaPlantilla, campos_detectados: campos });
    } catch (error) { 
        agregarLogSistema(`❌ Error al subir plantilla: ${error.message}`, 'error');
        res.status(500).json({ error: 'Error: ' + error.message }); 
    }
});

app.delete('/api/plantillas/:id', verificarToken, verificarAdmin, (req, res) => { 
    const db = readDB(); 
    db.plantillas = db.plantillas.filter(p => p.id !== parseInt(req.params.id)); 
    writeDB(db); 
    agregarLogSistema(`🗑️ Plantilla eliminada: ID ${req.params.id}`, 'info');
    res.json({ success: true }); 
});

// ==================== CONSULTAS ====================
app.post('/api/consultas/nueva', upload.array('archivos'), async (req, res) => {
    try {
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
        
        agregarLogSistema(`📞 Nueva consulta: ${nombre} (${codigo})`, 'info');
        res.json({ success: true, codigo });
    } catch (error) { 
        agregarLogSistema(`❌ Error en consulta: ${error.message}`, 'error');
        res.status(500).json({ error: error.message }); 
    }
});

// ==================== CITAS ====================
app.post('/api/citas/nueva', (req, res) => {
    try {
        const { nombre, telefono, email, motivo, fecha, hora, rama } = req.body;
        const codigo = `CIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        const db = readDB();
        
        const citaExistente = db.citas.find(c => c.fecha === fecha && c.hora === hora && c.estado !== 'cancelada');
        if (citaExistente) {
            return res.status(400).json({ error: 'La fecha y hora seleccionadas ya no están disponibles' });
        }
        
        const nuevaCita = {
            id: db.citas.length + 1,
            codigo,
            nombre,
            telefono,
            email,
            motivo,
            fecha: fecha,
            hora: hora,
            rama: rama || 'general',
            fecha_registro: new Date().toISOString(),
            estado: 'pendiente',
            tipo: 'cita',
            recordatorio_enviado: false
        };
        db.citas.push(nuevaCita);
        writeDB(db);
        
        agregarLogSistema(`📅 Nueva cita: ${nombre} (${codigo}) para ${fecha} a las ${hora}`, 'info');
        res.json({ success: true, codigo });
    } catch (error) { 
        agregarLogSistema(`❌ Error en cita: ${error.message}`, 'error');
        res.status(500).json({ error: error.message }); 
    }
});

// ==================== CITAS OCUPADAS ====================
app.get('/api/citas/ocupadas', (req, res) => {
    const db = readDB();
    const citas = db.citas || [];
    const ocupadas = citas.filter(c => c.estado !== 'cancelada').map(c => ({ fecha: c.fecha, hora: c.hora }));
    res.json(ocupadas);
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
            agregarLogSistema(`📝 Estado actualizado: ${tipo} ID ${id} → ${estado}`, 'info');
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
        agregarLogSistema(`🗑️ Registro eliminado: ${tipo} ID ${id}`, 'info');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ADMIN GENERAL ====================
app.get('/api/admin/abogado', (req, res) => { const db = readDB(); res.json(db.abogado); });
app.put('/api/admin/abogado', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.abogado = { ...db.abogado, ...req.body }; writeDB(db); res.json({ success: true }); });
app.get('/api/admin/configuracion', (req, res) => { const db = readDB(); res.json(db.configuracion); });
app.put('/api/admin/configuracion', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.configuracion = { ...db.configuracion, ...req.body }; writeDB(db); res.json({ success: true }); });
app.get('/api/configuracion/tema', (req, res) => { const db = readDB(); res.json({ tema: db.configuracion.tema || 'oscuro' }); });
app.put('/api/configuracion/tema', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.configuracion.tema = req.body.tema; writeDB(db); res.json({ success: true }); });

// ==================== DOCUMENTOS GENERADOS ====================
app.get('/api/documentos-generados', verificarToken, verificarAdmin, (req, res) => {
    const db = readDB();
    res.json(db.documentos_generados || []);
});

app.delete('/api/documentos-generados/:id', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const db = readDB();
    db.documentos_generados = db.documentos_generados.filter(d => d.id !== parseInt(id));
    writeDB(db);
    res.json({ success: true });
});

// ==================== EXPORTAR DATOS ====================
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

app.get('/api/exportar/excel', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const db = readDB();
        const consultas = db.consultas || [];
        const citas = db.citas || [];
        
        const datosConsultas = consultas.map(c => ({
            'Código': c.codigo,
            'Nombre': c.nombre,
            'Teléfono': c.telefono,
            'Email': c.email,
            'Rama': c.rama,
            'Hechos': c.hechos,
            'Fecha': new Date(c.fecha).toLocaleString(),
            'Estado': c.estado
        }));
        
        const datosCitas = citas.map(c => ({
            'Código': c.codigo,
            'Nombre': c.nombre,
            'Teléfono': c.telefono,
            'Email': c.email,
            'Rama': c.rama,
            'Motivo': c.motivo,
            'Fecha Cita': c.fecha || 'N/A',
            'Hora': c.hora || 'N/A',
            'Estado': c.estado
        }));
        
        const wb = XLSX.utils.book_new();
        const wsConsultas = XLSX.utils.json_to_sheet(datosConsultas);
        const wsCitas = XLSX.utils.json_to_sheet(datosCitas);
        
        XLSX.utils.book_append_sheet(wb, wsConsultas, 'Consultas');
        XLSX.utils.book_append_sheet(wb, wsCitas, 'Citas');
        
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename=lexpenal_datos.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
        
        agregarLogSistema('📊 Exportación a Excel generada', 'info');
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ENVÍO DE RECORDATORIOS ====================
app.post('/api/enviar-recordatorios', verificarToken, verificarAdmin, async (req, res) => {
    const db = readDB();
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const fechaManana = manana.toISOString().split('T')[0];
    
    const citasManana = db.citas.filter(c => {
        if (!c.fecha || c.estado === 'cancelada' || c.recordatorio_enviado) return false;
        return c.fecha === fechaManana;
    });
    
    citasManana.forEach(cita => {
        agregarLogSistema(`📧 Recordatorio enviado a ${cita.nombre} para cita del ${cita.fecha} a las ${cita.hora}`, 'info');
        cita.recordatorio_enviado = true;
    });
    
    writeDB(db);
    res.json({ success: true, enviados: citasManana.length });
});

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

// ==================== WHATSAPP ====================
app.get('/api/whatsapp/contacto', verificarToken, (req, res) => {
    res.json({ url: `https://wa.me/573145879875?text=Hola,%20soy%20${req.usuario.nombre}` });
});

// ==================== DIAGNÓSTICO ====================
app.get('/api/diagnostico', verificarToken, verificarAdmin, (req, res) => {
    const db = readDB();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        consultas: db.consultas.length,
        citas: db.citas.length,
        usuarios: db.usuarios.length,
        plantillas: db.plantillas.length,
        documentos: db.documentos_generados?.length || 0
    });
});

// ==================== FRONTEND ====================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'index.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'admin', 'index.html')); });
app.get('/admin/:page', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'admin', `${req.params.page}.html`)); });
app.get('/evangelion-domain.html', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'evangelion-domain.html')); });

// ==================== INICIO DEL SERVIDOR ====================
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   🟢 SERVIDOR ACTIVO 🟢                    ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  🌐 URL:            http://localhost:${PORT}                               ║`);
    console.log(`║  👑 Admin:          /admin/index.html                         ║`);
    console.log(`║  🔧 Ingeniero:      /admin/ingeniero.html                     ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    agregarLogSistema('Servidor iniciado correctamente', 'success');
});