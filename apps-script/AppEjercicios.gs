// AppEjercicios.gs
// Backend de la app propia de registro de ejercicios (PWA "Mi Gym").
// Se pega como ARCHIVO NUEVO en el proyecto Apps Script "Informe Salud Semanal"
// (el mismo que tiene InformeSalud.gs). Reutiliza CFG.sheetId de ese archivo.
//
// Hace tres cosas:
//   1. doPost(e)              → recibe una sesión desde la PWA y la guarda en la
//                               pestaña "Ejercicios" del Sheet registro_salud_completo.
//   2. leerSesionesFuerza_()  → lee esa pestaña y devuelve EXACTAMENTE la misma forma
//                               que leerLyfta(): [{fecha, fechaStr, titulo, durMin,
//                               sets:[{ej,peso,reps,e1rm}]}]. Con fallback al CSV de
//                               Lyfta si la pestaña aún está vacía (transición sin romper).
//   3. pruebaAppEjercicios()  → prueba manual desde el editor.
//
// INSTALACIÓN (una sola vez):
//   · Proyecto → Configuración → Propiedades del script: agrega APP_SECRETO con un
//     texto largo y aleatorio (el mismo que pondrás en web/config.js).
//   · Implementar → Nueva implementación → Aplicación web ·
//       Ejecutar como: Yo · Quién tiene acceso: Cualquiera · copia la URL /exec.
//   · OJO: si algún día este proyecto ya tuviera otro doPost, NO lo dupliques: fusiona
//     la lógica en un solo doPost (Apps Script solo admite uno por proyecto).

var APP_HOJA = 'Ejercicios'; // pestaña donde se guardan las series
var APP_HEADERS = [
  'Sesion_id', 'Fecha', 'Titulo', 'Duracion_min', 'Ejercicio', 'Grupo', 'Tipo',
  'Serie', 'Peso', 'Reps', 'Altura_cm', 'Segundos', 'RPE', 'Nota',
];

// ── ENDPOINT ──────────────────────────────────────────────────────────────────
// La PWA hace POST con Content-Type: text/plain (para evitar el preflight CORS de
// GitHub Pages). El cuerpo es un JSON: { secreto, sesion:{...} }.
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return jsonSalida_({ ok: false, error: 'sin cuerpo' });
    var body = JSON.parse(e.postData.contents);

    var esperado = PropertiesService.getScriptProperties().getProperty('APP_SECRETO');
    if (!esperado || body.secreto !== esperado) return jsonSalida_({ ok: false, error: 'no autorizado' });

    // Permite mandar una sesión suelta o varias en un lote (cola offline de la app).
    var sesiones = body.sesiones || (body.sesion ? [body.sesion] : []);
    if (!sesiones.length) return jsonSalida_({ ok: false, error: 'sin sesiones' });

    var guardadas = 0, filas = 0;
    sesiones.forEach(function (s) {
      var n = guardarSesion_(s);
      if (n > 0) {
        guardadas++; filas += n;
        // Solo al primer guardado (n>0): marca el día en la tabla diaria. Un try/catch
        // aísla esa escritura para que jamás tumbe el guardado de la sesión (lo crítico).
        try { marcarDiaEntrenado_(s); } catch (err2) { Logger.log('marcarDiaEntrenado_ falló: ' + err2); }
      }
    });

    return jsonSalida_({ ok: true, sesiones: guardadas, filas: filas });
  } catch (err) {
    return jsonSalida_({ ok: false, error: String(err) });
  }
}

// Sonda de vida para probar la URL desde el navegador sin la app.
function doGet() {
  return jsonSalida_({ ok: true, servicio: 'AppEjercicios', hoja: APP_HOJA });
}

