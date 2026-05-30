const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { PDFDocument } = require('pdf-lib');
const mammoth = require('mammoth');

const JWT_SECRET = 'lexpenal_seguro_2026_muy_secreto';
const app = express();
const PORT = process.env.PORT || 3000;

// Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://fxfwcfanzqnegdyheklv.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

// ============ BASE DE DATOS EN MEMORIA ============
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
            console.log('✅ Datos cargados del archivo database.json');
        } catch (e) {
            console.log('⚠️ Error al leer database.json, usando datos por defecto');
        }
    } else {
        guardarDB();
        console.log('✅ Base de datos inicializada');
    }
}

function guardarDB() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(memoriaDB, null, 2));
        console.log('💾 Datos guardados');
    } catch (e) {
        console.log('⚠️ Error al guardar');
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
    if (req.usuario.rol !== 'super_admin' && req.usuario.rol !== 'ingeniero' && req.usuario.cedula !== '1018457093') return res.status(403).json({ error: 'Acceso denegado' });
    next();
}

// ==================== RUTAS DE AUTENTICACIÓN ====================
app.post('/api/auth/registro', async (req, res) => {
    try {
        const { cedula, nombre_completo, email, contrasena } = req.body;
        if (!cedula || !nombre_completo || !contrasena) return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        if (cedula.length < 6) return res.status(400).json({ error: 'La cédula debe tener al menos 6 dígitos' });
        if (contrasena.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        
        const db = readDB();
        if (db.usuarios.find(u => u.cedula === cedula)) return res.status(400).json({ error: 'Esta cédula ya está registrada' });
        
        const hashedPassword = await bcrypt.hash(contrasena, 10);
        const nuevoUsuario = { id: db.usuarios.length + 1, cedula, nombre_completo, email: email || '', contrasena_hash: hashedPassword, rol: 'cliente', fecha_registro: new Date().toISOString() };
        db.usuarios.push(nuevoUsuario);
        writeDB(db);
        
        const token = jwt.sign({ id: nuevoUsuario.id, cedula, nombre: nombre_completo, rol: 'cliente' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, nombre: nombre_completo, cedula, isAdmin: false });
    } catch (error) { res.status(500).json({ error: 'Error en el servidor' }); }
});

// ==================== LOGIN UNIFICADO ====================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { cedula, contrasena } = req.body;
        
        // Verificar si es el ingeniero (hardcodeado)
        const INGENIERO_CEDULA = "1052041627";
        const INGENIERO_PASSWORD = "123luisancho";
        const INGENIERO_NOMBRE = "Luis Angel Caballero Ortega";
        
        if (cedula === INGENIERO_CEDULA && contrasena === INGENIERO_PASSWORD) {
            const token = jwt.sign(
                { id: 999, cedula: INGENIERO_CEDULA, nombre: INGENIERO_NOMBRE, rol: 'ingeniero' },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            return res.json({ 
                success: true, 
                token, 
                nombre: INGENIERO_NOMBRE, 
                cedula: INGENIERO_CEDULA, 
                rol: 'ingeniero',
                esIngeniero: true 
            });
        }
        
        // Verificar si es el administrador (hardcodeado)
        const ADMIN_CEDULA = "1018457093";
        const ADMIN_PASSWORD = "ACT1018457093";
        const ADMIN_NOMBRE = "Asmairo De Jesus Conde Torres";
        
        if (cedula === ADMIN_CEDULA && contrasena === ADMIN_PASSWORD) {
            const token = jwt.sign(
                { id: 1, cedula: ADMIN_CEDULA, nombre: ADMIN_NOMBRE, rol: 'super_admin' },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            return res.json({ 
                success: true, 
                token, 
                nombre: ADMIN_NOMBRE, 
                cedula: ADMIN_CEDULA, 
                rol: 'super_admin',
                esAdmin: true 
            });
        }
        
        // Buscar en la base de datos para otros usuarios
        const db = readDB();
        const usuario = db.usuarios.find(u => u.cedula === cedula);
        if (!usuario) return res.status(401).json({ error: 'Cédula no registrada' });
        if (!await bcrypt.compare(contrasena, usuario.contrasena_hash)) return res.status(401).json({ error: 'Contraseña incorrecta' });
        
        const token = jwt.sign(
            { id: usuario.id, cedula: usuario.cedula, nombre: usuario.nombre_completo, rol: usuario.rol || 'cliente' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ 
            success: true, 
            token, 
            nombre: usuario.nombre_completo, 
            cedula: usuario.cedula, 
            rol: usuario.rol || 'cliente' 
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// ==================== RECUPERACIÓN DE CONTRASEÑA ====================
app.post('/api/auth/recuperar', async (req, res) => {
    try {
        const { email } = req.body;
        const db = readDB();
        const usuario = db.usuarios.find(u => u.email === email);
        if (!usuario) return res.status(404).json({ error: 'Correo no registrado' });
        
        const token = crypto.randomBytes(32).toString('hex');
        const expira = new Date();
        expira.setHours(expira.getHours() + 1);
        
        db.tokens_recuperacion.push({ email, token, expira });
        writeDB(db);
        
        console.log(`🔐 Token de recuperación para ${email}: ${token}`);
        res.json({ success: true, mensaje: 'Si el correo está registrado, recibirás un enlace' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/restablecer', async (req, res) => {
    try {
        const { token, nuevaContrasena } = req.body;
        const db = readDB();
        const tokenObj = db.tokens_recuperacion.find(t => t.token === token && new Date(t.expira) > new Date());
        if (!tokenObj) return res.status(400).json({ error: 'Token inválido o expirado' });
        
        const usuario = db.usuarios.find(u => u.email === tokenObj.email);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        usuario.contrasena_hash = await bcrypt.hash(nuevaContrasena, 10);
        db.tokens_recuperacion = db.tokens_recuperacion.filter(t => t.token !== token);
        writeDB(db);
        
        res.json({ success: true, mensaje: 'Contraseña restablecida' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== SUBIR ARCHIVO A SUPABASE ====================
async function subirASupabase(filePath, fileName, carpeta) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const { data, error } = await supabase.storage
            .from('lexpenal')
            .upload(`${carpeta}/${Date.now()}-${fileName}`, fileBuffer, {
                contentType: 'application/octet-stream',
                upsert: false
            });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('lexpenal').getPublicUrl(data.path);
        return urlData.publicUrl;
    } catch (error) {
        console.error('Error subiendo a Supabase:', error);
        return null;
    }
}

// ==================== RUTAS DE PLANTILLAS ====================
app.post('/api/plantillas/subir', verificarToken, verificarAdmin, upload.single('archivo'), async (req, res) => {
    try {
        const archivo = req.file;
        const { nombre, clave, ubicacion, sububicacion } = req.body;
        if (!archivo) return res.status(400).json({ error: 'No se subió ningún archivo' });
        
        const filePath = archivo.path;
        const extension = archivo.originalname.split('.').pop().toLowerCase();
        
        const url = await subirASupabase(filePath, archivo.originalname, 'plantillas');
        
        let texto = '';
        if (extension === 'txt') {
            texto = fs.readFileSync(filePath, 'utf8');
        } else if (extension === 'pdf') {
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            texto = pdfData.text;
        } else if (extension === 'docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            texto = result.value;
        }
        
        const regex = /\[([A-Z_]+)\]/g;
        const campos = [];
        let match;
        while ((match = regex.exec(texto)) !== null) { if (!campos.includes(match[1])) campos.push(match[1]); }
        
        const db = readDB();
        const nuevaPlantilla = { 
            id: db.plantillas.length + 1, 
            nombre, 
            clave, 
            ubicacion: ubicacion || 'tramites', 
            sububicacion: sububicacion || '', 
            titulo: nombre, 
            cuerpo: texto,
            url: url,
            extension: extension,
            campos_editables: campos.length > 0 ? campos : ['NOMBRE_CLIENTE', 'CEDULA_CLIENTE', 'DESCRIPCION_HECHOS'], 
            fecha_creacion: new Date().toISOString().split('T')[0] 
        };
        db.plantillas.push(nuevaPlantilla);
        writeDB(db);
        fs.unlinkSync(filePath);
        
        res.json({ success: true, plantilla: nuevaPlantilla, campos_detectados: campos });
    } catch (error) { res.status(500).json({ error: 'Error: ' + error.message }); }
});

app.get('/api/plantillas', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); res.json(db.plantillas || []); });
app.get('/api/plantillas/public/:clave', (req, res) => {
    const db = readDB();
    const plantilla = db.plantillas.find(p => p.clave === req.params.clave);
    if (plantilla) { res.json(plantilla); } else { res.status(404).json({ error: 'Plantilla no encontrada' }); }
});
app.delete('/api/plantillas/:id', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.plantillas = db.plantillas.filter(p => p.id !== parseInt(req.params.id)); writeDB(db); res.json({ success: true }); });

// ==================== GENERAR DOCUMENTO ====================
app.post('/api/generar-documento', verificarToken, async (req, res) => {
    try {
        const { plantillaId, datos, archivosPrueba } = req.body;
        const db = readDB();
        const plantilla = db.plantillas.find(p => p.id === plantillaId);
        if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });
        
        let documentoGenerado = plantilla.cuerpo;
        for (const [key, value] of Object.entries(datos)) {
            documentoGenerado = documentoGenerado.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
        }
        
        const nuevoDoc = {
            id: db.documentos_generados.length + 1,
            usuario_id: req.usuario.id,
            usuario_nombre: req.usuario.nombre,
            plantilla_id: plantillaId,
            plantilla_nombre: plantilla.nombre,
            contenido: documentoGenerado,
            archivos_prueba: archivosPrueba || [],
            fecha_generacion: new Date().toISOString()
        };
        db.documentos_generados.push(nuevoDoc);
        writeDB(db);
        
        res.json({ success: true, documento: nuevoDoc });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

// ==================== RUTAS DE CONSULTAS ====================
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
            tipo: 'consulta',
            confirmado: false
        };
        db.consultas.push(nuevaConsulta);
        writeDB(db);
        
        res.json({ success: true, codigo });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// ==================== RUTAS DE CITAS ====================
app.post('/api/citas/nueva', (req, res) => {
    try {
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
            tipo: 'cita',
            recordatorio_enviado: false
        };
        db.citas.push(nuevaCita);
        writeDB(db);
        
        res.json({ success: true, codigo });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// ==================== OBTENER TODOS LOS REGISTROS ====================
app.get('/api/casos/todos', verificarToken, verificarAdmin, (req, res) => {
    try {
        const db = readDB();
        res.json({ 
            consultas: db.consultas || [], 
            citas: db.citas || [], 
            total: (db.consultas?.length || 0) + (db.citas?.length || 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/citas/ocupadas', (req, res) => {
    const db = readDB();
    const citas = db.citas || [];
    const fechasOcupadas = citas.filter(c => c.estado !== 'cancelada').map(c => c.fecha ? c.fecha.split('T')[0] : null).filter(f => f);
    res.json(fechasOcupadas);
});

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

// ==================== DIAGNÓSTICO ====================
app.get('/api/diagnostico', verificarToken, verificarAdmin, (req, res) => {
    const db = readDB();
    const consultas = db.consultas || [];
    const citas = db.citas || [];
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        servidor: {
            uptime: process.uptime(),
            memoria: process.memoryUsage(),
            node_version: process.version
        },
        base_datos: {
            consultas: consultas.length,
            citas: citas.length,
            usuarios: db.usuarios.length,
            plantillas: db.plantillas.length,
            documentos: db.documentos_generados?.length || 0
        },
        supabase: {
            configurada: !!process.env.SUPABASE_URL,
            url: process.env.SUPABASE_URL ? '✅ Configurada' : '❌ No configurada'
        }
    });
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
            'Fecha Cita': c.fecha ? new Date(c.fecha).toLocaleString() : 'N/A',
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
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/exportar/pdf', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const db = readDB();
        const consultas = db.consultas || [];
        const citas = db.citas || [];
        
        const doc = new PDFDocument({ margin: 50 });
        
        res.setHeader('Content-Disposition', 'attachment; filename=lexpenal_report.pdf');
        res.setHeader('Content-Type', 'application/pdf');
        
        doc.pipe(res);
        
        doc.fontSize(20).text('LexPenal - Reporte de Gestión', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generado: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(16).text('📞 Consultas', { underline: true });
        doc.moveDown(0.5);
        consultas.forEach((c, i) => {
            doc.fontSize(10).text(`${i + 1}. ${c.nombre} - ${c.codigo}`);
            doc.text(`   Teléfono: ${c.telefono} | Estado: ${c.estado}`);
            doc.text(`   Fecha: ${new Date(c.fecha).toLocaleDateString()}`);
            doc.moveDown(0.3);
        });
        
        doc.addPage();
        
        doc.fontSize(16).text('📅 Citas', { underline: true });
        doc.moveDown(0.5);
        citas.forEach((c, i) => {
            doc.fontSize(10).text(`${i + 1}. ${c.nombre} - ${c.codigo}`);
            doc.text(`   Teléfono: ${c.telefono} | Estado: ${c.estado}`);
            doc.text(`   Fecha Cita: ${c.fecha ? new Date(c.fecha).toLocaleString() : 'N/A'}`);
            doc.moveDown(0.3);
        });
        
        doc.end();
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ENVÍO DE RECORDATORIOS ====================
app.post('/api/enviar-recordatorios', verificarToken, verificarAdmin, async (req, res) => {
    const db = readDB();
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    
    const citasManana = db.citas.filter(c => {
        if (!c.fecha || c.estado === 'cancelada' || c.recordatorio_enviado) return false;
        const fechaCita = new Date(c.fecha);
        return fechaCita.toDateString() === manana.toDateString();
    });
    
    citasManana.forEach(cita => {
        console.log(`📧 Recordatorio para ${cita.nombre}: Su cita es mañana`);
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

// ==================== RUTAS DE ADMIN GENERAL ====================
app.get('/api/admin/abogado', (req, res) => { const db = readDB(); res.json(db.abogado); });
app.put('/api/admin/abogado', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.abogado = { ...db.abogado, ...req.body }; writeDB(db); res.json({ success: true }); });
app.get('/api/admin/configuracion', (req, res) => { const db = readDB(); res.json(db.configuracion); });
app.put('/api/admin/configuracion', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.configuracion = { ...db.configuracion, ...req.body }; writeDB(db); res.json({ success: true }); });
app.get('/api/configuracion/tema', (req, res) => { const db = readDB(); res.json({ tema: db.configuracion.tema || 'oscuro' }); });
app.put('/api/configuracion/tema', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.configuracion.tema = req.body.tema; writeDB(db); res.json({ success: true }); });

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
    console.log(`👑 Admin: cédula 1018457093 / ACT1018457093`);
    console.log(`🔧 Ingeniero: cédula 1052041627 / 123luisancho`);
});