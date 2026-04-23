CREATE OR REPLACE VIEW v_mascotas_vacunacion_pendiente AS
SELECT
    m.id                                         AS mascota_id,
    m.nombre                                     AS mascota,
    m.especie,
    d.nombre                                     AS dueno,
    d.telefono                                   AS telefono_dueno,
    v.id                                         AS vet_id,
    v.nombre                                     AS veterinario_asignado,
    MAX(va.fecha_aplicacion)                     AS ultima_vacuna,
    COUNT(va.id)                                 AS total_vacunas_aplicadas,
    CASE
        WHEN MAX(va.fecha_aplicacion) IS NULL
            THEN 'NUNCA VACUNADA'
        WHEN MAX(va.fecha_aplicacion) < CURRENT_DATE - INTERVAL '365 days'
            THEN 'VACUNA VENCIDA'
        ELSE 'AL DÍA'
    END                                          AS estado_vacunacion,
    CASE
        WHEN MAX(va.fecha_aplicacion) IS NULL
            THEN NULL
        ELSE (CURRENT_DATE - MAX(va.fecha_aplicacion))
    END                                          AS dias_desde_ultima_vacuna
FROM mascotas m
JOIN duenos             d   ON d.id = m.dueno_id
JOIN vet_atiende_mascota vam ON vam.mascota_id = m.id
                             AND vam.activa = TRUE
JOIN veterinarios        v   ON v.id = vam.vet_id
LEFT JOIN vacunas_aplicadas va ON va.mascota_id = m.id
GROUP BY m.id, m.nombre, m.especie, d.nombre, d.telefono, v.id, v.nombre
ORDER BY
    CASE
        WHEN MAX(va.fecha_aplicacion) IS NULL                              THEN 0
        WHEN MAX(va.fecha_aplicacion) < CURRENT_DATE - INTERVAL '365 days' THEN 1
        ELSE 2
    END,
    m.nombre;

CREATE OR REPLACE VIEW v_inventario_alertas AS
SELECT
    id,
    nombre,
    stock_actual,
    stock_minimo,
    costo_unitario,
    CASE
        WHEN stock_actual = 0         THEN 'SIN STOCK'
        WHEN stock_actual < stock_minimo THEN 'STOCK BAJO'
        ELSE 'NORMAL'
    END AS estado_stock,
    (stock_actual - stock_minimo) AS diferencia_minimo
FROM inventario_vacunas
ORDER BY
    CASE
        WHEN stock_actual = 0            THEN 0
        WHEN stock_actual < stock_minimo THEN 1
        ELSE 2
    END,
    nombre;
