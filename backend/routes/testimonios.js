const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/auth');
const verificarAdmin = require('../middleware/adminAuth');
const testimoniosController = require('../controllers/testimoniosController');

// Rutas públicas
router.get('/', testimoniosController.getTestimonios);

// Rutas protegidas (solo admin)
router.use(verificarToken);
router.use(verificarAdmin);

router.post('/', testimoniosController.crearTestimonio);
router.put('/:id', testimoniosController.actualizarTestimonio);
router.delete('/:id', testimoniosController.eliminarTestimonio);

module.exports = router;