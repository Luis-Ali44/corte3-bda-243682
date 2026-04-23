require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const Redis   = require('ioredis');

const mascotasController = require('./controllers/mascotasController');
const vacunasController  = require('./controllers/vacunasController');
const citasController    = require('./controllers/citasController');

const app  = express();
const PORT = process.env.PORT || 3000;

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryStrategy: (times) => Math.min(times * 100, 3000),
    maxRetriesPerRequest: 3
});

redis.on('connect', () =>
    console.log(`[REDIS] Conectado → ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`)
);
redis.on('error', (err) =>
    console.error('[REDIS] Error:', err.message)
);

app.set('redis', redis);

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[PETICIÓN] ${req.method} ${req.url}`);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    req.rol   = req.headers['x-rol']    || 'admin';
    req.vetId = req.headers['x-vet-id']
        ? parseInt(req.headers['x-vet-id'])
        : null;
    next();
});

app.get('/api/mascotas/buscar', mascotasController.buscarMascotas);
app.get('/api/mascotas',        mascotasController.listarMascotas);

app.get('/api/vacunacion-pendiente', vacunasController.getVacunacionPendiente);
app.post('/api/vacunas/aplicar',     vacunasController.aplicarVacuna);
app.get('/api/vacunas/inventario',   vacunasController.getInventario);

app.post('/api/citas/agendar',         citasController.agendarCita);
app.get('/api/citas',                  citasController.listarCitas);
app.patch('/api/citas/:id/estado',     citasController.actualizarEstado);

app.get('/api/info', (req, res) => {
    res.json({
        servicio:  'Clínica Veterinaria API',
        version:   '1.0.0',
        corte:     3,
        rol_activo: req.rol,
        vet_id:    req.vetId,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/cache/status', async (req, res) => {
    try {
        const keys = await redis.keys('vacunacion_pendiente*');
        const info = [];
        for (const key of keys) {
            const ttl = await redis.ttl(key);
            info.push({ key, ttl_restante_s: ttl });
        }
        res.json({ ok: true, keys_activas: info });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.delete('/api/cache', async (req, res) => {
    try {
        const keys = await redis.keys('vacunacion_pendiente*');
        if (keys.length > 0) {
            await redis.del(keys);
            console.log(`[CACHE] Limpieza manual → eliminadas ${keys.length} key(s)`);
        }
        res.json({ ok: true, mensaje: `${keys.length} key(s) eliminadas.` });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log('');
    console.log('=================================================');
    console.log('  Clínica Veterinaria API — Corte 3');
    console.log('  Base de Datos Avanzadas · UP Chiapas');
    console.log('=================================================');
    console.log(`  API:      http://localhost:${PORT}/api/info`);
    console.log(`  Frontend: http://localhost:${PORT}/index.html`);
    console.log('=================================================');
    console.log('');
});
