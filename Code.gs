/**
 * ==========================================
 * SISTEMA DE MONITOREO - CALIDAD DOCENTE USMP
 * Controlador Principal Backend (Google Apps Script)
 * Versión: 2.6.0 (First-Write-Only Timestamps & Trazabilidad de Auditoría)
 * ==========================================
 */

// --- CONFIGURACIÓN GLOBAL Y MAPEO DE HOJAS ---
const SHEET_MAP = {
  ASIGNACION: 'Asignación de coordinador',
  VIRTUAL: 'Sistema de gestión del aprendizaje (LMS)- virtual',
  PRESENCIAL: 'Sistema de gestión del aprendizaje (LMS)- presencial',
  ACOMPANAMIENTO: 'Acompañamiento del desempeño Pedagógico',
  DATOS_COORDINADORES: 'Datos de los coordinadores',
  RESULTADOS: 'Envío de resultados y fichas',
};

// Roles permitidos
const ROLES = {
  ADMIN: 'Admin',
  JEFE: 'Jefe de área',
  COORDINADOR: 'Coordinador',
  INVITADO: 'Invitado',
};

// Cache de headers en memoria de ejecución (evita llamadas repetitivas)
const _headerCache = {};

// --- HELPER: Detect Spreadsheet Name (Pregrado/Posgrado) ---
function getSpreadsheetName() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet().getName();
  } catch (e) {
    return 'USMP Virtual';
  }
}

function getSpreadsheetInfo() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return { success: true, name: ss.getName() };
  } catch (e) {
    return { success: false, name: 'USMP Virtual' };
  }
}

// --- PUNTO DE ENTRADA WEB APP ---
function doGet(e) {
  const userEmail = Session.getActiveUser().getEmail();
  const role = getUserRole(userEmail);

  const template = HtmlService.createTemplateFromFile('Index');
  template.userEmail = userEmail;
  template.userRole = role;

  return template
    .evaluate()
    .setTitle('Sistema de Monitoreo - USMP')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- GESTIÓN DE ROLES Y SEGURIDAD ---
function getUserRole(email) {
  if (!email) return ROLES.INVITADO;

  try {
    const session = getGlobalSessionData();
    if (session && session.role) return session.role;
  } catch (e) {
    console.error('Error al verificar rol:', e);
  }

  return ROLES.INVITADO;
}

// --- OBTENER DATOS GLOBALES DE SESIÓN (Carga Inicial) ---
function getGlobalSessionData() {
  const userEmail = Session.getActiveUser().getEmail() || '';
  let role = ROLES.INVITADO;
  let name = userEmail || 'Invitado';
  let isGuest = true;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = SHEET_MAP.DATOS_COORDINADORES || 'Datos de los coordinadores';
    const sheet = ss.getSheetByName(sheetName);

    if (sheet && userEmail) {
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(h => String(h || '').trim().toLowerCase());

        // Detección dinámica de columnas
        let emailIdx = headers.findIndex(h => h.includes('correo') || h.includes('email') || h.includes('mail'));
        let roleIdx = headers.findIndex(h => h.includes('rol') || h.includes('perfil') || h.includes('cargo'));
        let nameIdx = headers.findIndex(h => h.includes('nombre') || h.includes('coordinador') || h.includes('docente') || h.includes('apellidos'));

        // Fallbacks por posición si no se detectan por cabecera
        if (emailIdx === -1) {
          if (data[0].length >= 7) emailIdx = 6; // Formato Posgrado Col G
          else if (data[0].length >= 2) emailIdx = 1; // Formato Pregrado Col B
        }
        if (roleIdx === -1) {
          if (data[0].length >= 6) roleIdx = 5; // Formato Posgrado Col F
          else if (data[0].length >= 3) roleIdx = 2; // Formato Pregrado Col C
        }
        if (nameIdx === -1) {
          if (data[0].length >= 10) nameIdx = 9; // Formato Posgrado Col J
          else nameIdx = 0; // Formato Pregrado Col A
        }

        const targetEmail = userEmail.trim().toLowerCase();
        for (let i = 1; i < data.length; i++) {
          const rowEmail = String(data[i][emailIdx] !== undefined ? data[i][emailIdx] : '').trim().toLowerCase();
          if (rowEmail && rowEmail === targetEmail) {
            const rawRole = String(data[i][roleIdx] !== undefined ? data[i][roleIdx] : '').trim();
            if (rawRole.toLowerCase() === ROLES.ADMIN.toLowerCase()) role = ROLES.ADMIN;
            else if (rawRole.toLowerCase() === ROLES.JEFE.toLowerCase()) role = ROLES.JEFE;
            else if (rawRole) role = ROLES.COORDINADOR;
            else role = ROLES.COORDINADOR;

            const rawName = String(data[i][nameIdx] !== undefined ? data[i][nameIdx] : '').trim();
            if (rawName) name = rawName;
            isGuest = false;
            break;
          }
        }
      }
    }

    const isAdmin = (role === ROLES.ADMIN || role === ROLES.JEFE);

    return {
      success: true,
      userEmail: userEmail,
      email: userEmail,
      name: name,
      role: role,
      isGuest: isGuest,
      isAdmin: isAdmin,
      spreadsheetName: getSpreadsheetName(),
      message: 'Autenticación exitosa'
    };
  } catch (e) {
    console.error('Error en getGlobalSessionData:', e);
    return {
      success: true, // Fallback en modo Invitado seguro para no bloquear la interfaz
      userEmail: userEmail,
      email: userEmail,
      name: userEmail || 'Invitado',
      role: ROLES.INVITADO,
      isGuest: true,
      isAdmin: false,
      spreadsheetName: getSpreadsheetName(),
      message: 'Acceso como invitado: ' + e.toString()
    };
  }
}

