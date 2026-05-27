const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/auth');
const verificarAdmin = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

// Todas las rutas requieren autenticación y ser admin
router.use(verificarToken);
router.use(verificarAdmin);

// Dashboard - obtener estadísticas generales
router.get('/dashboard', adminController.getDashboard);

// Configuración general
router.get('/configuracion', adminController.getConfiguracion);
router.put('/configuracion', adminController.updateConfiguracion);

// Imágenes
router.post('/subir-imagen', adminController.subirImagen);
router.delete('/imagen/:tipo', adminController.eliminarImagen);

// Datos del abogado
router.get('/abogado', adminController.getAbogado);
router.put('/abogado', adminController.updateAbogado);

module.exports = router;