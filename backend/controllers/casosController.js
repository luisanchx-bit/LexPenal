const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '../data/database.json');

function leerDB() {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
}

function escribirDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

let tiposCasoCache = null;

exports.obtenerTiposCaso = (req, res) => {
    try {
        const db = leerDB();
        const nombres = db.tipos_caso.map(t => t.nombre);
        res.json(nombres);
    } catch (error) {
        res.json(['Homicidio', 'Violación', 'Robo', 'Apelación', 'Citación', 'Trámite legal']);
    }
};

exports.nuevoCaso = async (req, res) => {
    try {
        const { tipo_caso, descripcion, fecha_hechos, lugar_hechos } = req.body;
        const userId = req.usuario.id;
        const nombreCliente = req.usuario.nombre;
        const cedulaCliente = req.usuario.cedula;
        
        if (!tipo_caso || !descripcion) {
            return res.status(400).json({ error: 'Tipo de caso y descripción son obligatorios' });
        }
        
        const db = leerDB();
        
        const evidencias = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach((file, index) => {
                evidencias.push({
                    id: index + 1,
                    nombre: file.originalname,
                    tamaño: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                    tipo: file.mimetype,
                    ruta: file.path
                });
            });
        }
        
        const nuevoCaso = {
            id: db.casos.length + 1,
            id_cliente: userId,
            nombre_cliente: nombreCliente,
            cedula_cliente: cedulaCliente,
            tipo_caso,
            descripcion,
            fecha_hechos: fecha_hechos || null,
            lugar_hechos: lugar_hechos || null,
            fecha_registro: new Date().toISOString(),
            estado: 'pendiente',
            evidencias: evidencias,
            evidencias_count: evidencias.length,
            notas_admin: null
        };
        
        db.casos.push(nuevoCaso);
        escribirDB(db);
        
        console.log(`📋 Nuevo caso: ${tipo_caso} - ${evidencias.length} evidencias`);
        
        res.status(201).json({
            success: true,
            mensaje: `Caso creado con ${evidencias.length} evidencias`,
            caso: nuevoCaso
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear el caso' });
    }
};

exports.misCasos = (req, res) => {
    try {
        const db = leerDB();
        const userId = req.usuario.id;
        const misCasos = db.casos.filter(c => c.id_cliente === userId).map(c => ({
            ...c,
            evidencias_count: c.evidencias ? c.evidencias.length : 0
        }));
        res.json(misCasos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener casos' });
    }
};

// ADMIN: ver todos los casos
exports.todosCasos = (req, res) => {
    try {
        const db = leerDB();
        res.json(db.casos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener casos' });
    }
};

// ADMIN: actualizar estado de caso
exports.actualizarEstadoCaso = (req, res) => {
    try {
        const { id } = req.params;
        const { estado, notas_admin } = req.body;
        const db = leerDB();
        
        const index = db.casos.findIndex(c => c.id === parseInt(id));
        if (index === -1) {
            return res.status(404).json({ error: 'Caso no encontrado' });
        }
        
        if (estado) db.casos[index].estado = estado;
        if (notas_admin !== undefined) db.casos[index].notas_admin = notas_admin;
        
        escribirDB(db);
        
        res.json({ success: true, caso: db.casos[index] });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar caso' });
    }
};