const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ============ ARCHIVO DE DATOS LOCAL ============
const DATA_FILE = path.join(__dirname, 'database.json');

// Inicializar base de datos local si no existe
function initDB() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            usuarios: [
                {
                    id: 1,
                    cedula: "1018457093",
                    nombre_completo: "Asmairo De Jesus Conde Torres",
                    contrasena_hash: bcrypt.hashSync("ACT1018457093", 10),
                    rol: "super_admin",
                    fecha_registro: new Date().toISOString()
                }
            ],
            casos: [],
            testimonios: [
                { id: 1, cliente: "Cliente anónimo", texto: "Excelente profesional, me ayudó en un caso muy complicado. Totalmente recomendado.", aprobado: true, fecha: "2026-01-15" },
                { id: 2, cliente: "María R.", texto: "Muy atento y resolvió mi caso rápidamente. Un abogado excepcional.", aprobado: true, fecha: "2026-02-20" },
                { id: 3, cliente: "Carlos L.", texto: "Confianza y profesionalismo. Siempre disponible para responder mis dudas.", aprobado: true, fecha: "2026-03-10" }
            ],
            plantillas: [],
            tipos_caso: [
                { id: 1, nombre: "Homicidio", icono: "⚖️", orden: 1 },
                { id: 2, nombre: "Violación", icono: "🛡️", orden: 2 },
                { id: 3, nombre: "Robo", icono: "🔒", orden: 3 },
                { id: 4, nombre: "Apelaciones", icono: "📄", orden: 4 },
                { id: 5, nombre: "Citaciones", icono: "📅", orden: 5 },
                { id: 6, nombre: "Trámites Legales", icono: "📋", orden: 6 }
            ],
            configuracion: {
                colores: { dorado: "#C8A951", azul: "#0A1628", fondo: "#000000" },
                textos: { hero_titulo: "Defensa Penal Estratégica", hero_subtitulo: "Más de 6 años protegiendo tus derechos" }
            },
            abogado: { nombre: "Asmairo Conde Torres", telefono: "573145879875", email: "asmairo.conde.torres@hotmail.com" }
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}