// --- LECTURA DINÁMICA DE ENCABEZADOS Y METADATA ---
function getHeaders(sheet) {
  const sheetName = sheet.getName();
  if (_headerCache[sheetName]) return _headerCache[sheetName];

  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return { values: [], titles: [], colCount: 0 };

  // Fila 1: IDs de Criterios (ej. c_1_1_pre, total_score, hits_s1_ap)
  // Fila 2: Títulos / Nombres amigables
  const range = sheet.getRange(1, 1, 2, lastCol).getValues();
  const result = {
    values: range[0], // Fila 1
    titles: range[1], // Fila 2
    colCount: lastCol,
  };

  _headerCache[sheetName] = result;
  return result;
}

// --- CARGA DE DATOS POR MÓDULO (Optimizada en Memoria) ---
function getInitialData(moduleKey) {
  // Verificar Mantenimiento
  const maintenance = PropertiesService.getScriptProperties().getProperty('MAINTENANCE_MODE');
  if (maintenance === 'true') {
    return { role: 'MAINTENANCE', courses: [], message: 'El sistema se encuentra en mantenimiento.' };
  }

  const userEmail = Session.getActiveUser().getEmail();
  const session = getGlobalSessionData();
  const role = session.role;
  const sessionName = session.name;

  if (role === ROLES.INVITADO) {
    return { 
      role: 'UNAUTHORIZED', 
      userEmail: userEmail,
      courses: [], 
      message: 'Acceso Restringido: Su cuenta (' + userEmail + ') no cuenta con permisos de Coordinador o Jefatura asignados.' 
    };
  }

  const sheetName = SHEET_MAP[moduleKey];

  if (!sheetName) return { role: 'ERROR', courses: [], message: 'Módulo no válido: ' + moduleKey };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { role: 'ERROR', courses: [], message: 'Hoja no encontrada: ' + sheetName };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 3) {
    return { role: role, courses: [], message: 'No hay registros cargados en esta vista.' };
  }

  // Lectura completa en 1 sola llamada
  const allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const idsRow = allData[0]; // Fila 1: IDs de criterios
  const titlesRow = allData[1]; // Fila 2: Nombres largos

  // Extracción de Fecha Global de Inicio (Celda T2 -> Fila 2, Columna 20 / Índice 19)
  let globalStartDate = '';
  if (allData[1] && allData[1].length >= 20) {
    const rawDate = allData[1][19];
    if (rawDate instanceof Date) {
      globalStartDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else if (rawDate) {
      globalStartDate = String(rawDate).trim();
    }
  }

  // MAPEO DINÁMICO DE COLUMNAS (Fila 1)
  // Base columns (0 a 18 son fijas por arquitectura institucional)
  // Col S (índice 18) = Coordinador Asignado
  const colIndexCoordinator = 18;

  // Clasificar columnas de criterios, timestamps y contadores dinámicamente
  const criteriaColumns = [];
  const timestampColumns = {};
  const hitColumns = {};
  const auditColumns = {};
  const emailColumns = {};
  const waColumns = {};

  for (let c = 0; c < idsRow.length; c++) {
    const id = String(idsRow[c]).trim();
    if (!id) continue;

    if (id.endsWith('_ts') || (moduleKey === 'ACOMPANAMIENTO' && id.endsWith('_T'))) {
      const baseCriteria = id.replace(/_ts$/, '').replace(/_T$/, '');
      timestampColumns[baseCriteria] = c;
    } else if (id.startsWith('hits_')) {
      hitColumns[id] = c;
    } else if (id.startsWith('audit_') || id.startsWith('alerta_') || id.startsWith('A_audit_')) {
      auditColumns[id] = c;
    } else if (id.startsWith('email_')) {
      emailColumns[id] = c;
    } else if (id.startsWith('wa_')) {
      waColumns[id] = c;
    } else if (c >= 20 && id !== 'total_score' && id !== 'Url_ficha' && id !== 'PT') {
      criteriaColumns.push({
        index: c,
        id: id,
        title: titlesRow[c] || id,
      });
    }
  }

  // Búsqueda de índices de columnas especiales
  const colIndexTotalScore = idsRow.indexOf('total_score') !== -1 ? idsRow.indexOf('total_score') : idsRow.indexOf('PT');
  const colIndexUrlFicha = idsRow.indexOf('Url_ficha');
  const colIndexAuditTime = idsRow.indexOf('audit_time');
  const colIndexAuditTimeAll = idsRow.indexOf('audit_time_alll');

  // Lectura de RichText para enlaces de Aulas Virtuales (Cols 12 y 13 -> L y M)
  let urlRichText = null;
  try {
    urlRichText = sheet.getRange(1, 12, lastRow, 2).getRichTextValues();
  } catch (e) {
    console.warn('RichText no disponible: ' + e.message);
  }

  // Procesar filas de datos (Fila 3 en adelante -> índice 2 en allData)
  const courses = [];
  const isSuperUser = role === ROLES.ADMIN || role === ROLES.JEFE;

  for (let r = 2; r < allData.length; r++) {
    const row = allData[r];

    // FILTRO DE SEGURIDAD ESTRICTO POR ROL
    // El coordinador solo ve sus cursos asignados (por email en Col S o por nombre en Col R)
    if (!isSuperUser) {
      const assignedEmail = String(row[18] || '').trim().toLowerCase(); // Col S
      const assignedName = String(row[17] || '').trim().toLowerCase();  // Col R
      const matchesEmail = assignedEmail && assignedEmail === userEmail.trim().toLowerCase();
      const matchesName = sessionName && assignedName && assignedName === sessionName.trim().toLowerCase();

      if (!matchesEmail && !matchesName) {
        continue; // Omitir cursos no asignados a este coordinador
      }
    }

    // Si la fila no tiene asignatura (Col E / índice 4), saltar
    const courseName = String(row[4] || '').trim();
    if (!courseName) continue;

    // Extracción de calificaciones del curso
    const grades = {};
    for (let i = 0; i < criteriaColumns.length; i++) {
      const crit = criteriaColumns[i];
      const val = row[crit.index];
      grades[crit.id] = val !== '' && val !== null ? val : '';
    }

    // Extracción de timestamps
    const timestamps = {};
    for (const [critId, colIdx] of Object.entries(timestampColumns)) {
      const tsVal = row[colIdx];
      if (tsVal instanceof Date) {
        timestamps[critId] = Utilities.formatDate(tsVal, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
      } else if (tsVal) {
        timestamps[critId] = String(tsVal);
      }
    }

    // Extracción de hits y analítica
    const hits = {};
    for (const [hitId, colIdx] of Object.entries(hitColumns)) {
      hits[hitId] = parseInt(row[colIdx]) || 0;
    }

    const emails = {};
    for (const [emId, colIdx] of Object.entries(emailColumns)) {
      emails[emId] = parseInt(row[colIdx]) || 0;
    }

    const was = {};
    for (const [waId, colIdx] of Object.entries(waColumns)) {
      was[waId] = parseInt(row[colIdx]) || 0;
    }

    // Extracción de Enlaces de Aulas Virtuales
    let codeAP = '', urlAP = '', codeUSMP = '', urlUSMP = '';
    try {
      if (urlRichText && urlRichText.length > r) {
        const cellL = urlRichText[r][0];
        const cellM = urlRichText[r][1];
        if (cellL) {
          codeAP = cellL.getText() || '';
          urlAP = cellL.getLinkUrl() || '';
        }
        if (cellM) {
          codeUSMP = cellM.getText() || '';
          urlUSMP = cellM.getLinkUrl() || '';
        }
      }
    } catch (e) {}

    // Fallbacks si no vino en RichText
    const rawL = String(row[11] || '').trim();
    if (!urlAP && rawL) {
      urlAP = rawL.startsWith('http') ? rawL : ('https://' + rawL);
      if (!codeAP) codeAP = rawL;
    }
    const rawM = String(row[12] || '').trim();
    if (!urlUSMP && rawM) {
      urlUSMP = rawM.startsWith('http') ? rawM : ('https://' + rawM);
      if (!codeUSMP) codeUSMP = rawM;
    }

    const teacherName = String(row[6] || '').trim();
    const teacherEmail = String(row[7] || '').trim();
    const personalEmail = String(row[8] || '').trim();
    const teacherPhone = String(row[9] || '').trim();
    const facultad = String(row[2] || '').trim();
    const numEstudiantes = String(row[14] || '0').trim();
    const coordName = String(row[17] || '').trim();
    const coordEmail = assignedCoord;
    const startDate = globalStartDate || String(row[16] || '').trim();

    // Construcción del objeto de curso
    courses.push({
      rowIndex: r + 1, // Fila real en la hoja (1-based)
      periodo: String(row[0] || ''),
      sede: String(row[1] || ''),
      facultad: facultad,
      program: facultad,
      modalidad: String(row[3] || ''),
      courseName: courseName,
      dni: String(row[5] || ''),
      teacherName: teacherName,
      professor: teacherName,
      teacherEmail: teacherEmail,
      email1: teacherEmail,
      personalEmail: personalEmail,
      email2: personalEmail,
      teacherPhone: teacherPhone,
      phoneNumber: teacherPhone,
      academicCoordinator: String(row[10] || ''),
      aulaVirtualAp: urlAP || rawL,
      aulaVirtualUsmp: urlUSMP || rawM,
      links: {
        AP: { code: codeAP, url: urlAP },
        USMP: { code: codeUSMP, url: urlUSMP },
      },
      metodologia: String(row[13] || ''),
      numEstudiantes: numEstudiantes,
      studentsCount: numEstudiantes,
      idMatricula: String(row[15] || ''),
      periodoFecha: String(row[16] || ''),
      coordinadorNombre: coordName,
      coordName: coordName,
      coordinadorEmail: coordEmail,
      coordEmail: coordEmail,
      globalStartDate: startDate,
      startDate: startDate,
      totalScore: colIndexTotalScore !== -1 ? row[colIndexTotalScore] : '',
      urlFicha: colIndexUrlFicha !== -1 ? String(row[colIndexUrlFicha] || '') : '',
      auditTime: colIndexAuditTime !== -1 ? row[colIndexAuditTime] : '',
      auditTimeAll: colIndexAuditTimeAll !== -1 ? row[colIndexAuditTimeAll] : '',
      grades: grades,
      timestamps: timestamps,
      hits: hits,
      emails: emails,
      was: was,
    });
  }

  return {
    role: role,
    userEmail: userEmail,
    courses: courses,
    totalCourses: courses.length,
    globalStartDate: globalStartDate,
  };
}

// --- GUARDADO DE CALIFICACIÓN (Concurrencia con ScriptLock) ---
function saveGrade(rowIndex, criteriaId, value, weekKey, moduleKey) {
  const maintenance = PropertiesService.getScriptProperties().getProperty('MAINTENANCE_MODE');
  if (maintenance === 'true') {
    return { success: false, maintenance: true, message: 'Sistema en mantenimiento.' };
  }

  const lock = LockService.getScriptLock();
  try {
    // Validar Permisos y Propiedad de Asignatura
    const userEmail = Session.getActiveUser().getEmail();
    const session = getGlobalSessionData();
    const role = session.role;
    const sessionName = session.name;
    const isSuperUser = role === ROLES.ADMIN || role === ROLES.JEFE;

    if (role === ROLES.INVITADO) {
      return { success: false, message: 'Acceso denegado: Usuario invitado no autorizado para calificar.' };
    }

    // Esperar hasta 10 segundos por el lock (para concurrencia)
    lock.waitLock(10000);

    const sheetName = SHEET_MAP[moduleKey];
    if (!sheetName) throw new Error('Módulo inválido');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

    // Si es coordinador regular, verificar que sea el dueño asignado a esta fila
    if (!isSuperUser) {
      const rowEmail = String(sheet.getRange(rowIndex, 19).getValue() || '').trim().toLowerCase(); // Col S
      const rowName = String(sheet.getRange(rowIndex, 18).getValue() || '').trim().toLowerCase();  // Col R
      const matchesEmail = rowEmail && rowEmail === userEmail.trim().toLowerCase();
      const matchesName = sessionName && rowName && rowName === sessionName.trim().toLowerCase();

      if (!matchesEmail && !matchesName) {
        return { success: false, message: 'Acceso denegado: Solo el coordinador asignado a esta asignatura puede registrar o modificar calificaciones.' };
      }
    }

    const headerObj = getHeaders(sheet);
    const idsRow = headerObj.values;

    // Modificación Robusta: Búsqueda flexible de ID
    const colIndexGrade = idsRow.findIndex(
      (h) => String(h).trim().toLowerCase() === String(criteriaId).trim().toLowerCase()
    );

    // TIMESTAMP LOGIC FIX:
    // Presencial headers use 'c_' prefix for timestamps even if criteria is 'cp_'
    // Example: criteria='cp_1_1_pre' -> timestamp='c_1_1_pre_ts'
    let tsId = criteriaId + '_ts';
    if (moduleKey === 'ACOMPANAMIENTO') {
      tsId = criteriaId + '_T';
    } else if (String(criteriaId).startsWith('cp_')) {
      // Try precise mapping: replace 'cp_' with 'c_'
      const altTsId = String(criteriaId).replace('cp_', 'c_') + '_ts';
      // Check if this alt ID exists in headers
      if (idsRow.some((h) => String(h).trim().toLowerCase() === altTsId.toLowerCase())) {
        tsId = altTsId;
      }
    }

    const colIndexTs = idsRow.findIndex(
      (h) => String(h).trim().toLowerCase() === String(tsId).trim().toLowerCase()
    );

    if (colIndexGrade === -1) {
      console.error(
        "ID '" +
          criteriaId +
          "' no encontrado. IDs disponibles: " +
          JSON.stringify(idsRow.slice(0, 5) + '...')
      );
      throw new Error("ID '" + criteriaId + "' no encontrado en hoja '" + sheetName + "'");
    }

    // Detectar Update
    const currentCell = sheet.getRange(rowIndex, colIndexGrade + 1);
    const currentValue = currentCell.getValue();
    const isUpdate = currentValue !== '' && currentValue !== null;

    const timestamp = new Date();
    currentCell.setValue(value);

    // Save Timestamp if column exists (FIRST-WRITE-ONLY)
    if (colIndexTs !== -1) {
      const tsCell = sheet.getRange(rowIndex, colIndexTs + 1);
      const existingTs = tsCell.getValue();
      if (existingTs === '' || existingTs === null) {
        tsCell.setValue(timestamp);
      }
    }

    // --- CONTADORES Y CHIVATO DE EDICIONES ---
    const idxNotificados = idsRow.findIndex((h) => String(h).trim() === 'criterios_notificados');
    const idxCambios = idsRow.findIndex((h) => String(h).trim() === 'cambios_realizados');
    const idxEdiciones = idsRow.findIndex((h) => String(h).trim() === 'detalle_ediciones');

    // 1. Si es primera nota, sube 'criterios_notificados'
    if (idxNotificados !== -1 && !isUpdate) {
      const cell = sheet.getRange(rowIndex, idxNotificados + 1);
      cell.setValue((parseInt(cell.getValue()) || 0) + 1);
    }
    // 2. Si es actualización, sube 'cambios_realizados' y anota el idCriterio
    if (isUpdate) {
      if (idxCambios !== -1) {
        const cell = sheet.getRange(rowIndex, idxCambios + 1);
        cell.setValue((parseInt(cell.getValue()) || 0) + 1);
      }
      if (idxEdiciones !== -1) {
        const cell = sheet.getRange(rowIndex, idxEdiciones + 1);
        const currentStr = String(cell.getValue() || '');
        if (currentStr.indexOf(criteriaId) === -1) {
           const newStr = currentStr === '' ? `[${criteriaId}]` : `${currentStr}, [${criteriaId}]`;
           cell.setValue(newStr);
        }
      }
    }

    // Auditoría de tiempos
    if (weekKey) analyzeRapidFill(sheet, rowIndex, weekKey, idsRow, isUpdate);

    return { success: true, timestamp: timestamp.toISOString() };
  } catch (e) {
    throw new Error(e.toString());
  } finally {
    lock.releaseLock();
  }
}

// --- AUDITORÍA DE TIEMPOS (Helper interno) ---
function analyzeRapidFill(sheet, rowIndex, weekKey, idsRow, isUpdate) {
  try {
    // Si viene del módulo ACOMPANAMIENTO, aplicamos lógica distinta
    if (weekKey === 'ACOMPANAMIENTO') {
      const idxTimeAll = idsRow.findIndex((h) => String(h).trim() === 'audit_time_alll');
      const idxTimeAvg = idsRow.findIndex((h) => String(h).trim() === 'audit_time');
      const idxB9 = idsRow.findIndex((h) => String(h).trim() === 'A_audit_burst9');
      const idxB4 = idsRow.findIndex((h) => String(h).trim() === 'A_audit_burst4');

      const relevantTimestamps = [];
      idsRow.forEach((id, index) => {
        if (!id) return;
        const idLower = String(id).toLowerCase();
        // Criterios de acompañamiento terminan en _T
        if (idLower.endsWith('_t') && idLower.length > 3) {
          relevantTimestamps.push(index + 1);
        }
      });

      if (relevantTimestamps.length < 2) return;

      const firstCol = Math.min(...relevantTimestamps);
      const lastCol = Math.max(...relevantTimestamps);
      const rowRange = sheet.getRange(rowIndex, firstCol, 1, lastCol - firstCol + 1).getValues()[0];

      const dates = [];
      relevantTimestamps.forEach((col) => {
        const val = rowRange[col - firstCol];
        if (val instanceof Date) dates.push(val.getTime());
      });

      if (dates.length >= 2) {
        dates.sort((a, b) => a - b);
        const totalDurationSec = (dates[dates.length - 1] - dates[0]) / 1000;

        // Escribir audit_time_alll (Total duración de todos los criterios)
        if (idxTimeAll !== -1) {
          sheet.getRange(rowIndex, idxTimeAll + 1).setValue(Math.round(totalDurationSec));
        }

        // Escribir audit_time (Promedio de duración por criterio)
        if (idxTimeAvg !== -1) {
          const avgSec = Math.round(totalDurationSec / (dates.length - 1));
          sheet.getRange(rowIndex, idxTimeAvg + 1).setValue(avgSec);
        }

        // Detección de ráfagas (burst)
        if (dates.length >= 9 && idxB9 !== -1) {
          const sub9 = (dates[8] - dates[0]) / 1000;
          if (sub9 < 30) {
            sheet.getRange(rowIndex, idxB9 + 1).setValue(1);
          }
        }
        if (dates.length >= 4 && idxB4 !== -1) {
          const sub4 = (dates[3] - dates[0]) / 1000;
          if (sub4 < 15) {
            sheet.getRange(rowIndex, idxB4 + 1).setValue(1);
          }
        }
      }
      return;
    }

    // LMS TRADICIONAL (S1, S2, S3, S4)
    const weekLower = weekKey.toLowerCase();
    const timeColName = 'audit_time_' + weekLower;
    const burst5ColName = 'audit_burst5_' + weekLower;
    const burst4ColName = 'audit_burst4_' + weekLower;

    const colIndexTime = idsRow.indexOf(timeColName);
    const colIndexBurst5 = idsRow.indexOf(burst5ColName);
    const colIndexBurst4 = idsRow.indexOf(burst4ColName);

    if (colIndexTime === -1) return;

    // Buscar timestamps de la semana actual
    const relevantTimestamps = [];
    idsRow.forEach((id, index) => {
      if (!id) return;
      const idLower = String(id).toLowerCase();
      if (idLower.endsWith('_ts') && idLower.includes('_' + weekLower)) {
        relevantTimestamps.push(index + 1);
      }
    });

    if (relevantTimestamps.length < 2) return;

    const firstCol = Math.min(...relevantTimestamps);
    const lastCol = Math.max(...relevantTimestamps);
    const rowRange = sheet.getRange(rowIndex, firstCol, 1, lastCol - firstCol + 1).getValues()[0];

    const dates = [];
    relevantTimestamps.forEach((col) => {
      const val = rowRange[col - firstCol];
      if (val instanceof Date) dates.push(val.getTime());
    });

    if (dates.length >= 2) {
      dates.sort((a, b) => a - b);
      const totalDurationSec = (dates[dates.length - 1] - dates[0]) / 1000;
      const avgSec = Math.round(totalDurationSec / (dates.length - 1));

      sheet.getRange(rowIndex, colIndexTime + 1).setValue(avgSec);

      // Detección de ráfagas
      if (dates.length >= 5 && colIndexBurst5 !== -1) {
        const sub5 = (dates[4] - dates[0]) / 1000;
        if (sub5 < 30) sheet.getRange(rowIndex, colIndexBurst5 + 1).setValue(1);
      }
      if (dates.length >= 4 && colIndexBurst4 !== -1) {
        const sub4 = (dates[3] - dates[0]) / 1000;
        if (sub4 < 30) sheet.getRange(rowIndex, colIndexBurst4 + 1).setValue(1);
      }
    }
  } catch (e) {
    console.error('Error en analyzeRapidFill:', e);
  }
}

// --- TRACKING Y ANALÍTICA (Hits y Accesos) ---
function trackAccess(arg1, arg2, arg3, arg4) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);

    let moduleKey, rowIndex, type, weekKey;
    if (typeof arg1 === 'number') {
      rowIndex = arg1;
      type = arg2;
      moduleKey = arg3;
      weekKey = arg4 || 'S1';
    } else {
      moduleKey = arg1;
      rowIndex = arg2;
      type = arg3;
      weekKey = arg4 || 'S1';
    }

    const sheetName = SHEET_MAP[moduleKey];
    if (!sheetName) return { success: false, message: 'Módulo inválido: ' + moduleKey };

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return { success: false, message: 'Hoja no encontrada: ' + sheetName };

    const headerObj = getHeaders(sheet);
    const idsRow = headerObj.values;

    let targetHeader = '';
    const userEmail = Session.getActiveUser().getEmail();
    const role = getUserRole(userEmail);
    const isAdmin = (role === ROLES.ADMIN || role === ROLES.JEFE);

    const typeSuffix = type === 'AP' ? 'ap' : 'usmp';

    if (moduleKey === 'ACOMPANAMIENTO') {
      targetHeader = isAdmin ? `A_hits_admin_${typeSuffix}` : `A-hits_s1_${typeSuffix}`;
    } else {
      if (isAdmin) {
        targetHeader = type === 'AP' ? 'hits_admin_ap' : 'hits_admin_usmp';
      } else {
        // Normalizar weekKey: 'S1' -> 's1', 'S2' -> 's2', 'W0' / 'B' / 'PRE' -> 's1'
        let wk = String(weekKey || 's1').toLowerCase().replace('w', 's');
        if (wk === 'b' || wk === 's0' || wk === 'pre' || wk === 'bien') wk = 's1';
        targetHeader = `hits_${wk}_${typeSuffix}`;
      }
    }

    let colIndex = idsRow.findIndex((h) => String(h).trim() === targetHeader);
    if (colIndex === -1) {
      // Fallback a hit s1 genérico
      const fallback = `hits_s1_${typeSuffix}`;
      colIndex = idsRow.findIndex((h) => String(h).trim() === fallback);
    }
    if (colIndex === -1) return { success: false, message: 'Columna no encontrada: ' + targetHeader };

    const cell = sheet.getRange(rowIndex, colIndex + 1);
    const currentHits = parseInt(cell.getValue()) || 0;
    cell.setValue(currentHits + 1);

    return { success: true, newHits: currentHits + 1 };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reubica hits acumulados indebidamente en S2 y S3 durante la etapa inicial/pruebas de vuelta a Semana 1.
 */
