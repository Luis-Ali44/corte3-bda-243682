CREATE OR REPLACE PROCEDURE sp_agendar_cita(
    p_mascota_id     INT,
    p_veterinario_id INT,
    p_fecha_hora     TIMESTAMP,
    p_motivo         TEXT,
    p_costo          NUMERIC(10,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_vet_activo     BOOLEAN;
    v_dias_descanso  VARCHAR(50);
    v_dia_semana     TEXT;
    v_conflicto      INT;
    v_mascota_existe INT;
    v_nueva_cita_id  INT;
BEGIN
    SELECT activo, dias_descanso
      INTO v_vet_activo, v_dias_descanso
      FROM veterinarios
     WHERE id = p_veterinario_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'VETERINARIO_NO_EXISTE: El veterinario con id=% no existe.',
            p_veterinario_id;
    END IF;

    IF NOT v_vet_activo THEN
        RAISE EXCEPTION 'VETERINARIO_INACTIVO: El veterinario con id=% no está activo.',
            p_veterinario_id;
    END IF;

    SELECT id INTO v_mascota_existe
      FROM mascotas
     WHERE id = p_mascota_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MASCOTA_NO_EXISTE: La mascota con id=% no existe.',
            p_mascota_id;
    END IF;

    v_dia_semana := TRIM(LOWER(TO_CHAR(p_fecha_hora, 'Day')));

    v_dia_semana := CASE v_dia_semana
        WHEN 'monday'    THEN 'lunes'
        WHEN 'tuesday'   THEN 'martes'
        WHEN 'wednesday' THEN 'miércoles'
        WHEN 'thursday'  THEN 'jueves'
        WHEN 'friday'    THEN 'viernes'
        WHEN 'saturday'  THEN 'sábado'
        WHEN 'sunday'    THEN 'domingo'
        ELSE v_dia_semana
    END;

    IF v_dias_descanso <> '' AND position(v_dia_semana IN LOWER(v_dias_descanso)) > 0 THEN
        RAISE EXCEPTION 'VET_NO_DISPONIBLE: El veterinario descansa los "%" y la cita cae en "%".',
            v_dias_descanso, v_dia_semana;
    END IF;

    SELECT COUNT(*) INTO v_conflicto
      FROM citas
     WHERE veterinario_id = p_veterinario_id
       AND estado = 'AGENDADA'
       AND fecha_hora BETWEEN (p_fecha_hora - INTERVAL '59 minutes')
                          AND (p_fecha_hora + INTERVAL '59 minutes');

    IF v_conflicto > 0 THEN
        RAISE EXCEPTION 'CONFLICTO_HORARIO: El veterinario ya tiene una cita en ese horario (ventana ±1h).';
    END IF;

    INSERT INTO citas (mascota_id, veterinario_id, fecha_hora, motivo, costo, estado)
    VALUES (p_mascota_id, p_veterinario_id, p_fecha_hora, p_motivo, p_costo, 'AGENDADA')
    RETURNING id INTO v_nueva_cita_id;

    INSERT INTO historial_movimientos (tipo, referencia_id, descripcion)
    VALUES (
        'CITA_AGENDADA',
        v_nueva_cita_id,
        FORMAT('Cita agendada: mascota_id=%s, vet_id=%s, fecha=%s, motivo=%s',
               p_mascota_id, p_veterinario_id, p_fecha_hora, p_motivo)
    );

    RAISE NOTICE 'sp_agendar_cita: Cita id=% agendada exitosamente.', v_nueva_cita_id;
END;
$$;
