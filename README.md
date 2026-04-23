# Evaluación Corte 3 — Base de Datos Avanzadas
**Clínica Veterinaria**

A continuación, presento las respuestas a las preguntas de la evaluación respecto a la arquitectura, seguridad y rendimiento del sistema.

---

### 1. ¿Qué política RLS aplicaste a la tabla mascotas? Pega la cláusula exacta y explica con tus palabras qué hace.

**Cláusula exacta:**
```sql
CREATE POLICY policy_mascotas_veterinario ON mascotas
    FOR ALL TO rol_veterinario
    USING (
        EXISTS (
            SELECT 1 FROM vet_atiende_mascota vam
             WHERE vam.mascota_id = mascotas.id
               AND vam.vet_id     = current_setting('app.current_vet_id', true)::INT
               AND vam.activa     = TRUE
        )
        OR EXISTS (
            -- Subconsulta adicional para cubrir a compañeros inactivos o en día de descanso
            SELECT 1 FROM vet_atiende_mascota vam JOIN veterinarios v ON v.id = vam.vet_id
             WHERE vam.mascota_id = mascotas.id AND vam.activa = TRUE AND (v.activo = FALSE OR v.dias_descanso ILIKE '%' || /* dia actual */ || '%')
        )
    );
```

**Explicación:**
Esta política hace que cuando un usuario con rol de veterinario hace un `SELECT * FROM mascotas`, la base de datos no le devuelve toda la tabla. En su lugar, para cada fila, PostgreSQL verifica si en la tabla intermedia `vet_atiende_mascota` existe un registro activo que relacione esa mascota con el ID del veterinario actual (el cual sacamos de la variable de sesión `app.current_vet_id`). Adicionalmente, añadí una segunda condición para que un veterinario también pueda ver (y atender) a las mascotas de un colega si este último está inactivo o en su día de descanso.

---

### 2. Cualquiera que sea la estrategia que elegiste para identificar al veterinario actual en RLS, tiene un vector de ataque posible. ¿Cuál es? ¿Tu sistema lo previene? ¿Cómo?

El vector de ataque principal al usar variables de sesión (como `set_config('app.current_vet_id', ...)` ) ocurre debido al **Connection Pooling** (reutilización de conexiones en Node.js). Si un veterinario "A" hace una petición, la variable se establece en la conexión. Si esa variable se queda "pegada", cuando el veterinario "B" haga una petición y Node.js le asigne esa misma conexión reciclada del pool, el veterinario "B" verá accidentalmente los datos médicos del veterinario "A", provocando una fuga de información crítica.

**Sí, mi sistema lo previene.** Lo solucioné de dos formas conjuntas en el backend:
1. Usando el tercer parámetro en `set_config('app.current_vet_id', vetId, true)`. Ese `true` indica que la variable es `is_local`, es decir, exclusiva de la transacción.
2. Asegurando que el backend siempre abra una transacción explícita (`BEGIN`), ejecute el `set_config`, haga las consultas y finalmente haga `COMMIT`. Al hacer el commit, la variable se destruye automáticamente, garantizando que la conexión regrese completamente limpia al pool.

---

### 3. Si usas SECURITY DEFINER en algún procedure, ¿qué medida específica tomaste para prevenir la escalada de privilegios que ese modo habilita? Si no lo usas, justifica por qué no era necesario.

**No utilicé SECURITY DEFINER** en mi procedimiento principal `sp_agendar_cita`.

**Justificación:** Lo evité aplicando el principio de mínimo privilegio desde el diseño. En lugar de darle a un usuario con pocos permisos el poder temporal de un superusuario para agendar citas, simplemente le otorgué al `rol_recepcion` los permisos `INSERT` estrictamente necesarios en las tablas `citas` e `historial_movimientos` (en el archivo `04_roles_y_permisos.sql`). Como el rol ya tiene el nivel de acceso adecuado para hacer el trabajo, el procedure puede ejecutarse en modo estándar (SECURITY INVOKER), eliminando por completo cualquier riesgo de inyección o escalada de privilegios dentro de la base de datos.

---

### 4. ¿Qué TTL le pusiste al caché Redis y por qué ese valor específico? ¿Qué pasaría si fuera demasiado bajo? ¿Demasiado alto?

Elegí un TTL de **300 segundos (5 minutos)** para el endpoint de vacunación pendiente.

*   **Por qué este valor:** Es el punto de equilibrio ideal para la clínica. La vista de vacunación es la más pesada (tiene 5 `JOIN`s). 5 minutos es tiempo suficiente para mitigar ráfagas de consultas (ej. recepcionistas recargando la página) ahorrando mucho CPU en PostgreSQL.
*   **Si fuera demasiado bajo (ej. 10 segundos):** Redis sería inútil. La caché expiraría casi instantáneamente y la base de datos seguiría recibiendo prácticamente toda la carga pesada, perdiendo el beneficio de rendimiento.
*   **Si fuera demasiado alto (ej. 2 horas):** Habría riesgo médico por datos obsoletos. Si el veterinario "A" vacuna a una mascota, y el veterinario "B" ve su pantalla cacheada por horas, no sabría que la mascota ya fue inyectada y podría administrarle una sobredosis accidental aplicando la misma vacuna por segunda vez. (Aunque mi sistema invalida activamente la caché con los POST, un TTL de seguridad de 5 minutos protege si la invalidación falla).

---

### 5. Tu frontend manda input del usuario al backend. Elige un endpoint crítico y pega la línea exacta donde el backend maneja ese input antes de enviarlo a la base de datos. Explica qué protege esa línea y de qué. Indica archivo y número de línea.

**Archivo:** `api/controllers/mascotasController.js`
**Líneas:** 51 y 53 (Endpoint `GET /api/mascotas/buscar`)

**Líneas exactas:**
```javascript
51:              WHERE m.nombre ILIKE $1
...
53:             [`%${nombre}%`]
```

**Explicación:**
Aquí el backend recibe el input del buscador de mascotas. Esta línea nos protege contra la **Inyección SQL**. Al usar el placeholder `$1` y pasar el valor `[%${nombre}%]` como un arreglo en el segundo parámetro de `client.query()`, el driver `pg` utiliza el protocolo "Extended Query" de PostgreSQL. Esto envía la estructura de la consulta y el valor del input en mensajes de red separados. Así, aunque el usuario escriba `; DROP TABLE mascotas;`, la base de datos lo tratará estrictamente como un texto literal (buscando una mascota que se llame así) y jamás lo ejecutará como un comando destructivo.

---

### 6. Si revocas todos los permisos del rol de veterinario excepto SELECT en mascotas, ¿qué deja de funcionar en tu sistema? Lista tres operaciones que se romperían.

Si un veterinario se quedara únicamente con permisos de lectura en la tabla `mascotas`, perdería la capacidad de ejercer su trabajo en el sistema. Se romperían, entre otras, estas tres operaciones críticas:

1.  **Aplicar vacunas:** Fallaría el `INSERT` en la tabla `vacunas_aplicadas` (error de permisos denegados).
2.  **Actualizar el inventario:** Fallaría el `UPDATE` en la tabla `inventario_vacunas` necesario para descontar el stock al aplicar la vacuna.
3.  **Cambiar el estado de una cita:** Fallaría el `UPDATE` en la tabla `citas` para marcarla como "COMPLETADA" o "CANCELADA" tras atender al paciente.
