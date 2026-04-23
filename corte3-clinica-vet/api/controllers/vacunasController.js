const { getClient } = require('../utils/db');

const CACHE_KEY_BASE = 'vacunacion_pendiente';
const CACHE_TTL      = 300;

async function getVacunacionPendiente(req, res) {
    const redis = req.app.get('redis');
    const rol   = req.rol;
    const vetId = req.vetId;
    const start = Date.now();

    const cacheKey = (rol === 'veterinario' && vetId)
        ? `${CACHE_KEY_BASE}:vet:${vetId}`
        : `${CACHE_KEY_BASE}:admin`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const ms = Date.now() - start;
            console.log(`[CACHE HIT]  key="${cacheKey}" → ${ms}ms`);
            return res.json({
                ok:         true,
                fuente:     'redis_cache',
                latencia_ms: ms,
                ttl_restante_s: await redis.ttl(cacheKey),
                data:       JSON.parse(cached)
            });
        }

        console.log(`[CACHE MISS] key="${cacheKey}" → consultando PostgreSQL...`);
        let client;
        try {
            client = await getClient(rol, vetId);

            const result = await client.query(
                'SELECT * FROM v_mascotas_vacunacion_pendiente'
            );

            await client.query('COMMIT');

            const ms = Date.now() - start;

            await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result.rows));
            console.log(`[CACHE MISS] BD tomó ${ms}ms → guardado en Redis (key="${cacheKey}", TTL=${CACHE_TTL}s)`);

            return res.json({
                ok:         true,
                fuente:     'postgresql',
                latencia_ms: ms,
                ttl_restante_s: CACHE_TTL,
                data:       result.rows
            });

        } finally {
            if (client) client.release();
        }

    } catch (err) {
        console.error('[VACUNACION] Error getVacunacionPendiente:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
}

async function aplicarVacuna(req, res) {
    const { mascota_id, vacuna_id, veterinario_id, costo_cobrado } = req.body;
    const redis = req.app.get('redis');
    const rol   = req.rol;
    const vetId = req.vetId;

    if (!mascota_id || !vacuna_id || !veterinario_id) {
        return res.status(400).json({
            ok:    false,
            error: 'Campos requeridos: mascota_id, vacuna_id, veterinario_id'
        });
    }

    let client;
    try {
        client = await getClient(rol, vetId);

        const insertResult = await client.query(
            `INSERT INTO vacunas_aplicadas
                 (mascota_id, vacuna_id, veterinario_id, fecha_aplicacion, costo_cobrado)
             VALUES ($1, $2, $3, CURRENT_DATE, $4)
             RETURNING id, fecha_aplicacion`,
            [mascota_id, vacuna_id, veterinario_id, costo_cobrado ?? null]
        );

        await client.query(
            `UPDATE inventario_vacunas
             SET stock_actual = stock_actual - 1
             WHERE id = $1`,
            [vacuna_id]
        );

        await client.query('COMMIT');

        const keys = await redis.keys(`${CACHE_KEY_BASE}*`);
        if (keys.length > 0) {
            await redis.del(keys);
            console.log(`[CACHE INVALIDATED] Eliminadas ${keys.length} key(s):`, keys.join(', '));
        } else {
            console.log(`[CACHE INVALIDATED] No había keys de caché que eliminar.`);
        }

        res.json({
            ok:                true,
            mensaje:           'Vacuna aplicada exitosamente.',
            vacuna_aplicada_id: insertResult.rows[0].id,
            fecha_aplicacion:  insertResult.rows[0].fecha_aplicacion
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('[VACUNAS] Error aplicarVacuna:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    } finally {
        if (client) client.release();
    }
}

async function getInventario(req, res) {
    const rol   = req.rol;
    const vetId = req.vetId;

    let client;
    try {
        client = await getClient(rol, vetId);
        const result = await client.query(
            'SELECT * FROM v_inventario_alertas'
        );
        await client.query('COMMIT');
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('[VACUNAS] Error getInventario:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    } finally {
        if (client) client.release();
    }
}

module.exports = { getVacunacionPendiente, aplicarVacuna, getInventario };