function corregirHitsSemana1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ['Sábana General Docente', 'LMS Virtual', 'LMS Presencial'];
  let totalFixed = 0;
  
  sheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return;
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());
    
    const colS1_AP = headers.indexOf('hits_s1_ap');
    const colS1_USMP = headers.indexOf('hits_s1_usmp');
    const colS2_AP = headers.indexOf('hits_s2_ap');
    const colS2_USMP = headers.indexOf('hits_s2_usmp');
    const colS3_AP = headers.indexOf('hits_s3_ap');
    const colS3_USMP = headers.indexOf('hits_s3_usmp');
    
    if (colS1_AP === -1 && colS1_USMP === -1) return;
    
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    let modified = false;
    
    for (let i = 0; i < data.length; i++) {
      let row = data[i];
      let h2_ap = colS2_AP !== -1 ? (parseInt(row[colS2_AP]) || 0) : 0;
      let h2_usmp = colS2_USMP !== -1 ? (parseInt(row[colS2_USMP]) || 0) : 0;
      let h3_ap = colS3_AP !== -1 ? (parseInt(row[colS3_AP]) || 0) : 0;
      let h3_usmp = colS3_USMP !== -1 ? (parseInt(row[colS3_USMP]) || 0) : 0;
      
      if (h2_ap > 0 || h2_usmp > 0 || h3_ap > 0 || h3_usmp > 0) {
        if (colS1_AP !== -1) {
          let currS1_ap = parseInt(row[colS1_AP]) || 0;
          row[colS1_AP] = currS1_ap + h2_ap + h3_ap;
        }
        if (colS1_USMP !== -1) {
          let currS1_usmp = parseInt(row[colS1_USMP]) || 0;
          row[colS1_USMP] = currS1_usmp + h2_usmp + h3_usmp;
        }
        if (colS2_AP !== -1) row[colS2_AP] = '';
        if (colS2_USMP !== -1) row[colS2_USMP] = '';
        if (colS3_AP !== -1) row[colS3_AP] = '';
        if (colS3_USMP !== -1) row[colS3_USMP] = '';
        modified = true;
        totalFixed++;
      }
    }
    
    if (modified) {
      sheet.getRange(2, 1, data.length, lastCol).setValues(data);
    }
  });
  
  try {
    SpreadsheetApp.getUi().alert('✅ Corrección Completada: Se reubicaron los hits de S2 y S3 a Semana 1 en ' + totalFixed + ' registros.');
  } catch(e) {
    Logger.log('Corrección Hits: ' + totalFixed + ' registros actualizados.');
  }
  return { success: true, fixed: totalFixed };
}