function jsonSalida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Escribe una sesión (una fila por serie) en la pestaña Ejercicios. Idempotente por
// Sesion_id: si ya existe esa sesión, no la duplica (la app puede reintentar sin miedo).
function guardarSesion_(s) {
  if (!s || !s.sets || !s.sets.length) return 0;
  var hoja = hojaEjercicios_();

  var sesionId = String(s.sesion_id || s.sesionId || '').trim();
  if (sesionId && sesionYaExiste_(hoja, sesionId)) return 0; // ya guardada antes

  var fecha = s.fecha ? new Date(s.fecha) : new Date();
  var titulo = String(s.titulo || '').trim();
  var durMin = numeroApp_(s.durMin != null ? s.durMin : s.duracion_min);

  var filas = [];
  s.sets.forEach(function (set, i) {
    filas.push([
      sesionId,
      fecha,
      titulo,
      durMin != null ? durMin : '',
      String(set.ej || set.ejercicio || '').trim(),
      String(set.grupo || '').trim(),
      String(set.tipo || '').trim(),
      set.serie != null ? set.serie : (i + 1),
      numeroApp_(set.peso) != null ? numeroApp_(set.peso) : 0,
      numeroApp_(set.reps) != null ? numeroApp_(set.reps) : 0,
      numeroApp_(set.altura_cm != null ? set.altura_cm : set.alturaCm),
      numeroApp_(set.segundos),
      numeroApp_(set.rpe),
      String(set.nota || '').trim(),
    ].map(function (v) { return v == null ? '' : v; }));
  });

  hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, APP_HEADERS.length).setValues(filas);
  return filas.length;
}

function hojaEjercicios_() {
  var ss = SpreadsheetApp.openById(CFG.sheetId);
  var hoja = ss.getSheetByName(APP_HOJA);
  if (!hoja) {
    hoja = ss.insertSheet(APP_HOJA);
    hoja.getRange(1, 1, 1, APP_HEADERS.length).setValues([APP_HEADERS]);
    hoja.setFrozenRows(1);
  } else if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, APP_HEADERS.length).setValues([APP_HEADERS]);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function sesionYaExiste_(hoja, sesionId) {
  if (hoja.getLastRow() < 2) return false;
  var ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === sesionId) return true;
  }
  return false;
}

// ── LECTURA PARA EL INFORME ───────────────────────────────────────────────────
// Devuelve la MISMA estructura que leerLyfta(): un arreglo de sesiones ordenadas.
// Así el motor (metricasGym, senalesRutina, etc.) no nota la diferencia.
function leerSesionesFuerza_() {
  var ss = SpreadsheetApp.openById(CFG.sheetId);
  var hoja = ss.getSheetByName(APP_HOJA);

  if (hoja && hoja.getLastRow() >= 2) {
    var sesiones = leerHojaEjercicios_(hoja);
    if (sesiones.length) return sesiones;
  }

  // Fallback: aún no hay datos de la app → sigue leyendo el CSV de Lyfta.
  if (typeof leerLyfta === 'function') return leerLyfta(CFG.lyftaFolderId);
  return [];
}

function leerHojaEjercicios_(hoja) {
  var values = hoja.getDataRange().getValues();
  if (!values.length) return [];

  // Localiza los encabezados de forma robusta (misma idea que localizarTabla del motor).
  var H = {};
  values[0].forEach(function (h, i) { H[normApp_(h)] = i; });
  var iId = H['sesion_id'], iFecha = H['fecha'], iTit = H['titulo'], iDur = H['duracion_min'];
  var iEj = H['ejercicio'], iPeso = H['peso'], iReps = H['reps'];
  if (iId === undefined || iEj === undefined) return [];

  var porSesion = {};
  for (var r = 1; r < values.length; r++) {
    var fila = values[r];
    var id = String(fila[iId] == null ? '' : fila[iId]).trim();
    var ej = String(fila[iEj] == null ? '' : fila[iEj]).trim();
    if (!id || !ej) continue;

    var reps = numeroApp_(fila[iReps]) || 0;
    if (reps <= 0) continue; // sets sin reps no aportan (igual que en leerLyfta)

    if (!porSesion[id]) {
      var fecha = fila[iFecha] instanceof Date ? fila[iFecha] : new Date(fila[iFecha]);
      porSesion[id] = {
        fecha: fecha,
        fechaStr: (typeof fechaStr === 'function') ? fechaStr(fecha) : Utilities.formatDate(fecha, 'America/Bogota', 'yyyy-MM-dd'),
        titulo: iTit !== undefined ? String(fila[iTit] || '').trim() : '',
        durMin: iDur !== undefined ? (numeroApp_(fila[iDur]) || 0) : 0,
        sets: [],
      };
    }
    var peso = numeroApp_(fila[iPeso]) || 0;
    porSesion[id].sets.push({ ej: ej, peso: peso, reps: reps, e1rm: peso > 0 ? peso * (1 + reps / 30) : 0 });
  }

  var sesiones = Object.keys(porSesion).map(function (k) { return porSesion[k]; })
    .filter(function (s) { return s.sets.length; });
  sesiones.sort(function (a, b) { return a.fecha.getTime() - b.fecha.getTime(); });
  return sesiones;
}

