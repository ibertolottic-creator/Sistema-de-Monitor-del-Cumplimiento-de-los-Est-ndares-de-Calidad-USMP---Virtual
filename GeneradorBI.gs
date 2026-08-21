/**
 * ======================================================================
 * DATA MART: SÁBANA GENERAL DOCENTE PARA BI
 * ARCHIVO: GeneradorBI.gs
 * ======================================================================
 */

const SABANA_DOCENTE = 'Sábana General Docente';

function generarCabecerasSabanaGeneral() {
  var lock = LockService.getScriptLock();
  var ui = null;
  try {
    ui = SpreadsheetApp.getUi();
  } catch(e) {}

  try {
    lock.waitLock(10000);
    var count = generarCabecerasSabanaGeneralSinLock();
    if(ui) ui.alert("✅ Cabeceras generadas exitosamente (" + count + " columnas).");
  } catch(e) {
    if(ui) ui.alert("❌ Error: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}

function generarCabecerasSabanaGeneralSinLock() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hojaSabana = ss.getSheetByName(SABANA_DOCENTE);
    if (!hojaSabana) {
      hojaSabana = ss.insertSheet(SABANA_DOCENTE);
    }

    var hojaAsignacion = ss.getSheetByName(SHEET_MAP['ASIGNACION']);
    var hojaVirtual = ss.getSheetByName(SHEET_MAP['VIRTUAL']);
    var hojaPresencial = ss.getSheetByName(SHEET_MAP['PRESENCIAL']);
    var hojaAcomp = ss.getSheetByName(SHEET_MAP['ACOMPANAMIENTO']);

    if (!hojaAsignacion || !hojaVirtual || !hojaAcomp || !hojaPresencial) {
      throw new Error("Faltan hojas origen.");
    }

    // 1. Asignación (A a S) - 19 columnas (Solo Fila 1)
    var headersAsig = hojaAsignacion.getRange(1, 1, 1, 19).getValues()[0];
    
    // 2. LMS Virtual y Presencial (Criterios Col 21 a 54) - 34 columnas de origen (Fila 1 y 2)
    var codesLMS = hojaVirtual.getRange(1, 21, 1, 34).getValues()[0];
    var titlesLMS = hojaVirtual.getRange(2, 21, 1, 34).getValues()[0];
    var codesPresencial = hojaPresencial.getRange(1, 21, 1, 34).getValues()[0];
    var titlesPresencial = hojaPresencial.getRange(2, 21, 1, 34).getValues()[0];

    // 2.1 LMS Metadata: Timestamps (Col 56 a 89) = 34 columnas
    var tsCodesLMS = hojaVirtual.getRange(1, 56, 1, 34).getValues()[0];
    var tsTitlesLMS = hojaVirtual.getRange(2, 56, 1, 34).getValues()[0];
    var tsCodesPre = hojaPresencial.getRange(1, 56, 1, 34).getValues()[0];
    var tsTitlesPre = hojaPresencial.getRange(2, 56, 1, 34).getValues()[0];

    // 2.2 LMS Metadata: KPIs (Col 91 a 138) = 48 columnas (se omitirán las vacías dinámicamente)
    var lastColVirtual = hojaVirtual.getLastColumn();
    var actualKpiCountVirtual = Math.max(0, Math.min(48, lastColVirtual - 91 + 1));
    var kpiCodesLMS = actualKpiCountVirtual > 0 ? hojaVirtual.getRange(1, 91, 1, actualKpiCountVirtual).getValues()[0] : [];
    var kpiTitlesLMS = actualKpiCountVirtual > 0 ? hojaVirtual.getRange(2, 91, 1, actualKpiCountVirtual).getValues()[0] : [];

    // 3. Acompañamiento (Criterios Col 21 a 31) - 11 columnas (Fila 1 y 2)
    var codesAcomp = hojaAcomp.getRange(1, 21, 1, 11).getValues()[0];
    var titlesAcomp = hojaAcomp.getRange(2, 21, 1, 11).getValues()[0];

    // 3.1 Acomp Metadata: Timestamps (Col 35 a 45) - 11 columnas
    var tsCodesAcomp = hojaAcomp.getRange(1, 35, 1, 11).getValues()[0];
    var tsTitlesAcomp = hojaAcomp.getRange(2, 35, 1, 11).getValues()[0];

    // 3.2 Acomp Metadata: KPIs (Col 47 a 58) - 12 columnas
    var lastColAcomp = hojaAcomp.getLastColumn();
    var actualKpiCountAcomp = Math.max(0, Math.min(12, lastColAcomp - 47 + 1));
    var kpiCodesAcomp = actualKpiCountAcomp > 0 ? hojaAcomp.getRange(1, 47, 1, actualKpiCountAcomp).getValues()[0] : [];
    var kpiTitlesAcomp = actualKpiCountAcomp > 0 ? hojaAcomp.getRange(2, 47, 1, actualKpiCountAcomp).getValues()[0] : [];

    // Ensamblar Fila 1 (Códigos) y Fila 2 (Títulos u omitido si es base)
    var fila1 = [];
    var fila2 = [];

    // Base Asignación
    for (var i = 0; i < 19; i++) {
      fila1.push(headersAsig[i] || 'Asig_Col' + (i+1));
      fila2.push(headersAsig[i] || 'Asig_Col' + (i+1)); // Mismo título abajo
    }
    fila1.push('FECHA_INICIO_CURSO');
    fila2.push('Fecha de Inicio de Asignatura');

    // LMS Criterios Expandidos (38 columnas)
    // 0 a 11 (Comunes)
    for (var i = 0; i < 12; i++) {
      fila1.push(codesLMS[i] || 'LMS_C' + (i+1));
      fila2.push(titlesLMS[i] || 'Criterio LMS ' + (i+1));
    }
    // 12 a 15 (Exclusivos Virtual - Tutorías)
    for (var i = 12; i < 16; i++) {
      fila1.push(codesLMS[i] || 'LMS_C' + (i+1));
      fila2.push(titlesLMS[i] || 'Criterio LMS ' + (i+1));
    }
    // 16 a 19 (Exclusivos Presencial - Evaluaciones/Asistencia) - Están en los índices 12 al 15 del origen presencial
    for (var i = 12; i < 16; i++) {
      fila1.push(codesPresencial[i] || 'LMS_P_' + (i+1));
      fila2.push(titlesPresencial[i] || 'Criterio Presencial ' + (i+1));
    }
    // 20 a 37 (Comunes - Índices 16 al 33 del origen)
    for (var i = 16; i < 34; i++) {
      fila1.push(codesLMS[i] || 'LMS_C' + (i+1));
      fila2.push(titlesLMS[i] || 'Criterio LMS ' + (i+1));
    }
    fila1.push('LMS_TOTAL');
    fila2.push('Puntaje Total LMS (Bruto)');

    // Acomp Criterios
    for (var i = 0; i < 11; i++) {
      fila1.push(codesAcomp[i] || 'ACOMP_C' + (i+1));
      fila2.push(titlesAcomp[i] || 'Criterio Acomp ' + (i+1));
    }
    fila1.push('ACOMP_TOTAL');
    fila2.push('Puntaje Total Acompañamiento (Bruto)');

    // Puntajes Finales
    fila1.push('SCORE_GRAL');
    fila2.push('Puntaje General Centesimal (100%)');
    fila1.push('SCORE_VIG');
    fila2.push('Puntaje General Vigesimal (Base 20)');

    // -----------------------------------------------------------
    // AGREGANDO LA METADATA DEL TRABAJO DEL COORDINADOR
    // -----------------------------------------------------------

    // 1. TIMESTAMPS LMS EXPANDIDOS (38 Columnas de Fechas/Horas de Evaluación)
    for (var i = 0; i < 12; i++) {
      fila1.push(tsCodesLMS[i] || 'LMS_TS_' + (i+1));
      fila2.push(tsTitlesLMS[i] || 'Fecha Eval ' + (i+1));
    }
    // Exclusivos Virtual
    for (var i = 12; i < 16; i++) {
        fila1.push(tsCodesLMS[i] || 'LMS_TS_' + (i+1));
        fila2.push(tsTitlesLMS[i] || 'Fecha Eval ' + (i+1));
    }
    // Exclusivos Presencial
    for (var i = 12; i < 16; i++) {
        fila1.push(tsCodesPre[i] || 'LMS_P_TS_' + (i+1));
        fila2.push(tsTitlesPre[i] || 'Fecha Eval Pre ' + (i+1));
    }
    // Resto comunes
    for (var i = 16; i < 34; i++) {
        fila1.push(tsCodesLMS[i] || 'LMS_TS_' + (i+1));
        fila2.push(tsTitlesLMS[i] || 'Fecha Eval ' + (i+1));
    }

    // 2. TIMESTAMPS ACOMPAÑAMIENTO
    for (var i = 0; i < 11; i++) {
        fila1.push(tsCodesAcomp[i] || 'ACOMP_TS_' + (i+1));
        fila2.push(tsTitlesAcomp[i] || 'Fecha Acomp ' + (i+1));
    }

    // 3. KPIs LMS (Hits, Auditorías, Emails, WAs)
    var validIndexLMS = []; // Para trackear qué KPIs reales copiamos (ignorando vacíos)
    for (var i = 0; i < kpiCodesLMS.length; i++) {
        var code = kpiCodesLMS[i];
        if (code && String(code).trim() !== '') {
            fila1.push(code);
            fila2.push(kpiTitlesLMS[i] || code);
            validIndexLMS.push(i);
        }
    }

    // 4. KPIs ACOMPAÑAMIENTO
    var validIndexAcomp = [];
    for (var i = 0; i < kpiCodesAcomp.length; i++) {
        var code = kpiCodesAcomp[i];
        if (code && String(code).trim() !== '') {
            fila1.push(code);
            fila2.push(kpiTitlesAcomp[i] || code);
            validIndexAcomp.push(i);
        }
    }

    // Limpiar hoja y pegar (Las filas 1 y 2)
    var lc = hojaSabana.getLastColumn();
    if (lc > 0) {
      hojaSabana.getRange(1, 1, 2, lc).clearContent();
    }
    
    hojaSabana.getRange(1, 1, 1, fila1.length).setValues([fila1])
              .setFontWeight("bold").setBackground("#d9ead3");
    hojaSabana.getRange(2, 1, 1, fila2.length).setValues([fila2])
              .setFontWeight("bold").setBackground("#efefef");

    return fila1.length;
}

function sincronizarSabanaBI(silentMode) {
  var ui = null;
  if (!silentMode) {
    try {
       ui = SpreadsheetApp.getUi();
    } catch(e) {}
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    if (ui) ui.alert("⚠️ El sistema está ocupado. Intente luego.");
    return;
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // Regenerar cabeceras siempre para asegurar que la estructura esté 100% sincronizada con los datos
    generarCabecerasSabanaGeneralSinLock();
    var hojaSabana = ss.getSheetByName(SABANA_DOCENTE);
    if (!hojaSabana) return;

    var hojaAsignacion = ss.getSheetByName(SHEET_MAP['ASIGNACION']);
    var hojaVirtual = ss.getSheetByName(SHEET_MAP['VIRTUAL']);
    var hojaPresencial = ss.getSheetByName(SHEET_MAP['PRESENCIAL']);
    var hojaAcomp = ss.getSheetByName(SHEET_MAP['ACOMPANAMIENTO']);

    var globalStartDate = '';
    if (hojaVirtual && hojaVirtual.getLastRow() >= 2) {
        globalStartDate = hojaVirtual.getRange("T2").getValue();
    }

    var ultFilaAsig = hojaAsignacion.getLastRow();
    if (ultFilaAsig < 2) {
      if(ui) ui.alert("Sin datos en Asignación.");
      return;
    }
    var datosAsignacion = hojaAsignacion.getRange(2, 1, ultFilaAsig - 1, 19).getValues();

    // Mapas de Notas + Metadata
    // Virtual y Presencial: Criterios Col 21 a 54 (34 cols), Score Col 55, TS Col 56 a 89 (34 cols), KPIs Col 91 a 138 (48 cols)
    var mapVirtual = construirMapaResultadosParaBI(hojaVirtual, 3, 55, 21, 34, 56, 34, 91, 48);
    var mapPresencial = construirMapaResultadosParaBI(hojaPresencial, 3, 55, 21, 34, 56, 34, 91, 48);
    
    // Acompañamiento: Criterios Col 21 a 31 (11 cols), Score Col 32, TS Col 35 a 45 (11 cols), KPIs Col 47 a 58 (12 cols)
    var mapAcomp = construirMapaResultadosParaBI(hojaAcomp, 3, 32, 21, 11, 35, 11, 47, 12);

    // Obtener códigos de KPIs reales para mapear uno a uno omitiendo vacíos
    var lastColVirtualSync = hojaVirtual.getLastColumn();
    var actualKpiCountVirtualSync = Math.max(0, Math.min(48, lastColVirtualSync - 91 + 1));
    var kpiCodesVirtual = actualKpiCountVirtualSync > 0 ? hojaVirtual.getRange(1, 91, 1, actualKpiCountVirtualSync).getValues()[0] : [];

    var lastColAcompSync = hojaAcomp.getLastColumn();
    var actualKpiCountAcompSync = Math.max(0, Math.min(12, lastColAcompSync - 47 + 1));
    var kpiCodesAc = actualKpiCountAcompSync > 0 ? hojaAcomp.getRange(1, 47, 1, actualKpiCountAcompSync).getValues()[0] : [];

    var sabanaDatos = [];

    for (var i = 0; i < datosAsignacion.length; i++) {
        var filaAsig = datosAsignacion[i]; // 19 cols
        var id = String(filaAsig[15]).trim(); // ID Col P
        
        if (!id || id === 'undefined' || id === '') continue;

        // Buscar en Hashmap de forma exacta y limpia usando fragmentos si es que está amalgamado en Asignación
        var baseKeyStr = id.toUpperCase().trim();
        var idFragments = baseKeyStr.match(/P[0-9A-Z_]+/g) || [baseKeyStr];

        var isVirtual = false;
        var isPresencial = false;
        var objLMS = { crit: new Array(34).fill(''), score: '', ts: new Array(34).fill(''), kpi: new Array(44).fill('') };
        var objAcomp = { crit: new Array(11).fill(''), score: '', ts: new Array(11).fill(''), kpi: new Array(8).fill('') };

        var matchV = undefined;
        var matchP = undefined;
        var matchA = undefined;

        // Comprobamos si CUALQUIERA de los fragmentos matriciales existe en las notas
        for (var f = 0; f < idFragments.length; f++) {
            var frag = idFragments[f];
            if (mapVirtual[frag] !== undefined) matchV = mapVirtual[frag];
            if (mapPresencial[frag] !== undefined) matchP = mapPresencial[frag];
            if (mapAcomp[frag] !== undefined) matchA = mapAcomp[frag];
        }

        if (matchV !== undefined) { isVirtual = true; objLMS = matchV; }
        else if (matchP !== undefined) { isPresencial = true; objLMS = matchP; }

        if (matchA !== undefined) { objAcomp = matchA; }

        var u_val = objLMS.score !== '' && !isNaN(objLMS.score) ? parseFloat(objLMS.score) : 0;
        var z_val = objAcomp.score !== '' && !isNaN(objAcomp.score) ? parseFloat(objAcomp.score) : 0;

        var puntajeGral = '';
        var puntajeVig = '';
        
        var lms_vig = '';
        var acomp_vig = '';

        if (objLMS.score !== '' || objAcomp.score !== '') {
           puntajeGral = ((u_val / 136) * 50) + ((z_val / 44) * 50);
           puntajeVig = puntajeGral / 5;
           
           if (objLMS.score !== '') lms_vig = parseFloat(((u_val / 136) * 20).toFixed(2));
           if (objAcomp.score !== '') acomp_vig = parseFloat(((z_val / 44) * 20).toFixed(2));

           if(isNaN(puntajeGral) || isNaN(puntajeVig)) {
              puntajeGral = '';
              puntajeVig = '';
           } else {
             puntajeGral = parseFloat(puntajeGral.toFixed(2));
             puntajeVig = parseFloat(puntajeVig.toFixed(2));
           }
        }

        var nuevaFila = filaAsig.slice(0, 19); // 1 a 19
        nuevaFila.push(globalStartDate); // Columna T (Índice 19) es la fecha de inicio global del curso de la celda T2 de Virtual
        
        // Agregar los 38 criterios de LMS (fusionados)
        var critExpandidos = new Array(38).fill(null);
        if (objLMS.score !== '') {
            // Llenar 0-11 (Comunes)
            for (var c=0; c<12; c++) critExpandidos[c] = objLMS.crit[c] === '' ? null : objLMS.crit[c];
            
            // Llenar 12-15 (Virtual) o 16-19 (Presencial)
            if (isVirtual) {
               for (var c=12; c<16; c++) critExpandidos[c] = objLMS.crit[c] === '' ? null : objLMS.crit[c];
            } else if (isPresencial) {
               for (var c=12; c<16; c++) critExpandidos[c+4] = objLMS.crit[c] === '' ? null : objLMS.crit[c];
            }
            
            // Llenar 20-37 (Comunes - origen 16 a 33)
            for (var c=16; c<34; c++) critExpandidos[c+4] = objLMS.crit[c] === '' ? null : objLMS.crit[c];
        }

        for (var c=0; c<38; c++) {
           nuevaFila.push(critExpandidos[c]);
        }
        nuevaFila.push(lms_vig); // LMS_TOTAL (Vigesimal)

        // Agregar los 11 criterios de Acomp
        for(var c=0; c<11; c++) {
           var valAcomp = objAcomp.crit[c] !== undefined && objAcomp.crit[c] !== '' ? objAcomp.crit[c] : null;
           nuevaFila.push(valAcomp);
        }
        nuevaFila.push(acomp_vig); // ACOMP_TOTAL (Vigesimal)

        // Finales
        nuevaFila.push(puntajeGral);
        nuevaFila.push(puntajeVig);

        // ----------------------------------------------------
        // EMPUJAR METADATA DEL COORDINADOR
        // ----------------------------------------------------
        
        // 1. Expandir Timestamps LMS (38 columnas simulando la expansión 34->38)
        var tsExpandidos = new Array(38).fill(null);
        if (objLMS.score !== '' || objLMS.ts[0] !== '') {
            for (var c=0; c<12; c++) tsExpandidos[c] = objLMS.ts[c] === '' ? null : objLMS.ts[c];
            if (isVirtual) {
                for (var c=12; c<16; c++) tsExpandidos[c] = objLMS.ts[c] === '' ? null : objLMS.ts[c];
            } else if (isPresencial) {
                for (var c=12; c<16; c++) tsExpandidos[c+4] = objLMS.ts[c] === '' ? null : objLMS.ts[c];
            }
            for (var c=16; c<34; c++) tsExpandidos[c+4] = objLMS.ts[c] === '' ? null : objLMS.ts[c];
        }
        for (var c=0; c<38; c++) nuevaFila.push(tsExpandidos[c]);

        // 2. Timestamps Acompañamiento (11 cols)
        for (var c=0; c<11; c++) {
            var v = objAcomp.ts[c];
            nuevaFila.push(v === '' || v === undefined ? null : v);
        }

        // Para los KPIs de LMS
        var tempKpiLMS = objLMS.kpi;

        // Inyectar KPIs LMS omitiendo los de título vacío
        for (var c = 0; c < kpiCodesVirtual.length; c++) {
            if (kpiCodesVirtual[c] && String(kpiCodesVirtual[c]).trim() !== '') {
                var valKpi = tempKpiLMS[c] !== undefined && tempKpiLMS[c] !== '' ? tempKpiLMS[c] : null;
                nuevaFila.push(valKpi);
            }
        }

        // Lo mismo para Acomp
        for (var c = 0; c < kpiCodesAc.length; c++) {
            if (kpiCodesAc[c] && String(kpiCodesAc[c]).trim() !== '') {
                var valKpiA = objAcomp.kpi[c] !== undefined && objAcomp.kpi[c] !== '' ? objAcomp.kpi[c] : null;
                nuevaFila.push(valKpiA);
            }
        }

        sabanaDatos.push(nuevaFila);
    }

    if (sabanaDatos.length > 0) {
       var lastR = hojaSabana.getLastRow();
       if (lastR >= 3) {
          hojaSabana.getRange(3, 1, lastR - 2, sabanaDatos[0].length).clearContent();
       }
       hojaSabana.getRange(3, 1, sabanaDatos.length, sabanaDatos[0].length).setValues(sabanaDatos);
    }

    // Registrar tiempo en caché para auto-actualización rápida de dashboards
    PropertiesService.getScriptProperties().setProperty('LAST_BI_SYNC', new Date().getTime().toString());

    if(ui) ui.alert("✅ Sábana BI Sincronizada exitosamente. Total registros: " + sabanaDatos.length);
  } catch(e) {
    if(ui) ui.alert("❌ Error: " + e.toString());
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function construirMapaResultadosParaBI(hoja, iniciarEnFila, colScore, colCritStart, colCritCount, colTsStart, colTsCount, colKpiStart, colKpiCount) {
  var mapa = {};
  if (!hoja) return mapa;

  var lr = hoja.getLastRow();
  if (lr < iniciarEnFila) return mapa;

  var numFilas = lr - iniciarEnFila + 1;
  var colIds = hoja.getRange(iniciarEnFila, 16, numFilas, 1).getValues(); // Col P
  var colScores = hoja.getRange(iniciarEnFila, colScore, numFilas, 1).getValues();
  
  var critMatrix = [];
  if (colCritStart && colCritCount) {
    critMatrix = hoja.getRange(iniciarEnFila, colCritStart, numFilas, colCritCount).getValues();
  }

  // 1. Extraer Timestamps
  var tsMatrix = [];
  if (colTsStart && colTsCount) {
      tsMatrix = hoja.getRange(iniciarEnFila, colTsStart, numFilas, colTsCount).getValues();
  }

  // 2. Extraer KPIs
  var kpiMatrix = [];
  if (colKpiStart && colKpiCount) {
      var lastCol = hoja.getLastColumn();
      var actualKpiCount = Math.max(0, Math.min(colKpiCount, lastCol - colKpiStart + 1));
      if (actualKpiCount > 0) {
          kpiMatrix = hoja.getRange(iniciarEnFila, colKpiStart, numFilas, actualKpiCount).getValues();
      }
  }

  for (var i = 0; i < numFilas; i++) {
    // Normalizar ID de la Hoja Hija cruda: Mayúsculas, sin espacios
    var rawIdStr = String(colIds[i][0]).toUpperCase().trim();
    if (rawIdStr !== '' && rawIdStr !== 'UNDEFINED' && rawIdStr !== 'NULL') {
       
       // MAGIA REGEX: Despiezar IDs fusionados (Ej. P_X_01P_X_02)
       // Extrae todos los fragmentos que empiezan con 'P' seguidos de números/letras/guiones_bajos
       var idsLimpiosArr = rawIdStr.match(/P[0-9A-Z_]+/g);
       
       if (idsLimpiosArr && idsLimpiosArr.length > 0) {
           var filaCrit = critMatrix.length > i ? critMatrix[i] : new Array(colCritCount).fill('');
           
           var sumaCriterios = 0;
           for(var c = 0; c < filaCrit.length; c++) {
              if(filaCrit[c] !== '' && !isNaN(filaCrit[c])) sumaCriterios += Number(filaCrit[c]);
           }

           var puntajeHoja = colScores[i][0];
           // Rescate Automático de Fórmula Rota (Si la Excel no mandó score, el backend lo suma manual)
           var puntajeFinal = (puntajeHoja !== '' && !isNaN(puntajeHoja) && Number(puntajeHoja) > 0) 
                              ? puntajeHoja 
                              : (sumaCriterios > 0 ? sumaCriterios : '');

           // Extraer filas para metadatos, controlando límites
           var filaTs = tsMatrix.length > i ? tsMatrix[i] : (colTsCount ? new Array(colTsCount).fill('') : []);
           var filaKpi = kpiMatrix.length > i ? kpiMatrix[i] : (colKpiCount ? new Array(colKpiCount).fill('') : []);

           // Agregamos el paquete de resultados a TODOS LOS IDS extraídos de esa celda
           for (var j = 0; j < idsLimpiosArr.length; j++) {
              var splitId = idsLimpiosArr[j];
              mapa[splitId] = {
                 score: puntajeFinal,
                 crit: filaCrit,
                 ts: filaTs,
                 kpi: filaKpi
              };
           }
       }
    }
  }
  return mapa;
}

/**
 * ======================================================================
 * FUNCION DE DIAGNOSTICO DE CADENAS MATRICIALES (SOLO DEBUG)
 * ======================================================================
 */
function diagnosticarIDsOcultos(testId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaAsignacion = ss.getSheetByName(SHEET_MAP['ASIGNACION']);
  var hojaVirtual = ss.getSheetByName(SHEET_MAP['VIRTUAL']);
  var hojaPresencial = ss.getSheetByName(SHEET_MAP['PRESENCIAL']);

  var idABuscar = testId || "P202602PL0102CU2693";
  Logger.log("Buscando: " + idABuscar);

  var foundInAsig = false;
  var rowsAsig = hojaAsignacion.getDataRange().getValues();
  for(var i=1; i<rowsAsig.length; i++) {
     var cellVal = String(rowsAsig[i][15]).trim();
     if(cellVal.indexOf(idABuscar) !== -1) {
        Logger.log("Encontrado en Asignación Fila " + (i+1) + " Valor Celda: [" + cellVal + "]");
        foundInAsig = true;
     }
  }

  var foundInVirtual = false;
  if (hojaVirtual) {
    var rowsV = hojaVirtual.getDataRange().getValues();
    for(var i=2; i<rowsV.length; i++) {
       var cellVal = String(rowsV[i][15]).trim();
       if(cellVal.indexOf(idABuscar) !== -1) {
          Logger.log("Encontrado en Virtual Fila " + (i+1) + " Valor Celda: [" + cellVal + "]");
          foundInVirtual = true;
       }
    }
  }

  var foundInPresencial = false;
  if (hojaPresencial) {
    var rowsP = hojaPresencial.getDataRange().getValues();
    for(var i=2; i<rowsP.length; i++) {
       var cellVal = String(rowsP[i][15]).trim();
       if(cellVal.indexOf(idABuscar) !== -1) {
          Logger.log("Encontrado en Presencial Fila " + (i+1) + " Valor Celda: [" + cellVal + "]");
          foundInPresencial = true;
       }
    }
  }

  return {
    asig: foundInAsig,
    virtual: foundInVirtual,
    presencial: foundInPresencial
  };
}
