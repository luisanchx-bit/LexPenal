const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const JWT_SECRET = 'lexpenal_seguro_2026_muy_secreto';
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

const upload = multer({ dest: 'uploads/' });
const DATA_FILE = path.join(__dirname, 'database.json');

function initDB() {
    if (!fs.existsSync(DATA_FILE)) {
        const adminHash = bcrypt.hashSync("ACT1018457093", 10);
        const initialData = {
            usuarios: [{ id: 1, cedula: "1018457093", nombre_completo: "Asmairo De Jesus Conde Torres", contrasena_hash: adminHash, rol: "super_admin", fecha_registro: new Date().toISOString() }],
            casos: [],
            testimonios: [{ id: 1, cliente: "Cliente anónimo", texto: "Excelente profesional", aprobado: true, fecha: "2026-01-15" }],
            plantillas: [],
            tipos_caso: [
                { id: 1, nombre: "Homicidio", icono: "⚖️", orden: 1 },
                { id: 2, nombre: "Violación", icono: "🛡️", orden: 2 },
                { id: 3, nombre: "Robo", icono: "🔒", orden: 3 }
            ],
            configuracion: { colores: { dorado: "#C8A951", azul: "#0A1628", fondo: "#000000" }, textos: { hero_titulo: "Defensa Penal Estratégica", hero_subtitulo: "Más de 6 años protegiendo tus derechos" } },
            abogado: { nombre: "Asmairo Conde Torres", telefono: "573145879875", email: "asmairo.conde.torres@hotmail.com" }
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
        console.log('✅ Base de datos inicializada');
    }
}

function readDB() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function writeDB(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
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

// ==================== FUNCIÓN PARA EXTRAER TEXTO DE CUALQUIER ARCHIVO ====================
async function extraerTexto(filePath, extension) {
    let texto = '';
    
    if (extension === 'txt') {
        texto = fs.readFileSync(filePath, 'utf8');
    }
    else if (extension === 'pdf') {
        try {
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            texto = pdfData.text;
        } catch (error) {
            console.error('Error PDF:', error);
            texto = '';
        }
    }
    else if (extension === 'docx') {
        try {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ path: filePath });
            texto = result.value;
        } catch (error) {
            console.error('Error DOCX:', error);
            texto = '';
        }
    }
    else if (extension === 'doc') {
        try {
            const { exec } = require('child_process');
            const tempTxt = filePath + '.txt';
            await execPromise(`catdoc "${filePath}" > "${tempTxt}"`);
            texto = fs.readFileSync(tempTxt, 'utf8');
            fs.unlinkSync(tempTxt);
        } catch (error) {
            texto = '';
        }
    }
    else if (extension === 'xlsx' || extension === 'xls') {
        try {
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(filePath);
            const sheets = workbook.SheetNames;
            texto = '';
            for (const sheet of sheets) {
                const worksheet = workbook.Sheets[sheet];
                const data = XLSX.utils.sheet_to_csv(worksheet);
                texto += data + '\n';
            }
        } catch (error) {
            texto = '';
        }
    }
    else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].includes(extension)) {
        try {
            const Tesseract = require('tesseract.js');
            const result = await Tesseract.recognize(filePath, 'spa');
            texto = result.data.text;
        } catch (error) {
            texto = '';
        }
    }
    
    return texto;
}

// ==================== RUTAS DE AUTENTICACIÓN ====================
app.post('/api/auth/registro', async (req, res) => {
    try {
        const { cedula, nombre_completo, contrasena } = req.body;
        if (!cedula || !nombre_completo || !contrasena) return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        const db = readDB();
        if (db.usuarios.find(u => u.cedula === cedula)) return res.status(400).json({ error: 'Cédula ya registrada' });
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

// ==================== RUTAS DE PLANTILLAS ====================
app.get('/api/plantillas', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); res.json(db.plantillas || []); });

app.get('/api/plantillas/public/:clave', (req, res) => {
    const db = readDB();
    const plantilla = db.plantillas.find(p => p.clave === req.params.clave);
    if (plantilla) {
        res.json({ id: plantilla.id, nombre: plantilla.nombre, titulo: plantilla.titulo, cuerpo: plantilla.cuerpo, campos_editables: plantilla.campos_editables });
    } else { res.status(404).json({ error: 'Plantilla no encontrada' }); }
});

app.post('/api/plantillas/subir', verificarToken, verificarAdmin, upload.single('archivo'), async (req, res) => {
    try {
        const archivo = req.file;
        const nombrePlantilla = req.body.nombre;
        const clave = req.body.clave;
        const ubicacion = req.body.ubicacion;
        const sububicacion = req.body.sububicacion;
        
        if (!archivo) return res.status(400).json({ error: 'No se subió ningún archivo' });
        
        let texto = '';
        const filePath = archivo.path;
        const extension = archivo.originalname.split('.').pop().toLowerCase();
        
        // Extraer texto según el tipo de archivo
        texto = await extraerTexto(filePath, extension);
        
        if (!texto || texto.trim() === '') {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: `No se pudo extraer texto del archivo ${extension}. Asegúrate que no esté vacío o protegido.` });
        }
        
        // Detectar variables entre [CORCHETES]
        const regex = /\[([A-Z_]+)\]/g;
        const camposEncontrados = [];
        let match;
        while ((match = regex.exec(texto)) !== null) {
            if (!camposEncontrados.includes(match[1])) camposEncontrados.push(match[1]);
        }
        const camposEditables = camposEncontrados.length > 0 ? camposEncontrados : ['NOMBRE_CLIENTE', 'CEDULA_CLIENTE', 'DESCRIPCION_HECHOS'];
        
        const db = readDB();
        const nuevaPlantilla = {
            id: db.plantillas.length + 1,
            nombre: nombrePlantilla,
            clave: clave,
            ubicacion: ubicacion,
            sububicacion: sububicacion,
            titulo: `Documento: ${nombrePlantilla}`,
            cuerpo: texto,
            campos_editables: camposEditables,
            fecha_creacion: new Date().toISOString().split('T')[0]
        };
        db.plantillas.push(nuevaPlantilla);
        writeDB(db);
        
        // Limpiar archivo temporal
        fs.unlinkSync(filePath);
        
        res.json({ success: true, plantilla: nuevaPlantilla, campos_detectados: camposEditables });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al procesar el archivo: ' + error.message });
    }
});

