const { getClient } = require('../utils/db');

async function buscarMascotas(req, res) {
    const nombre = (req.query.nombre ?? '').trim();
    const rol    = req.rol;
    const vetId  = req.vetId;

    console.log(`[MASCOTAS] buscarMascotas | nombre="${nombre}" | rol=${rol} | vetId=${vetId}`);

    let client;
    try {
        client = await getClient(rol, vetId);

        const result = await client.query(
            `SELECT
                m.id,
                m.nombre,
                m.especie,
                m.fecha_nacimiento,
                d.nombre   AS dueno,
                d.telefono AS telefono_dueno
             FROM mascotas m
             JOIN duenos d ON d.id = m.dueno_id
             WHERE m.nombre ILIKE $1
             ORDER BY m.nombre`,
            [`%${nombre}%`]
        );

        await client.query('COMMIT');

        console.log(`[MASCOTAS] ${result.rowCount} resultado(s) para búsqueda "${nombre}"`);
        res.json({
            ok:    true,
            total: result.rowCount,
            data:  result.rows
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('[MASCOTAS] Error buscarMascotas:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    } finally {
        if (client) client.release();
    }
}

async function listarMascotas(req, res) {
    const rol   = req.rol;
    const vetId = req.vetId;

    console.log(`[MASCOTAS] listarMascotas | rol=${rol} | vetId=${vetId}`);

    let client;
    try {
        client = await getClient(rol, vetId);

        const result = await client.query(
            `SELECT
                m.id,
                m.nombre,
                m.especie,
                m.fecha_nacimiento,
                d.nombre   AS dueno,
                d.telefono AS telefono_dueno
             FROM mascotas m
             JOIN duenos d ON d.id = m.dueno_id
             ORDER BY m.nombre`
        );

        await client.query('COMMIT');
        res.json({ ok: true, total: result.rowCount, data: result.rows });

    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('[MASCOTAS] Error listarMascotas:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    } finally {
        if (client) client.release();
    }
}

module.exports = { buscarMascotas, listarMascotas };
