require('dotenv').config();
const { Pool } = require('pg');

const baseConfig = {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'clinica_vet',
    max:      10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
};

const pools = {
    veterinario: new Pool({
        ...baseConfig,
        user:     process.env.VET_DB_USER     || 'vet_user',
        password: process.env.VET_DB_PASSWORD || 'vet_pass_2024'
    }),
    recepcion: new Pool({
        ...baseConfig,
        user:     process.env.RECEP_DB_USER     || 'recep_user',
        password: process.env.RECEP_DB_PASSWORD || 'recep_pass_2024'
    }),
    admin: new Pool({
        ...baseConfig,
        user:     process.env.ADMIN_DB_USER     || 'admin_user',
        password: process.env.ADMIN_DB_PASSWORD || 'admin_pass_2024'
    })
};

Object.entries(pools).forEach(([nombre, pool]) => {
    pool.on('error', (err) => {
        console.error(`[DB] Error idle en pool "${nombre}":`, err.message);
    });
});

async function getClient(rol, vetId = null) {
    const pool   = pools[rol] ?? pools.admin;
    const client = await pool.connect();

    await client.query('BEGIN');

    if (rol === 'veterinario' && vetId !== null) {
        await client.query(
            'SELECT set_config($1, $2, true)',
            ['app.current_vet_id', String(vetId)]
        );
        console.log(`[DB] set_config(app.current_vet_id, ${vetId}, true) → RLS activo`);
    }

    return client;
}

module.exports = { pools, getClient };
