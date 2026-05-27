const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ADMIN HARDCODEADO (siempre funciona aunque la BD falle)
const ADMIN_CEDULA = "1018457093";
const ADMIN_PASSWORD = "ACT1018457093";
const ADMIN_NOMBRE = "Asmairo De Jesus Conde Torres";

// ==================== AUTENTICACIÓN ====================

// Registro de cliente
app.post('/api/auth/registro', async (req, res) => {
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
        
        // Verificar si ya existe en Supabase
        const { data: existing, error: checkError } = await supabase
            .from('usuarios')
            .select('cedula')
            .eq('cedula', cedula)
            .maybeSingle();
        
        if (existing) {
            return res.status(400).json({ error: 'Esta cédula ya está registrada' });
        }
        
        const hashedPassword = await bcrypt.hash(contrasena, 10);
        
        const { data: newUser, error: insertError } = await supabase
            .from('usuarios')
            .insert([{
                cedula,
                nombre_completo,
                contrasena_hash: hashedPassword,
                rol: 'cliente',
                fecha_registro: new Date()
            }])
            .select()
            .single();
        
        if (insertError) {
            console.error('Error al insertar:', insertError);
            return res.status(500).json({ error: 'Error al registrar usuario' });
        }
        
        const token = jwt.sign(
            { id: newUser.id, cedula, nombre: nombre_completo, rol: 'cliente' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ success: true, token, nombre: nombre_completo, cedula, isAdmin: false });
        
    } catch (error) {
        console.error('Registro error:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Login (cliente o admin)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { cedula, contrasena } = req.body;
        
        if (!cedula || !contrasena) {
            return res.status(400).json({ error: 'Cédula y contraseña son obligatorios' });
        }
        
        // Verificar si es el administrador hardcodeado
        if (cedula === ADMIN_CEDULA && contrasena === ADMIN_PASSWORD) {
            const token = jwt.sign(
                { id: 0, cedula: ADMIN_CEDULA, nombre: ADMIN_NOMBRE, rol: 'super_admin' },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );
            return res.json({ 
                success: true, 
                token, 
                nombre: ADMIN_NOMBRE, 
                cedula: ADMIN_CEDULA, 
                isAdmin: true 
            });
        }
        
        // Buscar en Supabase
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('cedula', cedula)
            .maybeSingle();
        
        if (error || !usuario) {
            return res.status(401).json({ error: 'Cédula no registrada' });
        }
        
        const passwordValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, cedula, nombre: usuario.nombre_completo, rol: usuario.rol || 'cliente' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ success: true, token, nombre: usuario.nombre_completo, cedula, isAdmin: false });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Verificar token
app.get('/api/auth/verificar', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No se proporcionó token' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.json({ valid: true, usuario: decoded });
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

// ==================== CASOS ====================

// Obtener tipos de caso
app.get('/api/casos/tipos', async (req, res) => {
    try {
        const { data } = await supabase.from('tipos_caso').select('nombre').order('orden');
        if (data && data.length > 0) {
            res.json(data.map(t => t.nombre));
        } else {
            res.json(['Homicidio', 'Violación', 'Robo', 'Apelaciones', 'Citaciones', 'Trámites Legales']);
        }
    } catch (error) {
        res.json(['Homicidio', 'Violación', 'Robo', 'Apelaciones', 'Citaciones', 'Trámites Legales']);
    }
});

// Crear nuevo caso
app.post('/api/casos/nuevo', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { tipo_caso, descripcion, fecha_hechos, lugar_hechos } = req.body;
        
        const nuevoCaso = {
            id_cliente: decoded.id,
            nombre_cliente: decoded.nombre,
            cedula_cliente: decoded.cedula,
            tipo_caso,
            descripcion,
            fecha_hechos: fecha_hechos || null,
            lugar_hechos: lugar_hechos || null,
            fecha_registro: new Date(),
            estado: 'pendiente',
            evidencias: []
        };
        
        const { data, error } = await supabase
            .from('casos')
            .insert([nuevoCaso])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, mensaje: 'Caso creado exitosamente', caso: data[0] });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear el caso' });
    }
});

// Obtener mis casos
app.get('/api/casos/mis-casos', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const { data } = await supabase
            .from('casos')
            .select('*')
            .eq('id_cliente', decoded.id)
            .order('fecha_registro', { ascending: false });
        
        res.json(data || []);
        
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener casos' });
    }
});

// Obtener todos los casos (solo admin)
app.get('/api/casos/todos', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { data } = await supabase
            .from('casos')
            .select('*')
            .order('fecha_registro', { ascending: false });
        
        res.json(data || []);
        
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener casos' });
    }
});

