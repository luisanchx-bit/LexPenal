const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/auth');

// Enlace para WhatsApp (protegido)
router.get('/contacto', verificarToken, (req, res) => {
    const numeroAbogado = process.env.WHATSAPP_NUMBER;
    const nombreCliente = req.usuario.cedula;
    const mensaje = `Hola, soy el cliente con cédula ${nombreCliente}. Necesito continuar con mi proceso legal.`;
    const urlWhatsApp = `https://wa.me/${numeroAbogado}?text=${encodeURIComponent(mensaje)}`;
    res.json({ url: urlWhatsApp });
});

module.exports = router;