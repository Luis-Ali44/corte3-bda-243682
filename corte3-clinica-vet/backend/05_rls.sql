ALTER TABLE mascotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_mascotas_veterinario ON mascotas;
CREATE POLICY policy_mascotas_veterinario ON mascotas
    FOR ALL
    TO rol_veterinario
    USING (
        EXISTS (
            SELECT 1
              FROM vet_atiende_mascota vam
             WHERE vam.mascota_id = mascotas.id
               AND vam.vet_id     = current_setting('app.current_vet_id', true)::INT
               AND vam.activa     = TRUE
        )
        OR EXISTS (
            SELECT 1
              FROM vet_atiende_mascota vam
              JOIN veterinarios v ON v.id = vam.vet_id
             WHERE vam.mascota_id = mascotas.id
               AND vam.activa = TRUE
               AND (
                   v.activo = FALSE 
                   OR v.dias_descanso ILIKE '%' || (
                       CASE EXTRACT(ISODOW FROM CURRENT_DATE)
                           WHEN 1 THEN 'lunes'
                           WHEN 2 THEN 'martes'
                           WHEN 3 THEN 'miercoles'
                           WHEN 4 THEN 'jueves'
                           WHEN 5 THEN 'viernes'
                           WHEN 6 THEN 'sabado'
                           WHEN 7 THEN 'domingo'
                       END
                   ) || '%'
               )
        )
    );

DROP POLICY IF EXISTS policy_mascotas_recepcion ON mascotas;
CREATE POLICY policy_mascotas_recepcion ON mascotas
    FOR SELECT
    TO rol_recepcion
    USING (true);

DROP POLICY IF EXISTS policy_mascotas_admin ON mascotas;
CREATE POLICY policy_mascotas_admin ON mascotas
    FOR ALL
    TO rol_admin
    USING (true)
    WITH CHECK (true);

ALTER TABLE vacunas_aplicadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_vacunas_veterinario ON vacunas_aplicadas;
CREATE POLICY policy_vacunas_veterinario ON vacunas_aplicadas
    FOR ALL
    TO rol_veterinario
    USING (
        veterinario_id = current_setting('app.current_vet_id', true)::INT
    );

DROP POLICY IF EXISTS policy_vacunas_admin ON vacunas_aplicadas;
CREATE POLICY policy_vacunas_admin ON vacunas_aplicadas
    FOR ALL
    TO rol_admin
    USING (true)
    WITH CHECK (true);

ALTER TABLE citas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_citas_veterinario ON citas;
CREATE POLICY policy_citas_veterinario ON citas
    FOR ALL
    TO rol_veterinario
    USING (
        veterinario_id = current_setting('app.current_vet_id', true)::INT
    );

DROP POLICY IF EXISTS policy_citas_recepcion ON citas;
CREATE POLICY policy_citas_recepcion ON citas
    FOR ALL
    TO rol_recepcion
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS policy_citas_admin ON citas;
CREATE POLICY policy_citas_admin ON citas
    FOR ALL
    TO rol_admin
    USING (true)
    WITH CHECK (true);