// --- TRACKING DE INTERACCIONES (Emails / WhatsApps) ---
function trackInteraction(arg1, arg2, arg3, arg4, arg5) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);

    let moduleKey, rowIndex, targetHeader;
    if (typeof arg1 === 'number') {
      rowIndex = arg1;
      targetHeader = arg2;
      moduleKey = arg3;
    } else {
      moduleKey = arg1;
      rowIndex = arg2;
      const weekKey = arg3 || 'S1';
      const actionType = arg4 || 'REPORTAR';
      const interactionType = arg5 || 'EMAIL';
      const prefix = interactionType === 'WA' ? 'wa_' : 'email_';
      const action = (actionType === 'FELICITAR' || actionType === 'CONGRATULATE') ? 'felicita_' : 'reporta_';
      const week = String(weekKey).toLowerCase();
      targetHeader = prefix + action + week;
    }

    const sheetName = SHEET_MAP[moduleKey];
    if (!sheetName) return { success: false, message: 'Módulo inválido: ' + moduleKey };

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return { success: false, message: 'Hoja no encontrada: ' + sheetName };

    const headerObj = getHeaders(sheet);
    const idsRow = headerObj.values;

    let colIndex = idsRow.findIndex((h) => String(h).trim() === targetHeader);
    if (colIndex === -1) {
      colIndex = idsRow.findIndex((h) => String(h).trim().toLowerCase() === String(targetHeader).trim().toLowerCase());
    }
    if (colIndex === -1) return { success: false, message: 'Columna no encontrada: ' + targetHeader };

    const cell = sheet.getRange(rowIndex, colIndex + 1);
    const currentVal = parseInt(cell.getValue()) || 0;
    cell.setValue(currentVal + 1);

    return { success: true, newVal: currentVal + 1 };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- ASIGNACIÓN DE COORDINADORES (Exclusivo Admin/Jefatura) ---
