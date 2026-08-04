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
      if (n > 0) { guardadas++; filas += n; }
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

  var sesiones = leerSesionesFuerza_();
  var ultima = sesiones[sesiones.length - 1];
  Logger.log('Sesiones leídas: ' + sesiones.length);
  Logger.log('Última sesión: ' + JSON.stringify(ultima));
  Logger.log('>>> Revisa que la última tenga titulo, durMin y sets con {ej,peso,reps,e1rm}.');
  Logger.log('>>> Puedes borrar la fila PRUEBA-... de la pestaña Ejercicios cuando termines.');
}
