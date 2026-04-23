CREATE OR REPLACE FUNCTION fn_historial_cita()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO historial_movimientos (tipo, referencia_id, descripcion)
        VALUES (
            'CAMBIO_ESTADO_CITA',
            NEW.id,
            FORMAT(
                'Cita #%s (mascota_id=%s, vet_id=%s): estado cambió de "%s" → "%s" el %s',
                NEW.id,
                NEW.mascota_id,
                NEW.veterinario_id,
                OLD.estado,
                NEW.estado,
                NOW()::TEXT
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historial_cita ON citas;
CREATE TRIGGER trg_historial_cita
    AFTER UPDATE OF estado ON citas
    FOR EACH ROW
    EXECUTE FUNCTION fn_historial_cita();

CREATE OR REPLACE FUNCTION fn_alerta_stock_vacuna()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.stock_actual < NEW.stock_minimo THEN
        INSERT INTO alertas (tipo, descripcion)
        VALUES (
            'STOCK_BAJO',
            FORMAT(
                'ALERTA: Vacuna "%s" (id=%s) tiene stock=%s, por debajo del mínimo=%s. Reordenar.',
                NEW.nombre,
                NEW.id,
                NEW.stock_actual,
                NEW.stock_minimo
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alerta_stock ON inventario_vacunas;
CREATE TRIGGER trg_alerta_stock
    AFTER UPDATE OF stock_actual ON inventario_vacunas
    FOR EACH ROW
    EXECUTE FUNCTION fn_alerta_stock_vacuna();

CREATE OR REPLACE FUNCTION fn_historial_vacuna_aplicada()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO historial_movimientos (tipo, referencia_id, descripcion)
    VALUES (
        'VACUNA_APLICADA',
        NEW.id,
        FORMAT(
            'Vacuna id=%s aplicada a mascota_id=%s por vet_id=%s el %s. Costo cobrado: $%s',
            NEW.vacuna_id,
            NEW.mascota_id,
            NEW.veterinario_id,
            NEW.fecha_aplicacion,
            COALESCE(NEW.costo_cobrado::TEXT, 'N/A')
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historial_vacuna ON vacunas_aplicadas;
CREATE TRIGGER trg_historial_vacuna
    AFTER INSERT ON vacunas_aplicadas
    FOR EACH ROW
    EXECUTE FUNCTION fn_historial_vacuna_aplicada();
