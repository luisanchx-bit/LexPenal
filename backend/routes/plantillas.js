const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/auth');
const verificarAdmin = require('../middleware/adminAuth');
const plantillasController = require('../controllers/plantillasController');

// Rutas públicas
router.get('/', plantillasController.getPlantillas);

// Rutas protegidas (solo admin)
router.use(verificarToken);
router.use(verificarAdmin);

router.post('/', plantillasController.crearPlantilla);
router.put('/:id', plantillasController.actualizarPlantilla);
router.delete('/:id', plantillasController.eliminarPlantilla);

module.exports = router;