const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/auth');
const verificarAdmin = require('../middleware/adminAuth');
const tiposCasoController = require('../controllers/tiposCasoController');

// Rutas públicas
router.get('/', tiposCasoController.getTiposCaso);

// Rutas protegidas (solo admin)
router.use(verificarToken);
router.use(verificarAdmin);

router.post('/', tiposCasoController.crearTipoCaso);
router.put('/:id', tiposCasoController.actualizarTipoCaso);
router.delete('/:id', tiposCasoController.eliminarTipoCaso);

module.exports = router;