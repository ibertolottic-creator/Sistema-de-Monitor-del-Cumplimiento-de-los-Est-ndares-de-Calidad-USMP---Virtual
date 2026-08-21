# Estado del Proyecto: Sistema de Monitoreo USMP - Pregrado

**Fecha de Última Actualización:** 21 de Agosto de 2026  
**Versión:** 2.8.0 (Exportación PDF Matriz Consolidada, Integración Sheets y Precisión Decimal 1:1 con BI)

---

## 1. Resumen General del Sistema

Sistema de **Monitoreo del Cumplimiento de los Estándares de Calidad (Pregrado)** construido como una SPA (Single Page Application) en Google Apps Script. Permite a coordinadores y jefaturas evaluar asignaturas (Virtuales y Presenciales), registrar Acompañamiento Pedagógico, generar fichas docentes, enviar resultados y analizar métricas de desempeño mediante dashboards ejecutivos de Business Intelligence.

- **Arquitectura:** Serverless (Google Workspace). Frontend SPA con HTML5 / Vanilla JS / Tailwind CSS CDN / FontAwesome 6 / Chart.js / html2pdf.js. Backend en Google Apps Script (.gs).
- **Base de Datos:** Google Sheets como matriz relacional y Data Mart analítico.
- **Autenticación:** Implícita mediante `Session.getActiveUser().getEmail()`.
- **Roles y Permisos:** Admin, Jefe de área, Coordinador, Invitado.
- **Concurrencia:** `LockService.getScriptLock()` para operaciones críticas de guardado, trazabilidad de accesos y generación de Data Mart.
- **Especialización Pregrado:** Unificación de modalidades Virtual (`c_*_*`), Presencial (`cp_*_*`) e Híbrida en una sola Sábana General Docente de 72 columnas con calibración granular por semana.

---

## 2. Estructura de Archivos del Proyecto

### Backend (.gs) — 10 archivos

| # | Archivo | Responsabilidad |
|---|---|---|
| 1 | `Code.gs` | **Controlador principal** (1150+ líneas). `doGet()`, `include()`, `getGlobalSessionData()`, `getInitialData()`, `saveGrade()`, `trackAccess()`, `trackInteraction()`, `corregirHitsSemana1()`, `sendMonitoringEmail()`. Implementa arquitectura *First-Write-Only* para timestamps inmutables, cerrojos de concurrencia y filtrado seguro por rol. |
| 2 | `Backend_Coordinadores.gs` | **Área Estratégica BI Coordinadores**. `getMetricasCoordinadores()` y `saveCoordinatorSnapshot()`. Procesa tiempos con clustering de sesiones, auditorías ráfaga, plazos vencidos, hits, correos y WhatsApps. Incluye **reasignación automática de hits de semanas futuras no evaluadas hacia la semana activa (Semana 1)** y extracción estricta de semanas. |
| 3 | `GeneradorBI.gs` | **Motor del Data Mart BI (72 columnas)**. `generarCabecerasSabanaGeneral()` y `sincronizarSabanaBI()`. Fusiona 38 criterios LMS (Virtual + Presencial), 38 timestamps LMS, 11 criterios Acomp, 11 timestamps Acomp, y KPIs globales. |
| 4 | `Backend_BI.gs` | Endpoint `getSabanaBIData()`. Lee la Sábana General Docente, aplica `parseGrade()` defensivo contra formatos de fecha y calcula promedios vigesimales dinámicos por programa y dimensión. |
| 5 | `GeneradorDoc.gs` | Motor de clonado de Fichas Docentes (`generateDocVirtual()`, `generateDocPresencial()`, `generateDocAcomp()`). Usa plantillas Google Docs con variables `{{}}` y RegEx. |
| 6 | `GeneradorResultados.gs` | Consolidación multidimensional (33 columnas). `sincronizarResultadosGenerales()`, `getConsolidatedData()`. Cruza DNI entre hojas Virtual/Presencial/Acomp. |
| 7 | `generar matriz.gs` | Sincronización desde "Todo Matr" a "Asignación de coordinador" con regex `/PREGRADO|PAT|SEGUNDA CARRERA/` y manejo seguro de Drive Smart Chips. |
| 8 | `SincronizacionIntern.gs` | Distribuye datos de "Asignación de coordinador" a "LMS-virtual", "LMS-presencial" y "Acompañamiento del desempeño Pedagógico". |
| 9 | `ImportacionExterna.gs` | Pipeline de importación de matrícula y asignaturas desde orígenes externos. |
| 10 | `Menu.gs` | Menú interactivo en Google Sheets con opciones de sincronización y la utilidad **`🎯 Reubicar Hits de prueba a Semana 1`**. |

