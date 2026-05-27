const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const casosController = require('../controllers/casosController');
const verificarToken = require('../middleware/auth');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'storage/evidencias/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido'));
        }
    }
}).any();

router.use(verificarToken);
router.post('/nuevo', upload, casosController.nuevoCaso);
router.get('/mis-casos', casosController.misCasos);
router.get('/tipos', casosController.obtenerTiposCaso);

// Rutas para admin (ver todos los casos)
const verificarAdmin = require('../middleware/adminAuth');
router.get('/todos', verificarAdmin, casosController.todosCasos);
router.put('/:id/estado', verificarAdmin, casosController.actualizarEstadoCaso);

module.exports = router;