// Actualizar estado de caso
app.put('/api/casos/:id/estado', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { id } = req.params;
        const { estado, notas_admin } = req.body;
        
        const updateData = {};
        if (estado) updateData.estado = estado;
        if (notas_admin !== undefined) updateData.notas_admin = notas_admin;
        
        await supabase.from('casos').update(updateData).eq('id', id);
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// ==================== TESTIMONIOS ====================

app.get('/api/testimonios', async (req, res) => {
    try {
        const { data } = await supabase
            .from('testimonios')
            .select('*')
            .eq('aprobado', true)
            .order('id', { ascending: false });
        res.json(data || []);
    } catch (error) {
        res.json([]);
    }
});

app.post('/api/testimonios', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { cliente, texto, aprobado } = req.body;
        const { data } = await supabase
            .from('testimonios')
            .insert([{ cliente: cliente || 'Cliente anónimo', texto, aprobado, fecha: new Date().toISOString().split('T')[0] }])
            .select();
        
        res.json({ success: true, testimonio: data[0] });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al crear testimonio' });
    }
});

app.put('/api/testimonios/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { id } = req.params;
        const { cliente, texto, aprobado } = req.body;
        await supabase.from('testimonios').update({ cliente, texto, aprobado }).eq('id', id);
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

app.delete('/api/testimonios/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { id } = req.params;
        await supabase.from('testimonios').delete().eq('id', id);
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// ==================== PLANTILLAS ====================

app.get('/api/plantillas', async (req, res) => {
    try {
        const { data } = await supabase.from('plantillas').select('*');
        res.json(data || []);
    } catch (error) {
        res.json([]);
    }
});

app.post('/api/plantillas', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { nombre, tipo_caso, contenido } = req.body;
        const { data } = await supabase
            .from('plantillas')
            .insert([{ nombre, tipo_caso, contenido, fecha_creacion: new Date().toISOString().split('T')[0] }])
            .select();
        
        res.json({ success: true, plantilla: data[0] });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al crear plantilla' });
    }
});

app.put('/api/plantillas/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { id } = req.params;
        const { nombre, tipo_caso, contenido } = req.body;
        await supabase.from('plantillas').update({ nombre, tipo_caso, contenido }).eq('id', id);
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

app.delete('/api/plantillas/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { id } = req.params;
        await supabase.from('plantillas').delete().eq('id', id);
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// ==================== TIPOS DE CASO ====================

app.get('/api/tipos-caso', async (req, res) => {
    try {
        const { data } = await supabase.from('tipos_caso').select('*').order('orden');
        if (data && data.length > 0) {
            res.json(data);
        } else {
            res.json([
                { id: 1, nombre: 'Homicidio', icono: '⚖️', orden: 1 },
                { id: 2, nombre: 'Violación', icono: '🛡️', orden: 2 },
                { id: 3, nombre: 'Robo', icono: '🔒', orden: 3 },
                { id: 4, nombre: 'Apelaciones', icono: '📄', orden: 4 },
                { id: 5, nombre: 'Citaciones', icono: '📅', orden: 5 },
                { id: 6, nombre: 'Trámites Legales', icono: '📋', orden: 6 }
            ]);
        }
    } catch (error) {
        res.json([]);
    }
});

app.post('/api/tipos-caso', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { nombre, icono, orden } = req.body;
        const { data } = await supabase
            .from('tipos_caso')
            .insert([{ nombre, icono: icono || '⚖️', orden: orden || 0 }])
            .select();
        
        res.json({ success: true, tipo: data[0] });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al crear tipo de caso' });
    }
});

