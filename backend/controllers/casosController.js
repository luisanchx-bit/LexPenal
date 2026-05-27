let casos = [];
let tiposCaso = ['Homicidio', 'Violación', 'Robo', 'Apelación', 'Citación', 'Trámite legal'];

exports.obtenerTiposCaso = (req, res) => {
    res.json(tiposCaso);
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
            id: casos.length + 1,
            id_cliente: userId,
            nombre_cliente: nombreCliente,
            cedula_cliente: cedulaCliente,
            tipo_caso,
            descripcion,
            fecha_hechos: fecha_hechos || null,
            lugar_hechos: lugar_hechos || null,
            fecha_registro: new Date(),
            estado: 'pendiente',
            evidencias: evidencias,
            evidencias_count: evidencias.length
        };
        
        casos.push(nuevoCaso);
        
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
        const userId = req.usuario.id;
        const misCasos = casos.filter(c => c.id_cliente === userId).map(c => ({
            ...c,
            evidencias_count: c.evidencias ? c.evidencias.length : 0
        }));
        res.json(misCasos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener casos' });
    }
};