// ── UTILIDADES LOCALES (con sufijo App_ para no chocar con las del motor) ──────
function normApp_(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, '_'); }

function numeroApp_(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  var n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? null : n;
}

// ── MARCAR EL DÍA EN LA TABLA DIARIA (tu "matriz de seguimiento") ─────────────
// Cuando se guarda una sesión NUEVA, deja registrado el día en la tabla diaria del
// Sheet (la de una fila por día: Fecha, Dia, Pasos, ... Entreno, Tipo, Duracion_min).
// Así el día de gym queda en tu matriz sin doble digitación, igual que lo marcabas a
// mano en la época de Lyfta. Escribe SOLO tres columnas —Entreno, Tipo, Duracion_min—
// y no toca ninguna otra (FC, pasos, sueño, notas). Es idempotente por fecha.
var APP_MARCAR_DIARIO = true;       // pon false para desactivar esta escritura
var APP_TIPO_DIARIO   = 'Gimnasio'; // OJO: debe ser una de CFG.tiposFuerza (pierna/pesas/
                                    // fuerza/gym/gimnasio) o el informe lo contaría como
                                    // cardio y habría doble conteo. El título de la sesión NO sirve.

function marcarDiaEntrenado_(s) {
  if (!APP_MARCAR_DIARIO || !s || !s.fecha) return;

  var t = ubicarTablaDiaria_();
  if (!t) { Logger.log('No se encontró la tabla diaria (Fecha + Pasos).'); return; }

  var hoja = t.sheet, col = t.col;
  var iFecha = col['fecha'];
  if (iFecha === undefined) return;
  var iDia = col['dia'], iEntreno = col['entreno'], iTipo = col['tipo'], iDur = col['duracion_min'];

  var fechaSesion = new Date(s.fecha);
  var claveDia = fechaBogota_(fechaSesion);                 // 'yyyy-MM-dd' en hora Bogotá
  var durMin = numeroApp_(s.durMin != null ? s.durMin : s.duracion_min);

  var headerRow1 = t.headerRow + 1;   // fila 1-based del encabezado
  var firstData1 = t.headerRow + 2;   // fila 1-based de la primera fila de datos
  var lastRow = hoja.getLastRow();
  var ultimaData = headerRow1;        // 1-based: última fila con fecha (si no hay datos, el header)
  var encontrada = 0;

  if (lastRow >= firstData1) {
    var fechas = hoja.getRange(firstData1, iFecha + 1, lastRow - firstData1 + 1, 1).getValues();
    for (var i = 0; i < fechas.length; i++) {
      var celda = fechas[i][0];
      if (celda === '' || celda == null) break;             // la tabla termina en la 1a fila sin fecha
      var fEval = (celda instanceof Date) ? celda : new Date(celda);
      if (isNaN(fEval.getTime())) break;
      ultimaData = firstData1 + i;
      if (fechaBogota_(fEval) === claveDia) { encontrada = firstData1 + i; break; }
    }
  }

  var fila = encontrada || (ultimaData + 1);
  if (!encontrada) {
    // Crea la fila del día justo después de la última con fecha, conservando el orden.
    hoja.insertRowsAfter(ultimaData, 1);
    hoja.getRange(fila, iFecha + 1).setValue(fechaSoloDia_(fechaSesion));
    if (iDia !== undefined) hoja.getRange(fila, iDia + 1).setValue(diaLetra_(fechaSesion));
  }
  if (iEntreno !== undefined) hoja.getRange(fila, iEntreno + 1).setValue(1);
  if (iTipo !== undefined) hoja.getRange(fila, iTipo + 1).setValue(APP_TIPO_DIARIO);
  if (iDur !== undefined && durMin != null) hoja.getRange(fila, iDur + 1).setValue(durMin);
}

