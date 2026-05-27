const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));

const authRoutes = require('./backend/routes/auth');
const casosRoutes = require('./backend/routes/casos');
const whatsappRoutes = require('./backend/routes/whatsapp');

app.use('/api/auth', authRoutes);
app.use('/api/casos', casosRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`⚖️ Servidor LexPenal corriendo en http://localhost:${PORT}`);
    console.log(`📱 WhatsApp: ${process.env.WHATSAPP_NUMBER}`);
});