---

### Frontend (.html) — 17 archivos

| # | Archivo | Responsabilidad |
|---|---|---|
| 1 | `Index.html` | Punto de entrada principal. Incluye todas las vistas y controladores vía `<?!= include() ?>`. Ocultamiento preventivo de dashboards BI y Coordinadores al inicio. |
| 2 | `CSS.html` | Estilos base, Tailwind CSS CDN, Font Awesome 6.4, Chart.js, animaciones y tokens de color institucional USMP. |
| 3 | `View_Home.html` | Pantalla de inicio con acceso a: **Operativa** (Virtual, Presencial, Acompañamiento, Resultados), **Gestión** (Asignación) y **Área Estratégica** (Análisis BI Docentes y Métricas de Gestión del Equipo). |
| 4 | `View_Dashboard.html` | Dashboard operativo LMS para evaluación semanal (S1 a S4). |
| 5 | `View_Dashboard_Acomp.html` | Dashboard de Acompañamiento Pedagógico con modelo de 11 criterios. |
| 6 | `View_Dashboard_BI.html` | Dashboard ejecutivo de Resultados de Docentes. Selectores de Programa, Coordinador, Modalidad y Unidad (U1-U4). Gráficos Doughnut, Radar LMS (7 u 8 dimensiones) y Radar Acompañamiento (11 puntos). Exportación a PDF con `html2pdf.js`. |
| 7 | `View_Dashboard_Coordinadores.html` | Dashboard ejecutivo de Rendimiento del Equipo de Coordinación. 4 KPI cards superiores, gráficas de avance LMS vs Acomp, tiempos invertidos, tráfico, **Guía de Fórmulas y Criterios** y tabla resumen por semana. |
| 8 | `View_Assignment.html` | Vista de asignación de coordinadores y distribución de carga académica. |
| 9 | `View_Resultados.html` | Consolidación y envío masivo de resultados a docentes con DataTables. |
| 10 | `View_Modal.html` | Modales interactivos para envío de notificaciones y correos. |
| 11 | `JS_Client.html` | Enrutador principal (`loadModule`, `goHome`), renderizado de criterios LMS para Virtual y Presencial con `escapeHtml()`, control de plazos y parser robusto de fechas `parseDate()`. |
| 12 | `JS_BI.html` | Controlador BI Docentes. Filtro por Unidad (`isIndexInUnidad`), cálculo vigesimal dinámico (`calcularPuntajeVigesimalCurso`), radar de 11 puntos de Acompañamiento y generador de reportes PDF por programa. |
| 13 | `JS_Coordinadores.html` | Controlador BI Coordinadores. Calibración semanal Presencial vs Virtual, **clustering de sesiones con exclusión de tiempos muertos**, tablas consolidadas por semana (`W0` a `Cierre`) y exportador PDF. |
| 14 | `JS_Acompanamiento.html` | Controlador de Acompañamiento Pedagógico con motor vigesimal asimétrico. |
| 15 | `JS_Resultados.html` | Controlador de consolidación y despacho de actas/fichas docentes. |
| 16 | `JS_Templates.html` | Plantillas de correos con firma institucional adaptativa Pregrado/Posgrado. |
| 17 | `JS_Tracking.html` | Registro analítico de clicks en Aulas Virtuales AP/USMP pasando explícitamente `rowIndex` y `currentWeekId`, e interacciones (WhatsApp y Correo). |