app.delete('/api/plantillas/:id', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const db = readDB();
    db.plantillas = db.plantillas.filter(p => p.id !== parseInt(id));
    writeDB(db);
    res.json({ success: true });
});

// ==================== RUTAS DE CASOS ====================
app.get('/api/casos/tipos', (req, res) => { const db = readDB(); res.json(db.tipos_caso.map(t => t.nombre)); });
app.post('/api/casos/nuevo', verificarToken, (req, res) => {
    try {
        const { tipo_caso, descripcion, fecha_hechos, lugar_hechos } = req.body;
        const db = readDB();
        const nuevoCaso = { id: db.casos.length + 1, id_cliente: req.usuario.id, nombre_cliente: req.usuario.nombre, cedula_cliente: req.usuario.cedula, tipo_caso, descripcion, fecha_hechos: fecha_hechos || null, lugar_hechos: lugar_hechos || null, fecha_registro: new Date().toISOString(), estado: 'pendiente', evidencias: [], notas_admin: null };
        db.casos.push(nuevoCaso);
        writeDB(db);
        res.json({ success: true, mensaje: 'Caso creado exitosamente', caso: nuevoCaso });
    } catch (error) { res.status(500).json({ error: 'Error al crear caso' }); }
});
app.get('/api/casos/mis-casos', verificarToken, (req, res) => { const db = readDB(); res.json(db.casos.filter(c => c.id_cliente === req.usuario.id)); });
app.get('/api/casos/todos', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); res.json(db.casos); });
app.put('/api/casos/:id/estado', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const { estado, notas_admin } = req.body;
    const db = readDB();
    const caso = db.casos.find(c => c.id === parseInt(id));
    if (caso) {
        if (estado) caso.estado = estado;
        if (notas_admin !== undefined) caso.notas_admin = notas_admin;
        writeDB(db);
        res.json({ success: true });
    } else { res.status(404).json({ error: 'Caso no encontrado' }); }
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

// ==================== WHATSAPP ====================
app.get('/api/whatsapp/contacto', verificarToken, (req, res) => {
    res.json({ url: `https://wa.me/573145879875?text=Hola,%20soy%20el%20cliente%20con%20cédula%20${req.usuario.cedula}.` });
});

// ==================== ADMIN DASHBOARD ====================
app.get('/api/admin/dashboard', verificarToken, verificarAdmin, (req, res) => {
    const db = readDB();
    res.json({ total_casos: db.casos.length, casos_pendientes: db.casos.filter(c => c.estado === 'pendiente').length, casos_proceso: db.casos.filter(c => c.estado === 'en_proceso').length, casos_resueltos: db.casos.filter(c => c.estado === 'resuelto').length, testimonios_activos: db.testimonios.filter(t => t.aprobado).length, tipos_caso_total: db.tipos_caso.length });
});
app.get('/api/admin/abogado', (req, res) => { const db = readDB(); res.json(db.abogado); });
app.put('/api/admin/abogado', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.abogado = { ...db.abogado, ...req.body }; writeDB(db); res.json({ success: true }); });
app.get('/api/admin/configuracion', (req, res) => { const db = readDB(); res.json(db.configuracion); });
app.put('/api/admin/configuracion', verificarToken, verificarAdmin, (req, res) => { const db = readDB(); db.configuracion = { ...db.configuracion, ...req.body }; writeDB(db); res.json({ success: true }); });

// ==================== FRONTEND ====================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'index.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'admin', 'index.html')); });
app.get('/admin/:page', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'admin', `${req.params.page}.html`)); });

app.listen(PORT, () => {
    console.log(`⚖️ Servidor LexPenal corriendo en http://localhost:${PORT}`);
    console.log(`👑 Admin: cédula 1018457093 / contraseña ACT1018457093`);
    console.log(`📂 Formatos soportados: PDF, DOCX, DOC, TXT, XLSX, XLS, JPG, PNG, GIF, BMP, TIFF`);
});