function readDB() {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

function writeDB(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

initDB();

// ============ MIDDLEWARE DE AUTENTICACIÓN ============
function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lexpenal_secret');
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

function verificarAdmin(req, res, next) {
    if (req.usuario.rol !== 'super_admin' && req.usuario.cedula !== '1018457093') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    next();
}

// ============ RUTAS DE AUTENTICACIÓN ============
app.post('/api/auth/registro', async (req, res) => {
    try {
        const { cedula, nombre_completo, contrasena } = req.body;
        
        if (!cedula || !nombre_completo || !contrasena) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }
        
        const db = readDB();
        const usuarioExistente = db.usuarios.find(u => u.cedula === cedula);
        if (usuarioExistente) {
            return res.status(400).json({ error: 'Esta cédula ya está registrada' });
        }
        
        const hashedPassword = await bcrypt.hash(contrasena, 10);
        const nuevoUsuario = {
            id: db.usuarios.length + 1,
            cedula,
            nombre_completo,
            contrasena_hash: hashedPassword,
            rol: 'cliente',
            fecha_registro: new Date().toISOString()
        };
        
        db.usuarios.push(nuevoUsuario);
        writeDB(db);
        
        const token = jwt.sign(
            { id: nuevoUsuario.id, cedula, nombre: nombre_completo, rol: 'cliente' },
            process.env.JWT_SECRET || 'lexpenal_secret',
            { expiresIn: '7d' }
        );
        
        res.json({ success: true, token, nombre: nombre_completo, cedula, isAdmin: false });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { cedula, contrasena } = req.body;
        
        const db = readDB();
        const usuario = db.usuarios.find(u => u.cedula === cedula);
        
        if (!usuario) {
            return res.status(401).json({ error: 'Cédula no registrada' });
        }
        
        const passwordValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, cedula: usuario.cedula, nombre: usuario.nombre_completo, rol: usuario.rol },
            process.env.JWT_SECRET || 'lexpenal_secret',
            { expiresIn: '7d' }
        );
        
        res.json({ 
            success: true, 
            token, 
            nombre: usuario.nombre_completo, 
            cedula: usuario.cedula, 
            isAdmin: usuario.rol === 'super_admin'
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// ============ RUTAS DE CASOS ============
app.get('/api/casos/tipos', (req, res) => {
    const db = readDB();
    res.json(db.tipos_caso.map(t => t.nombre));
});

app.post('/api/casos/nuevo', verificarToken, (req, res) => {
    try {
        const { tipo_caso, descripcion, fecha_hechos, lugar_hechos } = req.body;
        const db = readDB();
        
        const nuevoCaso = {
            id: db.casos.length + 1,
            id_cliente: req.usuario.id,
            nombre_cliente: req.usuario.nombre,
            cedula_cliente: req.usuario.cedula,
            tipo_caso,
            descripcion,
            fecha_hechos: fecha_hechos || null,
            lugar_hechos: lugar_hechos || null,
            fecha_registro: new Date().toISOString(),
            estado: 'pendiente',
            evidencias: [],
            notas_admin: null
        };
        
        db.casos.push(nuevoCaso);
        writeDB(db);
        
        res.json({ success: true, mensaje: 'Caso creado exitosamente', caso: nuevoCaso });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al crear caso' });
    }
});

app.get('/api/casos/mis-casos', verificarToken, (req, res) => {
    const db = readDB();
    const misCasos = db.casos.filter(c => c.id_cliente === req.usuario.id);
    res.json(misCasos);
});

app.get('/api/casos/todos', verificarToken, verificarAdmin, (req, res) => {
    const db = readDB();
    res.json(db.casos);
});

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
    } else {
        res.status(404).json({ error: 'Caso no encontrado' });
    }
});

// ============ RUTAS DE TESTIMONIOS ============
app.get('/api/testimonios', (req, res) => {
    const db = readDB();
    const aprobados = db.testimonios.filter(t => t.aprobado === true);
    res.json(aprobados);
});

app.post('/api/testimonios', verificarToken, verificarAdmin, (req, res) => {
    const { cliente, texto, aprobado } = req.body;
    const db = readDB();
    
    const nuevoTestimonio = {
        id: db.testimonios.length + 1,
        cliente: cliente || 'Cliente anónimo',
        texto,
        aprobado: aprobado !== undefined ? aprobado : true,
        fecha: new Date().toISOString().split('T')[0]
    };
    
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
    } else {
        res.status(404).json({ error: 'Testimonio no encontrado' });
    }
});

app.delete('/api/testimonios/:id', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const db = readDB();
    
    db.testimonios = db.testimonios.filter(t => t.id !== parseInt(id));
    writeDB(db);
    res.json({ success: true });
});

// ============ RUTAS DE PLANTILLAS ============
app.get('/api/plantillas', (req, res) => {
    const db = readDB();
    res.json(db.plantillas || []);
});

app.post('/api/plantillas', verificarToken, verificarAdmin, (req, res) => {
    const { nombre, tipo_caso, contenido } = req.body;
    const db = readDB();
    
    const nuevaPlantilla = {
        id: (db.plantillas.length + 1),
        nombre,
        tipo_caso: tipo_caso || 'General',
        contenido,
        fecha_creacion: new Date().toISOString().split('T')[0]
    };
    
    db.plantillas.push(nuevaPlantilla);
    writeDB(db);
    res.json({ success: true, plantilla: nuevaPlantilla });
});

app.put('/api/plantillas/:id', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const { nombre, tipo_caso, contenido } = req.body;
    const db = readDB();
    
    const index = db.plantillas.findIndex(p => p.id === parseInt(id));
    if (index !== -1) {
        db.plantillas[index] = { ...db.plantillas[index], nombre, tipo_caso, contenido };
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Plantilla no encontrada' });
    }
});

