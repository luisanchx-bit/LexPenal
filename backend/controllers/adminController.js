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

// Obtener dashboard (estadísticas)
exports.getDashboard = (req, res) => {
    try {
        const db = leerDB();
        const casos = db.casos || [];
        
        const estadisticas = {
            total_casos: casos.length,
            casos_pendientes: casos.filter(c => c.estado === 'pendiente').length,
            casos_proceso: casos.filter(c => c.estado === 'en_proceso').length,
            casos_resueltos: casos.filter(c => c.estado === 'resuelto').length,
            casos_por_mes: {},
            tipos_caso_populares: {},
            testimonios_activos: db.testimonios.filter(t => t.aprobado).length,
            tipos_caso_total: db.tipos_caso.length
        };
        
        // Casos por mes
        casos.forEach(caso => {
            const mes = new Date(caso.fecha_registro).toLocaleString('es', { month: 'long' });
            estadisticas.casos_por_mes[mes] = (estadisticas.casos_por_mes[mes] || 0) + 1;
        });
        
        // Tipos de caso populares
        casos.forEach(caso => {
            estadisticas.tipos_caso_populares[caso.tipo_caso] = (estadisticas.tipos_caso_populares[caso.tipo_caso] || 0) + 1;
        });
        
        res.json(estadisticas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

// Obtener configuración
exports.getConfiguracion = (req, res) => {
    try {
        const db = leerDB();
        res.json({
            colores: db.configuracion.colores,
            fuentes: db.configuracion.fuentes,
            textos: db.configuracion.textos,
            imagenes: db.imagenes
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
};

// Actualizar configuración
exports.updateConfiguracion = (req, res) => {
    try {
        const db = leerDB();
        const { colores, fuentes, textos } = req.body;
        
        if (colores) db.configuracion.colores = { ...db.configuracion.colores, ...colores };
        if (fuentes) db.configuracion.fuentes = { ...db.configuracion.fuentes, ...fuentes };
        if (textos) db.configuracion.textos = { ...db.configuracion.textos, ...textos };
        
        escribirDB(db);
        res.json({ success: true, message: 'Configuración actualizada' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
};

// Subir imagen
exports.subirImagen = (req, res) => {
    try {
        const { tipo } = req.body; // 'foto_perfil', 'logo', 'hero_fondo'
        const db = leerDB();
        
        if (req.file) {
            db.imagenes[tipo] = `/storage/${tipo}/${req.file.filename}`;
            escribirDB(db);
            res.json({ success: true, url: db.imagenes[tipo] });
        } else {
            res.status(400).json({ error: 'No se subió ningún archivo' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al subir imagen' });
    }
};

// Eliminar imagen
exports.eliminarImagen = (req, res) => {
    try {
        const { tipo } = req.params;
        const db = leerDB();
        
        db.imagenes[tipo] = null;
        escribirDB(db);
        
        res.json({ success: true, message: 'Imagen eliminada' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar imagen' });
    }
};

// Obtener datos del abogado
exports.getAbogado = (req, res) => {
    try {
        const db = leerDB();
        res.json(db.abogado);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener datos' });
    }
};

// Actualizar datos del abogado
exports.updateAbogado = (req, res) => {
    try {
        const db = leerDB();
        db.abogado = { ...db.abogado, ...req.body };
        escribirDB(db);
        res.json({ success: true, message: 'Datos actualizados' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar datos' });
    }
};