app.put('/api/tipos-caso/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { id } = req.params;
        const { nombre, icono, orden } = req.body;
        await supabase.from('tipos_caso').update({ nombre, icono, orden }).eq('id', id);
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

app.delete('/api/tipos-caso/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { id } = req.params;
        await supabase.from('tipos_caso').delete().eq('id', id);
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// ==================== WHATSAPP ====================

app.get('/api/whatsapp/contacto', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const numero = process.env.WHATSAPP_NUMBER || '573145879875';
        const mensaje = `Hola, soy el cliente con cédula ${decoded.cedula}. Necesito continuar con mi proceso legal.`;
        res.json({ url: `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al generar enlace' });
    }
});

// ==================== ADMIN DASHBOARD ====================

app.get('/api/admin/dashboard', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { data: casos } = await supabase.from('casos').select('*');
        const { data: testimonios } = await supabase.from('testimonios').select('*').eq('aprobado', true);
        const { data: tipos } = await supabase.from('tipos_caso').select('*');
        
        res.json({
            total_casos: casos?.length || 0,
            casos_pendientes: casos?.filter(c => c.estado === 'pendiente').length || 0,
            casos_proceso: casos?.filter(c => c.estado === 'en_proceso').length || 0,
            casos_resueltos: casos?.filter(c => c.estado === 'resuelto').length || 0,
            testimonios_activos: testimonios?.length || 0,
            tipos_caso_total: tipos?.length || 0,
            casos_por_mes: {},
            tipos_caso_populares: {}
        });
        
    } catch (error) {
        res.json({
            total_casos: 0,
            casos_pendientes: 0,
            casos_proceso: 0,
            casos_resueltos: 0,
            testimonios_activos: 3,
            tipos_caso_total: 6
        });
    }
});

app.get('/api/admin/abogado', async (req, res) => {
    try {
        const { data } = await supabase.from('abogado').select('*').limit(1).single();
        if (data) {
            res.json(data);
        } else {
            res.json({ nombre: 'Asmairo Conde Torres', telefono: '573145879875', email: 'asmairo.conde.torres@hotmail.com' });
        }
    } catch (error) {
        res.json({ nombre: 'Asmairo Conde Torres', telefono: '573145879875', email: 'asmairo.conde.torres@hotmail.com' });
    }
});

app.put('/api/admin/abogado', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { nombre, telefono, email } = req.body;
        
        const { data: existing } = await supabase.from('abogado').select('id').limit(1);
        
        if (existing && existing.length > 0) {
            await supabase.from('abogado').update({ nombre, telefono, email }).eq('id', existing[0].id);
        } else {
            await supabase.from('abogado').insert([{ nombre, telefono, email }]);
        }
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

app.get('/api/admin/configuracion', async (req, res) => {
    try {
        const { data } = await supabase.from('configuracion').select('*');
        
        const config = {
            colores: {
                dorado: data?.find(c => c.clave === 'color_dorado')?.valor || '#C8A951',
                azul: data?.find(c => c.clave === 'color_azul')?.valor || '#0A1628',
                fondo: data?.find(c => c.clave === 'color_fondo')?.valor || '#000000'
            },
            textos: {
                hero_titulo: data?.find(c => c.clave === 'hero_titulo')?.valor || 'Defensa Penal Estratégica',
                hero_subtitulo: data?.find(c => c.clave === 'hero_subtitulo')?.valor || 'Más de 6 años protegiendo tus derechos'
            }
        };
        res.json(config);
        
    } catch (error) {
        res.json({
            colores: { dorado: '#C8A951', azul: '#0A1628', fondo: '#000000' },
            textos: { hero_titulo: 'Defensa Penal Estratégica', hero_subtitulo: 'Más de 6 años protegiendo tus derechos' }
        });
    }
});

app.put('/api/admin/configuracion', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.rol !== 'super_admin' && decoded.cedula !== ADMIN_CEDULA) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const { colores, textos } = req.body;
        
        const upsertConfig = async (clave, valor) => {
            const { data: existing } = await supabase.from('configuracion').select('id').eq('clave', clave);
            if (existing && existing.length > 0) {
                await supabase.from('configuracion').update({ valor }).eq('clave', clave);
            } else {
                await supabase.from('configuracion').insert([{ clave, valor }]);
            }
        };
        
        if (colores) {
            if (colores.dorado) await upsertConfig('color_dorado', colores.dorado);
            if (colores.azul) await upsertConfig('color_azul', colores.azul);
            if (colores.fondo) await upsertConfig('color_fondo', colores.fondo);
        }
        
        if (textos) {
            if (textos.hero_titulo) await upsertConfig('hero_titulo', textos.hero_titulo);
            if (textos.hero_subtitulo) await upsertConfig('hero_subtitulo', textos.hero_subtitulo);
        }
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// ==================== FRONTEND ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin', 'index.html'));
});

app.get('/admin/:page', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin', `${req.params.page}.html`));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`⚖️ Servidor LexPenal corriendo en http://localhost:${PORT}`);
    console.log(`📱 WhatsApp: ${process.env.WHATSAPP_NUMBER || '573145879875'}`);
    console.log(`👑 Admin: cédula ${ADMIN_CEDULA} / contraseña ${ADMIN_PASSWORD}`);
    console.log(`🗄️ Supabase: ${supabaseUrl ? 'Conectado' : 'No configurado - modo demo'}`);
});