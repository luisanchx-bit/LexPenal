const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let usuarios = [];

exports.registro = async (req, res) => {
    try {
        const { cedula, nombre_completo, contrasena } = req.body;
        
        if (!cedula || !nombre_completo || !contrasena) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }
        
        if (cedula.length < 6) {
            return res.status(400).json({ error: 'La cédula debe tener al menos 6 dígitos' });
        }
        
        if (contrasena.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }
        
        const usuarioExistente = usuarios.find(u => u.cedula === cedula);
        if (usuarioExistente) {
            return res.status(400).json({ error: 'Esta cédula ya está registrada' });
        }
        
        const hashedPassword = await bcrypt.hash(contrasena, 10);
        
        const nuevoUsuario = {
            id: usuarios.length + 1,
            cedula,
            nombre_completo,
            contrasena: hashedPassword,
            rol: 'cliente',
            fecha_registro: new Date()
        };
        
        usuarios.push(nuevoUsuario);
        
        const token = jwt.sign(
            { id: nuevoUsuario.id, cedula, nombre: nombre_completo, rol: nuevoUsuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(201).json({ success: true, token, nombre: nombre_completo, cedula });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

exports.login = async (req, res) => {
    try {
        const { cedula, contrasena } = req.body;
        
        if (!cedula || !contrasena) {
            return res.status(400).json({ error: 'Cédula y contraseña son obligatorios' });
        }
        
        const usuario = usuarios.find(u => u.cedula === cedula);
        if (!usuario) {
            return res.status(401).json({ error: 'Cédula no registrada' });
        }
        
        const passwordValida = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, cedula, nombre: usuario.nombre_completo, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ success: true, token, nombre: usuario.nombre_completo, cedula: usuario.cedula });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

exports.verificarToken = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No se proporcionó token' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.json({ valid: true, usuario: decoded });
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
};