app.delete('/api/plantillas/:id', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const db = readDB();
    
    db.plantillas = db.plantillas.filter(p => p.id !== parseInt(id));
    writeDB(db);
    res.json({ success: true });
});

// ============ RUTAS DE TIPOS DE CASO ============
app.get('/api/tipos-caso', (req, res) => {
    const db = readDB();
    res.json(db.tipos_caso);
});

app.post('/api/tipos-caso', verificarToken, verificarAdmin, (req, res) => {
    const { nombre, icono, orden } = req.body;
    const db = readDB();
    
    const nuevoTipo = {
        id: db.tipos_caso.length + 1,
        nombre,
        icono: icono || '⚖️',
        orden: orden || db.tipos_caso.length + 1
    };
    
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
    } else {
        res.status(404).json({ error: 'Tipo no encontrado' });
    }
});

app.delete('/api/tipos-caso/:id', verificarToken, verificarAdmin, (req, res) => {
    const { id } = req.params;
    const db = readDB();
    
    db.tipos_caso = db.tipos_caso.filter(t => t.id !== parseInt(id));
    writeDB(db);
    res.json({ success: true });
});

// ============ RUTAS DE WHATSAPP ============
app.get('/api/whatsapp/contacto', verificarToken, (req, res) => {
    const numero = process.env.WHATSAPP_NUMBER || '573145879875';
    const mensaje = `Hola, soy el cliente con cédula ${req.usuario.cedula}. Necesito continuar con mi proceso legal.`;
    res.json({ url: `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` });
});

// ============ RUTAS DE ADMIN ============
app.get('/api/admin/dashboard', verificarToken, verificarAdmin, (req, res) => {
    const db = readDB();
    const casos = db.casos;
    
    res.json({
        total_casos: casos.length,
        casos_pendientes: casos.filter(c => c.estado === 'pendiente').length,
        casos_proceso: casos.filter(c => c.estado === 'en_proceso').length,
        casos_resueltos: casos.filter(c => c.estado === 'resuelto').length,
        testimonios_activos: db.testimonios.filter(t => t.aprobado).length,
        tipos_caso_total: db.tipos_caso.length,
        casos_por_mes: {},
        tipos_caso_populares: {}
    });
});

app.get('/api/admin/abogado', (req, res) => {
    const db = readDB();
    res.json(db.abogado);
});

app.put('/api/admin/abogado', verificarToken, verificarAdmin, (req, res) => {
    const { nombre, telefono, email } = req.body;
    const db = readDB();
    
    db.abogado = { nombre, telefono, email };
    writeDB(db);
    res.json({ success: true });
});

app.get('/api/admin/configuracion', (req, res) => {
    const db = readDB();
    res.json(db.configuracion);
});

app.put('/api/admin/configuracion', verificarToken, verificarAdmin, (req, res) => {
    const { colores, textos } = req.body;
    const db = readDB();
    
    if (colores) db.configuracion.colores = { ...db.configuracion.colores, ...colores };
    if (textos) db.configuracion.textos = { ...db.configuracion.textos, ...textos };
    
    writeDB(db);
    res.json({ success: true });
});

// ============ RUTAS FRONTEND ============
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin', 'index.html'));
});

app.get('/admin/:page', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin', `${req.params.page}.html`));
});

// ============ INICIAR SERVIDOR ============
app.listen(PORT, () => {
    console.log(`⚖️ Servidor LexPenal corriendo en http://localhost:${PORT}`);
    console.log(`📱 WhatsApp: ${process.env.WHATSAPP_NUMBER || '573145879875'}`);
    console.log(`👑 Admin: cédula 1018457093 / contraseña ACT1018457093`);
    console.log(`💾 Datos guardados en: ${DATA_FILE}`);
});