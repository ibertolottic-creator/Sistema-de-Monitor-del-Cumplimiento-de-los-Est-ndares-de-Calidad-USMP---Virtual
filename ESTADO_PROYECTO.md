Estado del Proyecto: LMS Auditoría Docente
Fecha: 25 de Febrero de 2026 
Versión: 3.1 (Correos Inteligentes y Contexto de Sede)

1. Resumen Técnico
Se ha implementado la Fase 3 y actualizaciones progresivas (3.1 a 3.4), enfocadas en la seguridad, control de acceso basado en roles, un módulo gerencial para Jefatura, y mejoras en la comunicación:

*   **Autenticación y Roles:** El sistema ahora lee la hoja `Datos de los coordinadores` (columna G para correo, F para rol, J para nombres). Los usuarios no registrados reciben el rol transitorio de "Invitado".
*   **Restricciones de Invitado:** Los invitados solo tienen acceso de lectura. La interfaz bloquea opcionalmente los botones de guardar calificación y desactiva el envío de correos, mostrando advertencias ("Acceso Limitado").
*   **Módulo de Asignación de Carga (Fase 3.1):** Se creó `View_Assignment.html`, accesible única y exclusivamente por usuarios con rol "Jefe de área" (o "Admin"). Se lee directamente desde la fila 2 para extraer las asignaturas.
*   **Dashboard Visual (NUEVO):** En la parte superior del módulo de asignación se añadió un gráfico circular interactivo (Chart.js) que muestra de inmediato la "Distribución de Carga". Junto a este, aparecen tarjetas de resumen (KPI) para cada coordinador (incluyendo a los Jefes de área) ilustrando la cantidad exacta de asignaturas y alumnos a su cargo.
*   **Filtrado Dinámico:** Al hacer clic en la tarjeta de resumen de un coordinador, la lista se filtra de inmediato para mostrar las asignaturas que tiene asignadas. También puede filtrar manualmente por programa (Columna C), nombre de curso, o nombre de docente.
*   **Auto-asignación de Jefatura:** Los perfiles de "Jefe de área" ahora aparecen listados (marcados con una ⭐ en el menú desplegable) permitiendo que coordinen sus propias asignaturas si lo requieren.
*   **Asignación Masiva por Programa (Fase 3.2):** Se integró una barra morada dedicada a la asignación en lote. Permite elegir un Programa Institucional específico y un Responsable, y mediante el botón "Asignar Todos", transfiere en un solo instante toda la carga académica de ese programa al Jefe/Coordinador seleccionado.
*   **Sincronización Integrada y Mantenimiento (LMS Core):** Se añadieron botones de "Importar Matriz" y "Sincronizar Plataformas" al gestor de asignaciones. Estos ejecutan wrappers seguros (`runImportAndSyncWebApp`, `runSyncAllWebApp`) hacia los scripts nativos `ImportacionExterna.gs` y `SincronizacionIntern.gs`. Además, se implementó un sistema de `MAINTENANCE_MODE` global que bloquea instántaneamente el sistema durante actualizaciones para prevenir corrupciones.
*   **Bloqueo Anti-Concurrencia (Backend):** La función de guardado implementa `LockService` asegurando la consistencia de datos ante colisiones.
*   **Envío de Correos Inteligente (Fase 3.4):** Se optimizó la lógica de comunicación para que al enviar un reporte o felicitación, automáticamente se concatenen en el destinatario ("Para") los correos del Docente (primario y secundario), el correo del Coordinador asignado a esa asignatura específica, y el correo institucional del Área respectiva. Esta concatenación ocurre de forma transparente en la UI, mitigando riesgos de configuración en el servidor al reutilizar la funcionalidad nativa de envíos masivos.
*   **Badge Contextual de Sede (Fase 3.4):** La interfaz Home ahora detecta en tiempo real (vía `getSpreadsheetInfo()`) el nombre de la base de datos conectada (Spreadsheet activo). Inserta dinámicamente una etiqueta visual (Badge) indicando si se está trabajando sobre la matriz de "PREGRADO" (color azul) o "POSGRADO" (color morado), brindando certeza contextual inmediata al usuario.
*   **Panel de Supervisión Global para Invitados:** Los usuarios tipo "Invitado" ahora pueden visualizar exclusivamente las métricas agregadas globales, manteniéndose bloqueado el acceso al detalle de calificación y al envío de correos.
*   **Tolerancia a Fallos en Enlaces (Fix):** Se integró un sistema de rescate (fallback) en App Script para la extracción de "Accesos Directos". Si la hoja de cálculo pierde el formato "RichText" de las aulas virtuales, el sistema leerá el texto plano y forzará la creación algorítmica de enlaces funcionales.
*   **Corrección de Layout UI:** Se ajustó la estructuración de la vista de "Asignación de carga a coordinadores" eliminando etiquetas conflictivas, asegurando que los botones de Sincronización Global permanezcan estrictamente confinados y ocultos si el usuario se encuentra navegando fuera de su jurisdicción.

2. Estructura de Archivos (Google Apps Script)
*   **Code.gs:** Lógica backend, funciones `getGlobalSessionData()`, `getAssignmentData()` y `saveAssignment()`.
*   **Index.html:** Controles del flujo inicial, loader (`initial-auth-loader`) y Toast UI.
*   **View_Home.html:** Nueva tarjeta de entrada al módulo de Asignación.
*   **View_Assignment.html (NUEVO):** Módulo frontend exclusivo para la Jefatura.
*   **JS_Client.html:** Lógica principal de renderizado, validación de estado de `isGuest`.
*   **JS_Tracking.html / JS_Templates.html:** Controles auxiliares de analíticas y correos.
*   **Documentacion_Tecnica.md:** (Mantenida).

3. Pasos para Continuar
*   **Implementación:** Realiza una nueva implementación como "Aplicación Web" (Nueva versión).
*   **Verificación:**
    *   Ingresar y observar el toast de bienvenida "Autenticando usuario...".
    *   Si eres Jefe de área, buscar el botón "Asignación de carga a coordinadores" en el Home, entrar y asignar a un coordinador.
    *   Verificar que en tu Google Sheet, hoja `Asignación de coordinador`, se modifiquen las columnas R y S.

¡El sistema Fase 3 está listo para subir a producción!