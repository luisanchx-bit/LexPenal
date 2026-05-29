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
        
        // Detectar si hay audio grabado (archivo especial)
        const audioGrabado = archivos.find(a => a.nombre.includes('grabacion_audio'));
        
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
            tieneAudio: !!audioGrabado,
            fecha: new Date().toISOString(),
            estado: 'pendiente',
            tipo: 'consulta'
        };
        db.consultas.push(nuevaConsulta);
        writeDB(db);
        
        console.log(`✅ Consulta guardada: ${codigo} - ${nombre} - Audio: ${audioGrabado ? 'Sí' : 'No'}`);
        res.json({ success: true, codigo, mensaje: 'Consulta guardada exitosamente' });
    } catch (error) { 
        console.error('❌ Error en consulta:', error);
        res.status(500).json({ error: error.message }); 
    }
});