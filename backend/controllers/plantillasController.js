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

// Obtener todas las plantillas
exports.getPlantillas = (req, res) => {
    try {
        const db = leerDB();
        res.json(db.plantillas || []);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener plantillas' });
    }
};

// Crear plantilla
exports.crearPlantilla = (req, res) => {
    try {
        const { nombre, tipo_caso, contenido } = req.body;
        const db = leerDB();
        
        const nuevaPlantilla = {
            id: (db.plantillas.length + 1),
            nombre,
            tipo_caso: tipo_caso || 'General',
            contenido,
            fecha_creacion: new Date().toISOString().split('T')[0]
        };
        
        db.plantillas.push(nuevaPlantilla);
        escribirDB(db);
        
        res.status(201).json({ success: true, plantilla: nuevaPlantilla });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear plantilla' });
    }
};

// Actualizar plantilla
exports.actualizarPlantilla = (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, tipo_caso, contenido } = req.body;
        const db = leerDB();
        
        const index = db.plantillas.findIndex(p => p.id === parseInt(id));
        if (index === -1) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }
        
        db.plantillas[index] = { ...db.plantillas[index], nombre, tipo_caso, contenido };
        escribirDB(db);
        
        res.json({ success: true, plantilla: db.plantillas[index] });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar plantilla' });
    }
};

// Eliminar plantilla
exports.eliminarPlantilla = (req, res) => {
    try {
        const { id } = req.params;
        const db = leerDB();
        
        db.plantillas = db.plantillas.filter(p => p.id !== parseInt(id));
        escribirDB(db);
        
        res.json({ success: true, message: 'Plantilla eliminada' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar plantilla' });
    }
};