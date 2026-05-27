const ADMIN_CEDULA = "1018457093";

module.exports = (req, res, next) => {
    try {
        const user = req.usuario;
        
        if (!user) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        if (user.cedula !== ADMIN_CEDULA && user.rol !== 'super_admin') {
            return res.status(403).json({ error: 'Acceso denegado. Solo el administrador puede acceder.' });
        }
        
        next();
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error de autorización' });
    }
};