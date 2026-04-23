DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_veterinario') THEN
        REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public FROM rol_veterinario;
        REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM rol_veterinario;
        REVOKE ALL PRIVILEGES ON ALL ROUTINES  IN SCHEMA public FROM rol_veterinario;
        REVOKE USAGE ON SCHEMA public FROM rol_veterinario;
        DROP ROLE rol_veterinario;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_recepcion') THEN
        REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public FROM rol_recepcion;
        REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM rol_recepcion;
        REVOKE ALL PRIVILEGES ON ALL ROUTINES  IN SCHEMA public FROM rol_recepcion;
        REVOKE USAGE ON SCHEMA public FROM rol_recepcion;
        DROP ROLE rol_recepcion;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_admin') THEN
        REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public FROM rol_admin;
        REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM rol_admin;
        REVOKE ALL PRIVILEGES ON ALL ROUTINES  IN SCHEMA public FROM rol_admin;
        REVOKE USAGE ON SCHEMA public FROM rol_admin;
        DROP ROLE rol_admin;
    END IF;
END $$;

CREATE ROLE rol_veterinario;

GRANT USAGE ON SCHEMA public TO rol_veterinario;

GRANT SELECT ON mascotas                        TO rol_veterinario;
GRANT SELECT ON vet_atiende_mascota             TO rol_veterinario;
GRANT SELECT ON vacunas_aplicadas               TO rol_veterinario;
GRANT SELECT ON citas                           TO rol_veterinario;
GRANT SELECT ON inventario_vacunas              TO rol_veterinario;
GRANT SELECT ON duenos                          TO rol_veterinario;
GRANT SELECT ON veterinarios                    TO rol_veterinario;
GRANT SELECT ON historial_movimientos           TO rol_veterinario;
GRANT SELECT ON v_mascotas_vacunacion_pendiente TO rol_veterinario;
GRANT SELECT ON v_inventario_alertas            TO rol_veterinario;

GRANT INSERT ON vacunas_aplicadas     TO rol_veterinario;
GRANT INSERT ON historial_movimientos TO rol_veterinario;

GRANT UPDATE (estado)        ON citas              TO rol_veterinario;
GRANT UPDATE (stock_actual)  ON inventario_vacunas TO rol_veterinario;

GRANT USAGE, SELECT ON SEQUENCE vacunas_aplicadas_id_seq     TO rol_veterinario;
GRANT USAGE, SELECT ON SEQUENCE historial_movimientos_id_seq TO rol_veterinario;

CREATE ROLE rol_recepcion;

GRANT USAGE ON SCHEMA public TO rol_recepcion;

GRANT SELECT ON mascotas     TO rol_recepcion;
GRANT SELECT ON duenos       TO rol_recepcion;
GRANT SELECT ON citas        TO rol_recepcion;
GRANT SELECT ON veterinarios TO rol_recepcion;

GRANT INSERT ON citas                 TO rol_recepcion;
GRANT INSERT ON historial_movimientos TO rol_recepcion;

GRANT EXECUTE ON PROCEDURE sp_agendar_cita(INT, INT, TIMESTAMP, TEXT, NUMERIC)
    TO rol_recepcion;

GRANT USAGE, SELECT ON SEQUENCE citas_id_seq                 TO rol_recepcion;
GRANT USAGE, SELECT ON SEQUENCE historial_movimientos_id_seq TO rol_recepcion;

CREATE ROLE rol_admin;

GRANT USAGE ON SCHEMA public TO rol_admin;

GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO rol_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rol_admin;
GRANT ALL PRIVILEGES ON ALL ROUTINES  IN SCHEMA public TO rol_admin;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vet_user') THEN
        CREATE USER vet_user WITH PASSWORD 'vet_pass_2024';
    ELSE
        ALTER USER vet_user WITH PASSWORD 'vet_pass_2024';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'recep_user') THEN
        CREATE USER recep_user WITH PASSWORD 'recep_pass_2024';
    ELSE
        ALTER USER recep_user WITH PASSWORD 'recep_pass_2024';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_user') THEN
        CREATE USER admin_user WITH PASSWORD 'admin_pass_2024';
    ELSE
        ALTER USER admin_user WITH PASSWORD 'admin_pass_2024';
    END IF;
END $$;

GRANT rol_veterinario TO vet_user;
GRANT rol_recepcion   TO recep_user;
GRANT rol_admin       TO admin_user;

ALTER USER admin_user BYPASSRLS;

GRANT rol_admin TO postgres;
