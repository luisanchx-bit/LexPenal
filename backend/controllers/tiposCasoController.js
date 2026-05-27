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

// Obtener tipos de caso
exports.getTiposCaso = (req, res) => {
    try {
        const db = leerDB();
        const tipos = db.tipos_caso.sort((a, b) => a.orden - b.orden);
        res.json(tipos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tipos de caso' });
    }
};

// Crear tipo de caso
exports.crearTipoCaso = (req, res) => {
    try {
        const { nombre, icono, orden } = req.body;
        const db = leerDB();
        
        const nuevoTipo = {
            id: db.tipos_caso.length + 1,
            nombre,
            icono: icono || '⚖️',
            orden: orden || db.tipos_caso.length + 1
        };
        
        db.tipos_caso.push(nuevoTipo);
        escribirDB(db);
        
        res.status(201).json({ success: true, tipo: nuevoTipo });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear tipo de caso' });
    }
};

// Actualizar tipo de caso
exports.actualizarTipoCaso = (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, icono, orden } = req.body;
        const db = leerDB();
        
        const index = db.tipos_caso.findIndex(t => t.id === parseInt(id));
        if (index === -1) {
            return res.status(404).json({ error: 'Tipo de caso no encontrado' });
        }
        
        db.tipos_caso[index] = { ...db.tipos_caso[index], nombre, icono, orden };
        escribirDB(db);
        
        res.json({ success: true, tipo: db.tipos_caso[index] });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar tipo de caso' });
    }
};

// Eliminar tipo de caso
exports.eliminarTipoCaso = (req, res) => {
    try {
        const { id } = req.params;
        const db = leerDB();
        
        db.tipos_caso = db.tipos_caso.filter(t => t.id !== parseInt(id));
        escribirDB(db);
        
        res.json({ success: true, message: 'Tipo de caso eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar tipo de caso' });
    }
};