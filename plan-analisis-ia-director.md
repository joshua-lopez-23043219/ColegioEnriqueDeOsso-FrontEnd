# Plan de Implementación — Análisis IA para el Director

Funcionalidad: panel de consulta tipo IA donde el Director pregunta en lenguaje natural sobre rendimiento académico (notas, asistencia, horarios, docentes) y recibe un análisis basado en datos reales del sistema, no en simulación ni datos inventados.

**Fuera de alcance de este plan (a propósito):** aprovisionamiento de VPS, instalación de Ollama, despliegue del modelo — se resuelve más adelante cuando se decida llevar esto a producción. Todo lo de abajo se puede construir y probar en local primero.

---

## Fase 0 — Verificación previa (bloqueante)

- [ ] Confirmar si `DATABASE_URL` en producción es PostgreSQL (driver instalado: `psycopg2-binary`, sin driver MSSQL).
- [ ] Probar en vivo los endpoints que usan `EXEC {SP_name}` (sintaxis T-SQL, no válida en Postgres) en `Note`, `Non_Attendance`, `Document_Detail`, `Registration` — si estos fallan contra Postgres, hay que corregirlos **antes** de construir el pipeline de análisis, porque el pipeline lee de estas mismas tablas.

---

## Fase 1 — Pipeline de datos (sin IA todavía)

Objetivo: armar un dataset plano y confiable antes de meter ningún modelo encima.

- [ ] Confirmar el mapeo de joins ya validado:
  - `Registration` (estudiante + grupo) → `Note` (por `id_subject`) y `Non_Attendance` (por `id_subject` + `Date`)
  - `Imparte` (`id_group` + `id_subject`) → `id_teacher` + `Dia` + `Hora`
  - `Subjects` → `period_subject`, `academic_subject`
- [ ] Extraer/reutilizar el helper `to_float()` (ya existe en `NoteAPI.py::calculate_note_fields`) para parsear con seguridad los campos de texto de `Note` (`first_partial`...`final_grade`).
- [ ] Función de bucketing de `Imparte.Hora` en bloques (mañana / mediodía / tarde).
- [ ] Función que arma la tabla plana: `registration × asignatura × docente × dia × bloque_horario × periodo × nota_final × asistencia_%`.
- [ ] Validar manualmente los números resultantes contra un par de casos conocidos antes de seguir.

---

## Fase 2 — Capa de análisis (modelo estadístico, no deep learning)

- [ ] Agregar dependencias a `requirements.txt`: `pandas`, `scikit-learn` (o `statsmodels`).
- [ ] Regresión (`nota_final` ~ `asignatura` + `docente` + `dia` + `bloque_horario` + `grupo`) para aislar el efecto de cada variable controlando las demás.
- [ ] Cálculo de tendencia por (`asignatura` × `docente` × `grupo`) entre periodos I→II→III→IV.
- [ ] Umbral mínimo de muestra (`n`) antes de reportar un hallazgo — evitar conclusiones sobre celdas con pocos estudiantes.
- [ ] Lógica de "segmentos de bajo rendimiento" (`get_underperforming_segments`) con el umbral aplicado.

---

## Fase 3 — Funciones/herramientas para el agente IA

Diseñadas como funciones Python puras, de solo lectura, sin acceso directo a SQL desde el LLM (evita que la IA "invente" queries).

- [ ] `get_grade_trend(asignatura=None, docente=None, grupo=None, periodo_desde=None, periodo_hasta=None)`
- [ ] `get_underperforming_segments(umbral)`
- [ ] `get_attendance_summary(asignatura=None, grupo=None, periodo=None)`
- [ ] `get_teacher_comparison(asignatura)`
- [ ] `compare_before_after(fecha_corte, asignatura=None, docente=None)` — nota: sin historial de cambios de horario todavía, así que el Director debe indicar la fecha de corte manualmente.
- [ ] Router determinístico por palabras clave (no delegar la selección de herramienta al modelo pequeño, dada su debilidad conocida en tool-calling): mapear intención de la pregunta → qué función(es) llamar antes de pasarle los datos al LLM.

---

## Fase 4 — Endpoint de consulta / chat

- [ ] Nuevo módulo Django (ej. `Apps/Analitica`), siguiendo el patrón `SecuredModelViewSet` ya existente (bloquea rutas CRUD por defecto).
- [ ] Endpoint `POST /apiAnalitica/Analitica/chat/` — verificación de rol `DIRECTOR` explícita, mismo patrón que el resto de la API.
- [ ] Throttling propio (mismo patrón que `LoginRateThrottle`) para controlar el volumen de llamadas al LLM.
- [ ] Modelo simple `ChatMessage` (rol, mensaje, fecha, usuario) para historial — no requiere Zep ni vector DB a esta escala.
- [ ] Integración vía SDK compatible con OpenAI (`LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL_NAME` como variables de entorno) — apuntando en local a lo que se tenga disponible para pruebas (Ollama local, o temporalmente Gemini/Groq gratis) hasta que exista el servidor de producción.
- [ ] Flujo: pregunta → router (Fase 3) → llamada a función(es) → JSON estructurado → LLM redacta respuesta en español → se guarda en `ChatMessage`.

---

## Fase 5 — Frontend

- [ ] Nueva página `analisisIA.html` + `scriptAnalisisIA.js`, siguiendo el patrón existente del proyecto.
- [ ] Agregar a `pageAccess` en `global.js`: acceso exclusivo para `DIRECTOR`.
- [ ] Interfaz tipo chat (input + lista de mensajes), reutilizando `apiFetch` y `escapeHtml` ya existentes.
- [ ] (Opcional) Gráficas de apoyo con Chart.js para tendencias/comparaciones cuando la respuesta incluya series de datos.

---

## Fase 6 — Pruebas

- [ ] Validar la Fase 1-2 con datos reales/de prueba antes de conectar el LLM (revisar que los números tengan sentido).
- [ ] Test de regresión de seguridad para el nuevo endpoint (mismo espíritu que `Seguridad/Usuarios/test_bola_security.py`): confirmar que solo `DIRECTOR` accede, y que las rutas por defecto siguen bloqueadas.
- [ ] Prueba manual del flujo de chat completo con un modelo corriendo en local (Ollama en la máquina de desarrollo sirve para esto sin necesitar el VPS todavía).

---

## Pendiente para más adelante (no ahora)

- Aprovisionar el VPS del Servidor IA (Ollama + Gemma 4 E4B) cuando se decida pasar a producción.
- Historial de cambios de horario en `Imparte` (para que `compare_before_after` detecte automáticamente cuándo cambió un horario, sin que el Director tenga que indicar la fecha).
- Servidor de Automatización (n8n + Hermes Agent) — completamente independiente de este plan, uso personal.
