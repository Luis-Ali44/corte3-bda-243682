# Cuaderno de Ataques — Corte 3
**Evaluación de Base de Datos Avanzadas**

Este documento demuestra la resistencia del sistema ante ataques específicos, el correcto funcionamiento del Row-Level Security (RLS) y la implementación de caché con Redis, cumpliendo con los requisitos de la evaluación.

---

## Sección 1: Tres ataques de SQL Injection que fallan

El sistema está protegido contra inyecciones SQL gracias al uso de consultas parametrizadas a través del driver `pg` de Node.js. Al usar `client.query()` con parámetros (`$1`, `$2`), el protocolo "Extended Query" de PostgreSQL envía la estructura SQL y los datos por separado. Los datos nunca se interpretan como comandos SQL.

### Ataque 1: Quote-escape clásico

*   **Input exacto probado:** `' OR '1'='1`
*   **Pantalla atacada:** Frontend en `buscar.html` (Módulo de Búsqueda de Mascotas), en el campo de texto "Nombre de la mascota".
*   **Resultado esperado / Screenshot:** *(Inserta aquí tu screenshot mostrando que la búsqueda devuelve 0 resultados o no rompe la tabla, ya que el sistema busca literalmente a una mascota cuyo nombre sea exactamente "' OR '1'='1")*
*   **Línea exacta que lo defendió:** `api/controllers/mascotasController.js`, línea 51 a 53.
    *   **Código:** `WHERE m.nombre ILIKE $1`, pasando el parámetro protegido `['%' + nombre + '%']`.

### Ataque 2: Stacked query

*   **Input exacto probado:** `'; DROP TABLE mascotas; --`
*   **Pantalla atacada:** Frontend en `buscar.html` (Módulo de Búsqueda de Mascotas).
*   **Resultado esperado / Screenshot:** *(Inserta aquí tu screenshot o log de la terminal. El log mostrará que se buscó la cadena completa como texto y la tabla `mascotas` sigue intacta, sin lanzar el DROP TABLE).*
*   **Línea exacta que lo defendió:** `api/controllers/mascotasController.js`, línea 41 a 54 (mismo bloque de la query parametrizada). PostgreSQL rechaza por diseño ejecutar múltiples sentencias separadas por punto y coma dentro de un solo parámetro de Extended Query.

### Ataque 3: Union-based

*   **Input exacto probado:** `' UNION SELECT password FROM usuarios --`
*   **Pantalla atacada:** Frontend en `buscar.html` (Módulo de Búsqueda de Mascotas).
*   **Resultado esperado / Screenshot:** *(Inserta aquí tu screenshot mostrando que no hay filtrado de contraseñas. El sistema simplemente trata todo el bloque inyectado como un string literal).*
*   **Línea exacta que lo defendió:** `api/controllers/mascotasController.js`, línea 51 (`WHERE m.nombre ILIKE $1`). El motor de BD previene automáticamente que la palabra UNION sea parseada como un comando SQL.

---

## Sección 2: Demostración de RLS en acción

El sistema implementa Row-Level Security (RLS) para aislar los datos a nivel de base de datos según el rol del usuario conectado.

### Demostración

1.  **Veterinario 1:**
    *   *(Inserta aquí tu screenshot del Veterinario 1 consultando "todas las mascotas" desde la interfaz).*
    *   **Comportamiento observado:** Obtiene y visualiza únicamente el conjunto de mascotas que tienen historial o citas médicas asignadas a él.

2.  **Veterinario 2:**
    *   *(Inserta aquí tu screenshot del Veterinario 2 haciendo la misma consulta de "todas las mascotas" desde la interfaz).*
    *   **Comportamiento observado:** Obtiene un conjunto de mascotas completamente diferente al del Veterinario 1, correspondiente a sus propios pacientes.

**Explicación de la Política RLS:**
Este comportamiento seguro es producido por la política `rls_mascotas_veterinario` (ubicada en `backend/05_rls.sql`). Esta política le indica a PostgreSQL que si la sesión pertenece al rol `veterinario`, solo tiene permiso de hacer `SELECT` en las filas de la tabla `mascotas` donde el `id` de la mascota exista en una subconsulta de `citas_medicas` que coincida con el ID del veterinario autenticado (`current_setting('app.current_vet_id')`). La base de datos omite silenciosamente los registros ajenos antes de que lleguen al backend.

---

## Sección 3: Demostración de Caché Redis funcionando

Se implementó Redis para reducir drásticamente los tiempos de respuesta en consultas analíticas pesadas (como la vista de vacunación pendiente, que cruza información usando 5 `JOIN`s).

### Evidencia de Logs (con timestamps)

*   **Primera consulta (Cache MISS):**
    *   *(Inserta aquí el log de tu terminal mostrando el Cache MISS y la latencia típica de BD, ej. ~100-300ms).*
    *   **Ejemplo:** `[CACHE MISS] BD tomó 145ms → guardado en Redis`
*   **Segunda consulta inmediata (Cache HIT):**
    *   *(Inserta aquí el log de tu terminal mostrando el Cache HIT y la latencia típica de Redis, ej. ~5-20ms).*
    *   **Ejemplo:** `[CACHE HIT] key="vacunacion_pendiente:vet:1" → 8ms`
*   **POST de aplicación de vacuna (Invalidación del Caché):**
    *   *(Inserta aquí el log que muestra cómo el backend elimina la key de caché tras insertar una vacuna).*
    *   **Ejemplo:** `[CACHE INVALIDATED] Eliminadas 1 key(s): vacunacion_pendiente:vet:1`
*   **Tercera consulta tras la invalidación (Cache MISS de nuevo):**
    *   *(Inserta aquí el log confirmando que, al no haber caché, se volvió a consultar la BD fresca).*
    *   **Ejemplo:** `[CACHE MISS] BD tomó 132ms → guardado en Redis`

### Detalles Técnicos de la Estrategia de Caché

*   **Key utilizada:** Se implementó una convención de nombres dinámica. Para administradores se usa `vacunacion_pendiente:admin`. Sin embargo, para los veterinarios se usa `vacunacion_pendiente:vet:<id>` (por ejemplo, `vacunacion_pendiente:vet:1`). Esto es indispensable porque RLS genera un set de datos diferente para cada veterinario, por lo que no pueden compartir la misma caché.
*   **TTL elegido:** `300` segundos (5 minutos).
*   **¿Por qué este TTL?:** Es el punto de equilibrio ideal para el dominio de una clínica. Si fuera muy corto (ej. 30 segundos), Redis casi no ayudaría a mitigar la carga porque expira muy rápido. Si fuera muy largo (ej. 1 hora), habría un grave riesgo de tener "datos obsoletos"; por ejemplo, un veterinario podría ver una alerta de vacuna pendiente, no saber que un colega ya la aplicó hace 10 minutos, e inyectar a la mascota dos veces. Un TTL de 5 minutos mantiene los datos frescos mientras optimiza masivamente la consulta SQL.