// Localiza la tabla diaria: la primera pestaña cuyo encabezado tenga Fecha Y Pasos
// (misma heurística que leerSheet del informe; la pestaña Ejercicios y la de
// composición no la cumplen). Devuelve { sheet, headerRow (0-based), col }.
function ubicarTablaDiaria_() {
  var ss = SpreadsheetApp.openById(CFG.sheetId);
  var sheets = ss.getSheets();
  for (var h = 0; h < sheets.length; h++) {
    var values = sheets[h].getDataRange().getValues();
    for (var r = 0; r < values.length; r++) {
      var col = {};
      values[r].forEach(function (celda, c) { var k = normApp_(celda); if (k) col[k] = c; });
      if (col['fecha'] !== undefined && col['pasos'] !== undefined) {
        return { sheet: sheets[h], headerRow: r, col: col };
      }
    }
  }
  return null;
}

function fechaBogota_(d) { return Utilities.formatDate(d, 'America/Bogota', 'yyyy-MM-dd'); }

// Fecha del día de la sesión, anclada al MEDIODÍA de Bogotá (Colombia es UTC-5 fijo,
// sin horario de verano). Así la celda muestra el día calendario correcto sin importar
// la zona horaria del script ni la del Sheet (medianoche se corría un día al mostrarse).
function fechaSoloDia_(d) {
  return new Date(fechaBogota_(d) + 'T12:00:00-05:00'); // 'yyyy-MM-ddT12:00:00-05:00'
}

// Inicial del día como en la tabla: L M X J V S D.
function diaLetra_(d) {
  var u = Number(Utilities.formatDate(d, 'America/Bogota', 'u')); // 1=Lun .. 7=Dom
  return ['L', 'M', 'X', 'J', 'V', 'S', 'D'][u - 1] || '';
}

// ── PRUEBA MANUAL (Ejecutar → pruebaAppEjercicios) ────────────────────────────
function pruebaAppEjercicios() {
  var sesion = {
    sesion_id: 'PRUEBA-' + new Date().getTime(),
    fecha: new Date().toISOString(),
    titulo: 'Lower A (prueba)',
    durMin: 61,
    sets: [
      { ej: 'Box Jump', grupo: 'Pliometría', tipo: 'pliometria', serie: 1, peso: 0, reps: 5, altura_cm: 40 },
      { ej: 'Sled 45° Leg Press', grupo: 'Piernas', tipo: 'peso_reps', serie: 1, peso: 80, reps: 10 },
      { ej: 'Sled 45° Leg Press', grupo: 'Piernas', tipo: 'peso_reps', serie: 2, peso: 80, reps: 9 },
    ],
  };

  var n = guardarSesion_(sesion);
  Logger.log('Filas escritas: ' + n);

  if (n > 0) {
    marcarDiaEntrenado_(sesion);
    Logger.log('>>> Revisa la tabla diaria: el día ' + fechaBogota_(new Date(sesion.fecha)) +
               ' debe quedar con Entreno=1, Tipo=' + APP_TIPO_DIARIO + ', Duracion_min=' + sesion.durMin + '.');
  }

  var sesiones = leerSesionesFuerza_();
  var ultima = sesiones[sesiones.length - 1];
  Logger.log('Sesiones leídas: ' + sesiones.length);
  Logger.log('Última sesión: ' + JSON.stringify(ultima));
  Logger.log('>>> Revisa que la última tenga titulo, durMin y sets con {ej,peso,reps,e1rm}.');
  Logger.log('>>> Puedes borrar la fila PRUEBA-... de la pestaña Ejercicios cuando termines.');
}
