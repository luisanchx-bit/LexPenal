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

// Obtener testimonios públicos
exports.getTestimonios = (req, res) => {
    try {
        const db = leerDB();
        const testimonios = db.testimonios.filter(t => t.aprobado === true);
        res.json(testimonios);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener testimonios' });
    }
};

// Crear testimonio (admin)
exports.crearTestimonio = (req, res) => {
    try {
        const { cliente, texto, aprobado } = req.body;
        const db = leerDB();
        
        const nuevoTestimonio = {
            id: db.testimonios.length + 1,
            cliente: cliente || 'Cliente anónimo',
            texto,
            aprobado: aprobado !== undefined ? aprobado : true,
            fecha: new Date().toISOString().split('T')[0]
        };
        
        db.testimonios.push(nuevoTestimonio);
        escribirDB(db);
        
        res.status(201).json({ success: true, testimonio: nuevoTestimonio });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear testimonio' });
    }
};

// Actualizar testimonio
exports.actualizarTestimonio = (req, res) => {
    try {
        const { id } = req.params;
        const { cliente, texto, aprobado } = req.body;
        const db = leerDB();
        
        const index = db.testimonios.findIndex(t => t.id === parseInt(id));
        if (index === -1) {
            return res.status(404).json({ error: 'Testimonio no encontrado' });
        }
        
        db.testimonios[index] = { ...db.testimonios[index], cliente, texto, aprobado };
        escribirDB(db);
        
        res.json({ success: true, testimonio: db.testimonios[index] });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar testimonio' });
    }
};

// Eliminar testimonio
exports.eliminarTestimonio = (req, res) => {
    try {
        const { id } = req.params;
        const db = leerDB();
        
        db.testimonios = db.testimonios.filter(t => t.id !== parseInt(id));
        escribirDB(db);
        
        res.json({ success: true, message: 'Testimonio eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar testimonio' });
    }
};