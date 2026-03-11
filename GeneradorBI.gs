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
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hojaSabana = ss.getSheetByName(SABANA_DOCENTE);
    if (!hojaSabana) {
      if(ui) ui.alert("❌ Error: No existe la hoja '" + SABANA_DOCENTE + "'.");
      return;
    }

    var hojaAsignacion = ss.getSheetByName(SHEET_MAP['ASIGNACION']);
    var hojaVirtual = ss.getSheetByName(SHEET_MAP['VIRTUAL']);
    var hojaAcomp = ss.getSheetByName(SHEET_MAP['ACOMPANAMIENTO']);

    if (!hojaAsignacion || !hojaVirtual || !hojaAcomp) {
      if(ui) ui.alert("❌ Error: Faltan hojas origen.");
      return;
    }

    // 1. Asignación (A a S) - 19 columnas (Solo Fila 1)
    var headersAsig = hojaAsignacion.getRange(1, 1, 1, 19).getValues()[0];
    
    // 2. LMS Virtual (Criterios Col 22 a 55) - 34 columnas (Fila 1 y 2)
    var codesLMS = hojaVirtual.getRange(1, 22, 1, 34).getValues()[0];
    var titlesLMS = hojaVirtual.getRange(2, 22, 1, 34).getValues()[0];

    // 3. Acompañamiento (Criterios Col 22 a 32) - 11 columnas (Fila 1 y 2)
    var codesAcomp = hojaAcomp.getRange(1, 22, 1, 11).getValues()[0];
    var titlesAcomp = hojaAcomp.getRange(2, 22, 1, 11).getValues()[0];

    // Ensamblar Fila 1 (Códigos) y Fila 2 (Títulos u omitido si es base)
    var fila1 = [];
    var fila2 = [];

    // Base Asignación
    for (var i = 0; i < 19; i++) {
      fila1.push(headersAsig[i] || 'Asig_Col' + (i+1));
      fila2.push(headersAsig[i] || 'Asig_Col' + (i+1)); // Mismo título abajo
    }

    // LMS Criterios
    for (var i = 0; i < 34; i++) {
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

    // Limpiar hoja y pegar (Las filas 1 y 2)
    var lc = hojaSabana.getLastColumn();
    if (lc > 0) {
      hojaSabana.getRange(1, 1, 2, lc).clearContent();
    }
    
    hojaSabana.getRange(1, 1, 1, fila1.length).setValues([fila1])
              .setFontWeight("bold").setBackground("#d9ead3");
    hojaSabana.getRange(2, 1, 1, fila2.length).setValues([fila2])
              .setFontWeight("bold").setBackground("#efefef");

    if(ui) ui.alert("✅ Cabeceras generadas exitosamente (" + fila1.length + " columnas).");
  } catch(e) {
    if(ui) ui.alert("❌ Error: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}

function sincronizarSabanaBI() {
  var ui = null;
  try {
     ui = SpreadsheetApp.getUi();
  } catch(e) {}

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    if (ui) ui.alert("⚠️ El sistema está ocupado. Intente luego.");
    return;
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hojaSabana = ss.getSheetByName(SABANA_DOCENTE);
    if (!hojaSabana) {
      if(ui) ui.alert("❌ Error: No existe la hoja " + SABANA_DOCENTE);
      return;
    }

    var hojaAsignacion = ss.getSheetByName(SHEET_MAP['ASIGNACION']);
    var hojaVirtual = ss.getSheetByName(SHEET_MAP['VIRTUAL']);
    var hojaPresencial = ss.getSheetByName(SHEET_MAP['PRESENCIAL']);
    var hojaAcomp = ss.getSheetByName(SHEET_MAP['ACOMPANAMIENTO']);

    var ultFilaAsig = hojaAsignacion.getLastRow();
    if (ultFilaAsig < 2) {
      if(ui) ui.alert("Sin datos en Asignación.");
      return;
    }

    var datosAsignacion = hojaAsignacion.getRange(2, 1, ultFilaAsig - 1, 19).getValues();

    var mapVirtual = construirMapaResultadosParaBI(hojaVirtual, 3, 55, 22, 34);
    var mapPresencial = construirMapaResultadosParaBI(hojaPresencial, 3, 55, 22, 34);
    var mapAcomp = construirMapaResultadosParaBI(hojaAcomp, 3, 32, 22, 11);

    var sabanaDatos = [];

    for (var i = 0; i < datosAsignacion.length; i++) {
        var filaAsig = datosAsignacion[i]; // 19 cols
        var id = String(filaAsig[15]); // ID Col P
        
        if (!id || id === 'undefined' || id === '') continue;

        var objLMS = mapVirtual[id] || mapPresencial[id] || { crit: new Array(34).fill(''), score: '' };
        var objAcomp = mapAcomp[id] || { crit: new Array(11).fill(''), score: '' };

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

        var nuevaFila = filaAsig.slice(); // 1 a 19
        
        // Agregar los 34 criterios de LMS
        for(var c=0; c<34; c++) {
           nuevaFila.push(objLMS.crit[c] !== undefined && objLMS.crit[c] !== '' ? objLMS.crit[c] : '');
        }
        nuevaFila.push(lms_vig); // LMS_TOTAL (Vigesimal)

        // Agregar los 11 criterios de Acomp
        for(var c=0; c<11; c++) {
           nuevaFila.push(objAcomp.crit[c] !== undefined && objAcomp.crit[c] !== '' ? objAcomp.crit[c] : '');
        }
        nuevaFila.push(acomp_vig); // ACOMP_TOTAL (Vigesimal)

        // Finales
        nuevaFila.push(puntajeGral);
        nuevaFila.push(puntajeVig);

        sabanaDatos.push(nuevaFila);
    }

    if (sabanaDatos.length > 0) {
       var lastR = hojaSabana.getLastRow();
       if (lastR >= 3) {
          hojaSabana.getRange(3, 1, lastR - 2, sabanaDatos[0].length).clearContent();
       }
       hojaSabana.getRange(3, 1, sabanaDatos.length, sabanaDatos[0].length).setValues(sabanaDatos);
    }

    if(ui) ui.alert("✅ Sábana BI Sincronizada exitosamente. Total registros: " + sabanaDatos.length);
  } catch(e) {
    if(ui) ui.alert("❌ Error: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}

function construirMapaResultadosParaBI(hoja, iniciarEnFila, colScore, colCritStart, colCritCount) {
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

  for (var i = 0; i < numFilas; i++) {
    var id = String(colIds[i][0]);
    if (id !== '' && id !== 'undefined') {
       var filaCrit = critMatrix.length > i ? critMatrix[i] : new Array(colCritCount).fill('');
       mapa[id] = {
         score: colScores[i][0],
         crit: filaCrit
       };
    }
  }
  return mapa;
}