function getAssignmentData() {
  const email = Session.getActiveUser().getEmail();
  const role = getUserRole(email);

  if (role !== ROLES.ADMIN && role !== ROLES.JEFE) {
    return { role: 'UNAUTHORIZED', message: 'No tiene permisos para acceder a este módulo.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetAsig = ss.getSheetByName(SHEET_MAP.ASIGNACION);
  const sheetCoord = ss.getSheetByName(SHEET_MAP.DATOS_COORDINADORES);

  if (!sheetAsig || !sheetCoord) {
    return { role: 'ERROR', message: 'Hojas maestras no encontradas.' };
  }

  // Lista de Coordinadores Disponibles (Detección Dinámica de Columnas)
  const coordData = sheetCoord.getDataRange().getValues();
  const coordinators = [];
  if (coordData.length >= 2) {
    const cHeaders = coordData[0].map(h => String(h || '').trim().toLowerCase());
    let nameIdx = cHeaders.findIndex(h => h.includes('nombre') || h.includes('coordinador') || h.includes('docente') || h.includes('apellidos'));
    let emailIdx = cHeaders.findIndex(h => h.includes('correo') || h.includes('email') || h.includes('mail'));
    let roleIdx = cHeaders.findIndex(h => h.includes('rol') || h.includes('perfil') || h.includes('cargo'));

    // Fallbacks por posición si no se detectan por cabecera
    if (emailIdx === -1) {
      if (coordData[0].length >= 7) emailIdx = 6; // Formato Posgrado Col G
      else if (coordData[0].length >= 2) emailIdx = 1; // Formato Pregrado Col B
    }
    if (roleIdx === -1) {
      if (coordData[0].length >= 6) roleIdx = 5; // Formato Posgrado Col F
      else if (coordData[0].length >= 3) roleIdx = 2; // Formato Pregrado Col C
    }
    if (nameIdx === -1) {
      if (coordData[0].length >= 10) nameIdx = 9; // Formato Posgrado Col J
      else nameIdx = 0; // Formato Pregrado Col A
    }

    for (let i = 1; i < coordData.length; i++) {
      const name = String(coordData[i][nameIdx] !== undefined ? coordData[i][nameIdx] : '').trim();
      const cEmail = String(coordData[i][emailIdx] !== undefined ? coordData[i][emailIdx] : '').trim();
      const cRole = String(coordData[i][roleIdx] !== undefined ? coordData[i][roleIdx] : '').trim();
      if (name && cEmail && !name.match(/^\d+$/)) { // Evitar números puros como IDs
        coordinators.push({ name: name, email: cEmail, role: cRole });
      }
    }
  }

  // Cursos de la Hoja de Asignación (Detección Dinámica de Columnas)
  const asigData = sheetAsig.getDataRange().getValues();
  const courses = [];
  if (asigData.length >= 2) {
    const aHeaders = asigData[0].map(h => String(h || '').trim().toLowerCase());
    
    let colCourse = aHeaders.findIndex(h => h.includes('asignatura') || h.includes('curso'));
    if (colCourse === -1) colCourse = 4; // Col E

    let colProf = aHeaders.findIndex(h => h.includes('docente') || h.includes('profesor'));
    if (colProf === -1) colProf = 6; // Col G

    let colProg = aHeaders.findIndex(h => h.includes('programa') || h.includes('carrera') || h.includes('facultad') || h.includes('grado'));
    if (colProg === -1) colProg = 2; // Col C

    let colStudents = aHeaders.findIndex(h => h.includes('estudiante') || h.includes('alumno'));
    if (colStudents === -1) colStudents = 14; // Col O

    let colCoordName = aHeaders.findIndex(h => h.includes('asignación de coordinador') || (h.includes('coordinador') && !h.includes('correo') && !h.includes('email')));
    if (colCoordName === -1) colCoordName = 17; // Col R

    let colCoordEmail = aHeaders.findIndex(h => h.includes('correo uva') || (h.includes('coordinador') && (h.includes('correo') || h.includes('email'))));
    if (colCoordEmail === -1) colCoordEmail = 18; // Col S

    for (let r = 1; r < asigData.length; r++) {
      const row = asigData[r];
      const courseName = String(row[colCourse] || '').trim();
      if (!courseName) continue;

      const profName = String(row[colProf] || '').trim();
      const progName = String(row[colProg] || '').trim();
      const coordName = String(row[colCoordName] || '').trim();
      const coordEmail = String(row[colCoordEmail] || '').trim();
      const sCount = String(row[colStudents] || '0').trim();

      courses.push({
        rowIndex: r + 1,
        periodo: String(row[0] || ''),
        sede: String(row[1] || ''),
        facultad: progName,
        program: progName,
        modalidad: String(row[3] || ''),
        courseName: courseName,
        dni: String(row[5] || ''),
        teacherName: profName,
        professor: profName,
        studentsCount: sCount,
        currentCoordName: coordName,
        currentCoordEmail: coordEmail,
        assignedCoordName: coordName,
        assignedCoordEmail: coordEmail
      });
    }
  }

  return {
    role: role,
    coordinators: coordinators,
    courses: courses,
    totalCourses: courses.length,
  };
}

// --- ASIGNACIÓN INDIVIDUAL / MASIVA (ScriptLock) ---
function saveAssignment(rowIndex, coordName, coordEmail) {
  const maintenance = PropertiesService.getScriptProperties().getProperty('MAINTENANCE_MODE');
  if (maintenance === 'true') {
    return { success: false, maintenance: true, message: 'Sistema en mantenimiento.' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_MAP['ASIGNACION']);
    if (!sheet) throw new Error('Hoja de asignación no encontrada.');

    // Actualizar Col R (18) y Col S (19)
    sheet.getRange(rowIndex, 18).setValue(coordName);
    sheet.getRange(rowIndex, 19).setValue(coordEmail);

    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function saveBulkAssignment(rowIndices, coordName, coordEmail) {
  const maintenance = PropertiesService.getScriptProperties().getProperty('MAINTENANCE_MODE');
  if (maintenance === 'true') {
    return { success: false, maintenance: true, message: 'Sistema en mantenimiento.' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_MAP['ASIGNACION']);
    if (!sheet) throw new Error('Hoja de asignación no encontrada.');

    if (!Array.isArray(rowIndices) || rowIndices.length === 0) {
      throw new Error('No hay filas para actualizar.');
    }

    rowIndices.forEach((rowIndex) => {
      sheet.getRange(rowIndex, 18).setValue(coordName);
      sheet.getRange(rowIndex, 19).setValue(coordEmail);
    });

    return { success: true, count: rowIndices.length };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function assignCoordinator(assignments) {
  const email = Session.getActiveUser().getEmail();
  const role = getUserRole(email);

  if (role !== ROLES.ADMIN && role !== ROLES.JEFE) {
    return { success: false, message: 'Permisos insuficientes.' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MAP.ASIGNACION);
    // assignments: [ { rowIndex, coordName, coordEmail }, ... ]
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      // Columna R = Nombre (18), Columna S = Email (19)
      sheet.getRange(a.rowIndex, 18).setValue(a.coordName);
      sheet.getRange(a.rowIndex, 19).setValue(a.coordEmail);
    }

    return { success: true, count: assignments.length };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- ENVÍO DE CORREO A DOCENTES ---
function sendTeacherEmail(toEmails, subject, htmlBody) {
  try {
    const recipients = toEmails
      .split(',')
      .filter((e) => e.includes('@'))
      .join(',');
    if (!recipients) return { success: false, message: 'Sin email válido' };

    // Procesar imágenes base64 para convertirlas a inlineImages (cid)
    const inlineImages = {};
    const imgRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/g;

    const processedBody = htmlBody.replace(imgRegex, function (match, contentType, base64Data) {
      const blobId = 'img' + Math.random().toString(36).substr(2, 9);
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, blobId);
      inlineImages[blobId] = blob;
      return match.replace(/src="[^"]+"/, 'src="cid:' + blobId + '"');
    });

    const options = {
      htmlBody: processedBody,
      name: 'Monitor Calidad - USMP',
    };

    if (Object.keys(inlineImages).length > 0) {
      options.inlineImages = inlineImages;
    }

    MailApp.sendEmail(recipients, subject, 'Su cliente de correo no soporta HTML.', options);

    return { success: true, message: 'Correo enviado correctamente.' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// --- ENVÍO DE CORREO INSTITUCIONAL ---
function sendMonitoringEmail(params) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const role = getUserRole(userEmail);

    if (role === ROLES.INVITADO) {
      return { success: false, message: 'Los usuarios invitados no pueden enviar correos.' };
    }

    // Validar destinatario
    if (!params.to || !params.to.includes('@')) {
      return { success: false, message: 'Dirección de correo de destino no válida: ' + params.to };
    }

    // Construcción de CC automático
    let ccList = userEmail; // Copia obligatoria al coordinador emisor
    if (params.ccJefatura) {
      ccList += ', ' + params.ccJefatura;
    }

    // Envío vía MailApp
    MailApp.sendEmail({
      to: params.to,
      cc: ccList,
      subject: params.subject,
      htmlBody: params.htmlBody,
      name: 'Acompañamiento docente USMP Virtual',
    });

    // Registrar tracking de interacción
    if (params.moduleKey && params.rowIndex && params.weekKey && params.actionType) {
      trackInteraction(params.moduleKey, params.rowIndex, params.weekKey, params.actionType, 'EMAIL');
    }

    return { success: true, message: 'Correo enviado correctamente a ' + params.to };
  } catch (e) {
    return { success: false, message: 'Error al enviar correo: ' + e.toString() };
  }
}

// --- INCREMENTAR CONTADOR GENÉRICO ---
function incrementCounter(moduleKey, rowIndex, headerName) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const sheetName = SHEET_MAP[moduleKey];
    if (!sheetName) return { success: false, message: 'Módulo inválido: ' + moduleKey };

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return { success: false, message: 'Hoja no encontrada: ' + sheetName };

    // 1. Localizar columna por HeaderName en Fila 1
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let colIndex = headers.indexOf(headerName);
    if (colIndex === -1) {
      colIndex = headers.findIndex((h) => String(h).trim() === headerName.trim());
    }

    if (colIndex === -1) {
      return {
        success: false,
        message: "Encabezado '" + headerName + "' no encontrado en fila 1.",
      };
    }

    // 2. Incrementar contador
    const row = parseInt(rowIndex);
    if (isNaN(row) || row < 1) return { success: false, message: 'Fila inválida: ' + rowIndex };

    const cell = sheet.getRange(row, colIndex + 1);
    const val = parseInt(cell.getValue()) || 0;
    cell.setValue(val + 1);

    return { success: true, newVal: val + 1 };
  } catch (e) {
    return { success: false, message: 'Error interno: ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// MÓDULO: SINCRONIZACIÓN Y MANTENIMIENTO (Fase 3.3)
// ==========================================

function runSyncAllWebApp() {
  const lock = LockService.getScriptLock();
  const props = PropertiesService.getScriptProperties();
  try {
    // Prevenir doble ejecución de mantenimiento
    lock.waitLock(30000);
    props.setProperty('MAINTENANCE_MODE', 'true');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mockUi = {
      alert: function (m) {
        console.log('Sync Alert:', m);
      },
    };

    // Llamar secuencialmente a SincronizacionIntern.gs
    ejecutarSincronizacion(
      ss,
      mockUi,
      'Asignación de coordinador',
      'Sistema de gestión del aprendizaje (LMS)- virtual',
      'VIRTUAL'
    );
    ejecutarSincronizacion(
      ss,
      mockUi,
      'Asignación de coordinador',
      'Sistema de gestión del aprendizaje (LMS)- presencial',
      'PRESENCIAL'
    );
    ejecutarSincronizacion(
      ss,
      mockUi,
      'Asignación de coordinador',
      'Acompañamiento del desempeño Pedagógico',
      'TODO'
    );

    return { success: true };
  } catch (e) {
    return { error: true, message: 'Fallo durante la sincronización: ' + e.toString() };
  } finally {
    props.deleteProperty('MAINTENANCE_MODE');
    lock.releaseLock();
  }
}

function runImportAndSyncWebApp() {
  const lock = LockService.getScriptLock();
  const props = PropertiesService.getScriptProperties();
  try {
    // Prevenir doble ejecución de mantenimiento
    lock.waitLock(30000);
    props.setProperty('MAINTENANCE_MODE', 'true');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mockUi = {
      alert: function (m) {
        console.log('Import Alert:', m);
      },
    };

    // 1. Llamar a ImportacionExterna.gs
    importarDatosATodoMatr();

    // 2. Llamar SincronizacionIntern.gs para armar la base en Acompañamiento
    ejecutarSincronizacion(
      ss,
      mockUi,
      'Asignación de coordinador',
      'Acompañamiento del desempeño Pedagógico',
      'TODO'
    );

    return { success: true };
  } catch (e) {
    return { error: true, message: 'Fallo durante la importación/sincronización: ' + e.toString() };
  } finally {
    props.deleteProperty('MAINTENANCE_MODE');
    lock.releaseLock();
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