---

## 3. Principales Mejoras y Correcciones Recientes (v2.7.0)

### A. Trazabilidad y Asignación de Hits Aula
1. **Ruteo Estricto de Semana en `trackAccess`**:
   - Se eliminó el cálculo ambiguo basado exclusivamente en días de calendario (`now - startDate`), el cual desviaba clics a semanas futuras (S2/S3) cuando las revisiones se realizaban días después del inicio oficial.
   - El cliente envía la semana activa de evaluación (`currentWeekId`), garantizando que los accesos realizados durante la etapa de inicio/Semana 1 se guarden en `hits_s1_ap` / `hits_s1_usmp`.
2. **Reasignación Automática en Backend**:
   - En `Backend_Coordinadores.gs`, si existen hits en columnas de semanas posteriores (S2, S3 o S4) pero esas semanas aún no tienen registros de evaluación (semanas no iniciadas/evaluadas), los hits se consolidan automáticamente en la **Semana 1**.
3. **Herramienta en Menú de Google Sheets**:
   - En `Menu.gs` se integró la opción `🔄 Sincronización -> 🎯 Reubicar Hits de prueba a Semana 1` (`corregirHitsSemana1()`), permitiendo con 1 clic limpiar las columnas de S2 y S3 y consolidarlas físicamente en la columna S1 de la hoja.

### B. Tiempo Absoluto LMS (Clustering y Exclusión de Tiempos Muertos)
1. **Sesiones Activas Continuas ($\Delta t \le 20\text{ min}$)**:
   - Se calcula la suma neta del tiempo transcurrido entre acciones consecutivas dentro de un intervalo $\le 20$ minutos.
2. **Exclusión Estricta de Tiempos Muertos ($> 30\text{ min}$)**:
   - Toda pausa o inactividad superior a 30 minutos (sesión abandonada o fuera de horario) se **descarta al 100%**.
   - Al retomarse la actividad, se inicia una nueva sesión de trabajo sumando únicamente el tiempo base estimado por acción (2 minutos).
3. **Pausas intermedias ($> 20\text{ min}$ y $\le 30\text{ min}$)**:
   - Se tratan como cierre de sesión activa e inicio de un nuevo bloque (+2 min base).

### C. Precisión en el Avance de Monitoreo LMS (100% vs 97%)
1. **Doble Validación (Calificaciones + Timestamps)**:
   - `Backend_Coordinadores.gs` evalúa tanto las columnas de notas (`c_...`, `cp_...`) como las columnas de auditoría (`c_..._ts`, `cp_..._ts`), consolidando el arreglo `eval_lms_w`.
   - Se resolvió la discrepancia donde cursos evaluados al 100% figuraban al 97% ($33/34$) debido a ausencia de timestamp en un único criterio o variaciones de cierre.
2. **Umbrales Semanales y de Ciclo**:
   - S1 (Bienvenida + Semana 1): Meta de 11 criterios evaluados = 100%.
   - S2: Meta de 7 criterios = 100%.
   - S3: Meta de 7 (Virtual) / 6 (Presencial) = 100%.
   - S4: Meta de 9 (Virtual) / 10 (Presencial) = 100%.
   - Ciclo Completo (General): $\ge 34$ criterios evaluados o puntaje LMS consolidado con $\ge 33$ criterios = 100%.

### D. Blindaje de Seguridad y Control de Acceso por Rol (Row-Level Security)
1. **Bloqueo Estricto de Usuarios Invitados**:
   - `getInitialData` rechaza con `UNAUTHORIZED` a cualquier usuario que no esté registrado como Coordinador, Jefe o Admin en `Datos de los coordinadores`.
2. **Filtro de Fila Exclusivo para Coordinadores**:
   - En *Acompañamiento Pedagógico*, *Virtual* y *Presencial*, un coordinador solo recibe los cursos asignados a su correo (Col S) o a su nombre (Col R). Los cursos de otros coordinadores quedan completamente invisibles.
