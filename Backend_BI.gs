/**
 * ==========================================
 * SUBSISTEMA BI - ANÁLISIS DE RESULTADOS DE DOCENTES
 * Archivo: Backend_BI.gs
 * ==========================================
 * Endpoint para obtener datos de la "Sábana General Docente"
 * 
 * Estructura de la Sábana (generada por GeneradorBI.gs):
 *   Fila 1 = Códigos de columna (header IDs)
 *   Fila 2 = Títulos descriptivos
 *   Fila 3+ = Datos
 *   Cols 1-19 = Asignación (A=1 hasta S=19)
 *     Col 3 (C) = Programa
 *     Col 5 (E) = Asignatura
 *     Col 7 (G) = Docente
 *     Col 8 (H) = Presencialidad (Virtual/Presencial)
 *   Cols 20-57 = LMS Criterios (38 cols expandidas)
 *   Col 58 = LMS_TOTAL (vigesimal)
 *   Cols 59-69 = Acompañamiento Criterios (11 cols)
 *   Col 70 = ACOMP_TOTAL (vigesimal)
 *   Col 71 = SCORE_GRAL (centesimal)
 *   Col 72 = SCORE_VIG (vigesimal Base 20)
 *   Tutorías Virtual: c_3_1_s1..s4 (cols 31-34 aprox)
 *   Evaluaciones Presencial: cp_3_1_s1..cp_4_1_s4 (cols 35-38 aprox)
 *
 * NOTA: Este archivo es independiente de Code.gs.
 */

function getSabanaBIData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Sábana General Docente");
    if (!sheet) {
       return { role: 'ERROR', message: "Hoja 'Sábana General Docente' no encontrada. Ejecute '(BI) Generar Cabeceras' y '(BI) Sincronizar' desde el menú." };
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 3) {
       return { role: 'ERROR', message: "La Sábana no tiene datos. Ejecute '(BI) Sincronizar Sábana General Docente' desde el menú." };
    }

    // Fila 1 = Códigos, Fila 2 = Títulos, Datos desde Fila 3
    var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headerCodes = allData[0]; // Fila 1: códigos de columna

    // Mapeo dinámico de índices por código de columna (Fila 1)
    function findCol(code) {
      for (var c = 0; c < headerCodes.length; c++) {
        if (String(headerCodes[c]).trim() === code) return c;
      }
      return -1;
    }

    // Columnas base de Asignación (índices 0-based)
    var iPrograma = 2;    // Col C (Programa)
    var iAsignatura = 4;  // Col E (Asignatura/Curso)
    var iDocente = 6;     // Col G (Docente)
    var iPresenc = 7;     // Col H (Presencialidad: Virtual/Presencial)

    // Puntajes finales (por código)
    var iLmsTotal = findCol('LMS_TOTAL');
    var iAcompTotal = findCol('ACOMP_TOTAL');
    var iScoreGral = findCol('SCORE_GRAL');
    var iScoreVig = findCol('SCORE_VIG');

    // Criterios exclusivos Virtual (Tutorías)
    var iTutS1 = findCol('c_3_1_s1');
    var iTutS2 = findCol('c_3_1_s2');
    var iTutS3 = findCol('c_3_1_s3');
    var iTutS4 = findCol('c_3_1_s4');

    // Criterios exclusivos Presencial (Evaluaciones/Asistencia)
    var iEvS1 = findCol('cp_3_1_s1');
    var iEvS2 = findCol('cp_3_2_s2');
    var iEvS4 = findCol('cp_3_3_s4');
    var iAsisS4 = findCol('cp_4_1_s4');

    var result = [];

    // Recorrer datos desde Fila 3 (índice 2 en el array)
    for (var i = 2; i < allData.length; i++) {
      var row = allData[i];

      // Validar que tenga asignatura
      var asignatura = String(row[iAsignatura] || '').trim();
      if (!asignatura) continue;

      var docente = String(row[iDocente] || '').trim();
      var programa = String(row[iPrograma] || '').trim();
      var presenc = String(row[iPresenc] || '').trim().toUpperCase();

      // Determinar modalidad según reglas de negocio:
      // Col D (index 3) = "Modalidad" → "Virtual" o "Presencial"
      // Col N (index 13) = "Tipo de metodología" → "Híbrida" o vacío
      // VIRTUAL/HÍBRIDA (tutorías): Col D = "Virtual" O Col N contiene "Híbrida"
      // PRESENCIAL (evaluaciones): Col D = "Presencial" Y Col N NO dice "Híbrida"
      var colD = String(row[3] || '').trim().toUpperCase();
      var colN = String(row[13] || '').trim().toUpperCase();

      var esHibrida = (colN.indexOf('HÍBRIDA') !== -1 || colN.indexOf('HIBRIDA') !== -1);
      var esVirtualEnD = (colD.indexOf('VIRTUAL') !== -1);
      var esPresencialEnD = (colD.indexOf('PRESENCIAL') !== -1);

      var modalidad = 'VIRTUAL'; // default
      if (esPresencialEnD && !esHibrida) {
        modalidad = 'PRESENCIAL';
      }

      // Extraer puntajes
      var lmsVig = iLmsTotal !== -1 ? parseFloat(row[iLmsTotal]) : 0;
      var acompVig = iAcompTotal !== -1 ? parseFloat(row[iAcompTotal]) : 0;
      var scoreGral = iScoreGral !== -1 ? parseFloat(row[iScoreGral]) : 0;
      var scoreVig = iScoreVig !== -1 ? parseFloat(row[iScoreVig]) : 0;

      if (isNaN(lmsVig)) lmsVig = 0;
      if (isNaN(acompVig)) acompVig = 0;
      if (isNaN(scoreGral)) scoreGral = 0;
      if (isNaN(scoreVig)) scoreVig = 0;

      // Criterios exclusivos según modalidad
      var criterios = {};
      if (modalidad === 'PRESENCIAL') {
        criterios = {
          S1: iEvS1 !== -1 ? row[iEvS1] : null,
          S2: iEvS2 !== -1 ? row[iEvS2] : null,
          S3: iEvS4 !== -1 ? row[iEvS4] : null,
          S4: iAsisS4 !== -1 ? row[iAsisS4] : null
        };
      } else {
        criterios = {
          S1: iTutS1 !== -1 ? row[iTutS1] : null,
          S2: iTutS2 !== -1 ? row[iTutS2] : null,
          S3: iTutS3 !== -1 ? row[iTutS3] : null,
          S4: iTutS4 !== -1 ? row[iTutS4] : null
        };
      }

      result.push({
        rowIndex: i + 1,
        nombre: docente || asignatura,
        asignatura: asignatura,
        programa: programa,
        modalidad: modalidad,
        ptsLMS: lmsVig,
        ptsAcomp: acompVig,
        promedio: scoreVig,
        scoreGral: scoreGral,
        criteriosExclusivos: criterios
      });
    }

    return { success: true, biData: result };

  } catch(e) {
    return { role: 'ERROR', message: "Error en Backend_BI: " + e.toString() };
  }
}
