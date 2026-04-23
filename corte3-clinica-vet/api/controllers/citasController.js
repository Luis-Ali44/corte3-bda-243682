const { getClient } = require('../utils/db');

async function agendarCita(req, res) {
    const { mascota_id, veterinario_id, fecha_hora, motivo, costo } = req.body;
    const rol   = req.rol;
    const vetId = req.vetId;

    if (!mascota_id || !veterinario_id || !fecha_hora) {
        return res.status(400).json({
            ok:    false,
            error: 'Campos requeridos: mascota_id, veterinario_id, fecha_hora'
        });
    }

    let client;
    try {
        client = await getClient(rol, vetId);

        await client.query(
            'CALL sp_agendar_cita($1, $2, $3::TIMESTAMP, $4, $5)',
            [
                mascota_id,
                veterinario_id,
                fecha_hora,
                motivo  ?? '',
                costo   ?? 0
            ]
        );

        await client.query('COMMIT');
        res.json({ ok: true, mensaje: 'Cita agendada exitosamente.' });

    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('[CITAS] Error agendarCita:', err.message);

        const raw = err.message;
        const msg =
            raw.includes('VETERINARIO_NO_EXISTE')  ? 'Veterinario no encontrado en el sistema.'       :
            raw.includes('VETERINARIO_INACTIVO')   ? 'El veterinario seleccionado está inactivo.'      :
            raw.includes('MASCOTA_NO_EXISTE')      ? 'Mascota no encontrada en el sistema.'            :
            raw.includes('VET_NO_DISPONIBLE')      ? 'El veterinario no trabaja ese día de la semana.' :
            raw.includes('CONFLICTO_HORARIO')      ? 'El veterinario ya tiene una cita en ese horario (ventana ±1h).' :
            raw;

        res.status(400).json({ ok: false, error: msg });
    } finally {
        if (client) client.release();
    }
}

async function listarCitas(req, res) {
    const rol   = req.rol;
    const vetId = req.vetId;

    let client;
    try {
        client = await getClient(rol, vetId);

        const result = await client.query(
            `SELECT
                c.id,
                m.nombre   AS mascota,
                v.nombre   AS veterinario,
                c.fecha_hora,
                c.motivo,
                c.costo,
                c.estado
             FROM citas c
             JOIN mascotas    m ON m.id = c.mascota_id
             JOIN veterinarios v ON v.id = c.veterinario_id
             ORDER BY c.fecha_hora DESC`
        );

        await client.query('COMMIT');
        res.json({ ok: true, total: result.rowCount, data: result.rows });

    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('[CITAS] Error listarCitas:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    } finally {
        if (client) client.release();
    }
}

async function actualizarEstado(req, res) {
    const { id }     = req.params;
    const { estado } = req.body;
    const rol        = req.rol;
    const vetId      = req.vetId;

    const ESTADOS_VALIDOS = ['AGENDADA', 'COMPLETADA', 'CANCELADA'];
    if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({
            ok:    false,
            error: `Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}`
        });
    }

    let client;
    try {
        client = await getClient(rol, vetId);

        const result = await client.query(
            `UPDATE citas
             SET estado = $1
             WHERE id = $2
             RETURNING id, estado`,
            [estado, id]
        );

        await client.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ ok: false, error: 'Cita no encontrada o sin permiso.' });
        }

        res.json({
            ok:    true,
            mensaje: `Cita #${id} → estado actualizado a "${estado}".`,
            cita:  result.rows[0]
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('[CITAS] Error actualizarEstado:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    } finally {
        if (client) client.release();
    }
}

module.exports = { agendarCita, listarCitas, actualizarEstado };