3. **Validación de Propiedad en Escritura (`saveGrade`)**:
   - Se valida en backend que el usuario que intenta calificar sea el coordinador asignado a la fila o un Administrador/Jefe. Si un usuario intenta enviar una nota a un curso no asignado, la petición se bloquea con `Acceso denegado`.

### E. Consolidación de Resultados, Exportación PDF y Descarga Excel XLSX (v2.8.0)
1. **Exportación a PDF de toda la Matriz Consolidada (`html2pdf.js`)**:
   - Botón `Descargar PDF` con ícono y diseño institucional en la cabecera del módulo *Envío de Resultados y Fichas*.
   - Genera un documento en orientación horizontal (*landscape* A4) con membrete oficial USMP Virtual, fecha/hora de emisión, conteo total de asignaturas, resumen por dimensión (LMS, Acompañamiento, Centesimal, Vigesimal y Nivel) y badges de estado.
2. **Descarga Directa en Excel (.xlsx) (`exportarExcelMatrizConsolidada`)**:
   - Botón `Descargar Excel` con ícono verde institucional (`fa-solid fa-file-excel`) en la cabecera.
   - Genera dinámicamente un archivo nativo Microsoft Excel (`.xlsx`) mediante **SheetJS** con anchos de columna automáticos, tipificación numérica adecuada (scores con 2 decimales, porcentajes de avance enteros) y fallback transparente a formato CSV UTF-8 con BOM.
3. **Corrección de Precisión Decimal y Alineación 1:1 con Análisis BI**:
   - Reemplazo de `getDisplayValues()` por lectura numérica exacta `getValues()` en `GeneradorResultados.gs`, evitando que celdas sin formato trunquen números decimales a enteros (`17.00` o `15.00`).
   - Aplicación persistente de formato numérico `.setNumberFormat("0.00")` a las columnas `V` (22), `AA` (27), `AE` (31) y `AF` (32).
   - Alineación estricta de la fórmula vigesimal con BI: promedio aritmético exacto `(sL + sA) / 2` cuando ambas evaluaciones existen, y preservación del componente único evaluado cuando el otro aún está en progreso.

---

## 4. Reglas de Negocio Institucionales

### Calibración Semanal LMS Asimétrica

| Semana | Criterios Virtual / Híbrida | Criterios Presencial | Diferencia Clave |
|---|:---:|:---:|---|
| **Semana 1 (U1)** | 11 criterios | 11 criterios | Presencial evalúa entrega a imprimir (`cp_3_1_s1`) en lugar de tutoría (`c_3_1_s1`). |
| **Semana 2 (U2)** | 7 criterios | 7 criterios | Presencial evalúa Examen Parcial (`cp_3_2_s2`) en lugar de tutoría (`c_3_1_s2`). |
| **Semana 3 (U3)** | **7 criterios** | **6 criterios** | Presencial NO tiene exámenes ni tutorías en S3. Virtual evalúa tutoría `c_3_1_s3`. |
| **Semana 4 (U4)** | **9 criterios** | **10 criterios** | Presencial evalúa Examen Final (`cp_3_3_s4`) + Inasistencias (`cp_4_1_s4`) + Cierre e Informes (2). Virtual evalúa tutoría + Cierre e Informes. |
| **TOTAL** | **34 criterios** | **34 criterios** | Ambas modalidades completan exactamente 34 criterios en el ciclo acumulado. |

### Ventanas Oficiales de Plazos de Evaluación
- **Bienvenida / Pre-inicio (W0):** $\le 5$ días desde el inicio del periodo.
- **Semana 1:** $\le 10$ días.
- **Semana 2:** $\le 17$ días.
- **Semana 3:** $\le 24$ días.
- **Semana 4:** $\le 31$ días.
- **Semana de Cierre:** $\le 35$ días.
- **Acompañamiento Pedagógico:** $\le 31$ días desde el inicio del periodo.
