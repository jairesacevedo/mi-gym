/* app.js — Mi Gym. Registro de sesiones + cola offline + sincronización al Sheet.
 *
 * Mapa del archivo:
 *   1. Estado y utilidades          6. Pantalla inicio
 *   2. Almacenamiento local         7. Sesión en curso (registro)
 *   3. Consultas al historial       8. Historial y detalle
 *   4. Gráficas (SVG inline)        9. Progreso · Resumen · Récords
 *   5. Navegación                  10. Guardar / sincronizar / arranque
 */
(function () {
  'use strict';

  var CFG = window.MIGYM_CONFIG || { EXEC_URL: '', APP_SECRETO: '' };
  var CAT = window.MIGYM_CATALOGO || { sesiones: [], extras: [] };
  var ILUS = window.MIGYM_ILUSTRACIONES || { svgDe: function () { return ''; } };

  var COLA_KEY = 'migym_cola_v1';        // sesiones guardadas pendientes de subir
  var BORRADOR_KEY = 'migym_borrador_v1'; // sesión en curso (por si cierras la app)
  var HIST_KEY = 'migym_historial_v1';   // historial local de sesiones (subidas o no)
  var PREFS_KEY = 'migym_prefs_v1';      // preferencias (RPE, notas)
  var HIST_MAX = 300;                    // tope de sesiones guardadas en el celular
  var SECRETO_KEY = 'migym_secreto_v1';  // clave de sincronización, solo en este celular

  // ── 1. Estado y utilidades ──────────────────────────────────────────────────
  // sesion = { sesion_id, inicio, titulo, ejercicios:[{nombre,grupo,tipo,guia,nota,
  //            series:[{peso,reps,altura_cm,segundos,rpe,hecha}]}] }
  var sesion = null;
  var cronoSesionInt = null;
  var descansoInt = null;
  var prefs = { rpe: false, notas: false };
  var piesEjercicio = [];   // [{ej, nodo}] para refrescar el pie de cada tarjeta al teclear
  var progMetricaId = null; // métrica elegida en la pantalla de progreso
  var resMetricaId = 'volumen';
  var recGrupo = 'Todos';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function mostrar(id) { $(id).classList.remove('oculto'); }
  function ocultar(id) { $(id).classList.add('oculto'); }
  function vaciar(id) { $(id).innerHTML = ''; }

  function aviso(msg, esError) {
    var a = $('aviso');
    a.textContent = msg;
    a.className = 'aviso' + (esError ? ' error' : '');
    setTimeout(function () { a.classList.add('oculto'); }, 2600);
  }

  function fmtTiempo(seg) {
    seg = Math.max(0, Math.round(seg));
    var m = Math.floor(seg / 60), s = seg % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function num(v) {
    if (v == null || v === '') return null;
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  function redondear(v) { return Math.round(v * 10) / 10; }

  // Miles con punto para que 12450 kg se lea de un golpe.
  function miles(v) {
    var n = Math.round(v);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function fmtFecha(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }) +
        ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(iso); }
  }

  function fmtFechaCorta(iso) {
    try { return new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }); }
    catch (e) { return ''; }
  }

  function fmtDiaMes(d) {
    try { return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }); }
    catch (e) { return ''; }
  }

  function fmtRango(ini, fin) {
    var o = { day: 'numeric', month: 'short' };
    try { return ini.toLocaleDateString('es-CO', o) + ' – ' + fin.toLocaleDateString('es-CO', o); }
    catch (e) { return ''; }
  }

  function diasDesde(iso) {
    var ms = Date.now() - new Date(iso).getTime();
    return Math.floor(ms / 864e5);
  }

  function haceTexto(iso) {
    var d = diasDesde(iso);
    if (d <= 0) return 'hoy';
    if (d === 1) return 'ayer';
    if (d < 7) return 'hace ' + d + ' días';
    var s = Math.round(d / 7);
    return 'hace ' + s + (s === 1 ? ' semana' : ' semanas');
  }

  // Slug del grupo para elegir su color (Tirón → tiron, Pliometría → pliometria).
  function slugGrupo(g) {
    var s = String(g == null ? '' : g).toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.replace(/[^a-z]/g, '');
    return ['piernas', 'empuje', 'tiron', 'pliometria', 'core'].indexOf(s) >= 0 ? s : 'otros';
  }

  function ilustracion(ej, cls) {
    var caja = el('div', 'ej-ilus' + (cls ? ' ' + cls : ''));
    if (ej.img) {
      var img = el('img');
      img.src = ej.img; img.alt = ''; img.loading = 'lazy';
      caja.appendChild(img);
    } else {
      caja.innerHTML = ILUS.svgDe(ej.nombre || ej.ej, ej.grupo);
    }
    return caja;
  }

  // ── 2. Almacenamiento local ─────────────────────────────────────────────────
  function leerCola() { try { return JSON.parse(localStorage.getItem(COLA_KEY)) || []; } catch (e) { return []; } }
  function escribirCola(c) { localStorage.setItem(COLA_KEY, JSON.stringify(c)); }

  // El historial se consulta muchísimo al pintar (cada tarjeta mira su propia historia),
  // así que se parsea una vez y se guarda en memoria hasta que algo lo cambie.
  var histCache = null, ascCache = null;
  function leerHistorial() {
    if (histCache) return histCache;
    try { histCache = JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch (e) { histCache = []; }
    return histCache;
  }
  function escribirHistorial(h) {
    histCache = h; ascCache = null;
    localStorage.setItem(HIST_KEY, JSON.stringify(h));
  }
  function guardarBorrador() { if (sesion) localStorage.setItem(BORRADOR_KEY, JSON.stringify(sesion)); }

  function leerPrefs() {
    try { var p = JSON.parse(localStorage.getItem(PREFS_KEY)); if (p) { prefs.rpe = !!p.rpe; prefs.notas = !!p.notas; } }
    catch (e) {}
  }
  function guardarPrefs() { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }

  // La clave sale de config.js si está (compatibilidad) o del almacén local del celular.
  function obtenerSecreto() { return CFG.APP_SECRETO || localStorage.getItem(SECRETO_KEY) || ''; }
  function secretoParaSubir() {
    var s = obtenerSecreto();
    if (s) return s;
    s = (window.prompt('Clave de sincronización (te la piden una sola vez y queda guardada en este celular):') || '').trim();
    if (s) localStorage.setItem(SECRETO_KEY, s);
    return s;
  }

  // Marca en el historial las sesiones que acaban de subir bien (por sesion_id).
  function marcarSubidas(cola) {
    var ids = {}; cola.forEach(function (p) { ids[p.sesion_id] = true; });
    var hist = leerHistorial();
    hist.forEach(function (h) { if (ids[h.payload.sesion_id]) h.subida = true; });
    escribirHistorial(hist);
  }

  // ── 3. Consultas al historial ───────────────────────────────────────────────
  // El historial se guarda de más nuevo a más viejo; varias cuentas necesitan el
  // orden cronológico (para saber cuándo una marca fue récord), así que va aparte.
  function historialAsc() {
    if (ascCache) return ascCache;
    ascCache = leerHistorial().slice().sort(function (a, b) {
      return new Date(a.payload.fecha) - new Date(b.payload.fecha);
    });
    return ascCache;
  }

  function agruparPorEjercicio(sets) {
    var orden = [], map = {};
    sets.forEach(function (s) {
      if (!map[s.ej]) { map[s.ej] = { ej: s.ej, grupo: s.grupo, sets: [] }; orden.push(map[s.ej]); }
      map[s.ej].sets.push(s);
    });
    return orden;
  }

  function textoSet(s) {
    if (s.tipo === 'tiempo' || (s.segundos != null && s.segundos !== '')) return (s.segundos || s.reps) + ' s';
    if (s.tipo === 'pliometria') return s.reps + ' reps' + (s.altura_cm ? ' · ' + s.altura_cm + ' cm' : '');
    if (s.peso && s.peso > 0) return s.peso + ' kg × ' + s.reps;
    return s.reps + ' reps';
  }

  function volumenSets(sets) {
    var v = 0;
    sets.forEach(function (s) { v += (num(s.peso) || 0) * (num(s.reps) || 0); });
    return v;
  }

  function statsSesion(p) {
    var ejs = {}, vol = volumenSets(p.sets);
    p.sets.forEach(function (s) { ejs[s.ej] = true; });
    var partes = [Object.keys(ejs).length + ' ej', p.sets.length + ' series'];
    if (vol > 0) partes.push(miles(vol) + ' kg');
    return partes.join(' · ');
  }

  // Resume un ejercicio a lo largo de todo el historial: última vez (con TODAS sus
  // series, no solo la tope), mejores marcas de siempre y acumulados.
  function statsEjercicio(nombre) {
    var st = {
      nombre: nombre, tipo: null, grupo: '', ultima: null, ultimaSets: null, ultimaFecha: null,
      mejorPeso: 0, mejorReps: 0, mejorAltura: 0, mejorSeg: 0, mejorE1rm: 0, fechaMejor: null,
      nSesiones: 0, nSeries: 0, volumen: 0,
    };
    historialAsc().forEach(function (h) {
      var sets = h.payload.sets.filter(function (s) { return s.ej === nombre; });
      if (!sets.length) return;
      if (!st.tipo) { st.tipo = sets[0].tipo; st.grupo = sets[0].grupo || ''; }
      st.nSesiones++;
      st.nSeries += sets.length;
      st.volumen += volumenSets(sets);
      sets = sets.slice().sort(function (a, b) { return (a.serie || 0) - (b.serie || 0); });
      st.ultimaSets = sets;
      st.ultimaFecha = h.payload.fecha;
      st.ultima = { fecha: h.payload.fecha, top: topSet_(sets, st.tipo) };
      sets.forEach(function (s) {
        var p = num(s.peso) || 0, r = num(s.reps) || 0, a = num(s.altura_cm) || 0, g = num(s.segundos) || 0;
        var mejoro = false;
        if (p > st.mejorPeso) { st.mejorPeso = p; mejoro = true; }
        if (r > st.mejorReps) { st.mejorReps = r; mejoro = mejoro || st.tipo !== 'peso_reps'; }
        if (a > st.mejorAltura) { st.mejorAltura = a; mejoro = true; }
        if (g > st.mejorSeg) { st.mejorSeg = g; mejoro = true; }
        if (p > 0 && r > 0) { var e = p * (1 + r / 30); if (e > st.mejorE1rm) { st.mejorE1rm = e; mejoro = true; } }
        if (mejoro) st.fechaMejor = h.payload.fecha;
      });
    });
    st.mejorE1rm = redondear(st.mejorE1rm);
    return st;
  }

  function topSet_(sets, tipo) {
    if (tipo === 'tiempo') return sets.reduce(function (b, s) { return (num(s.segundos) || 0) > (num(b.segundos) || 0) ? s : b; });
    if (tipo === 'reps') return sets.reduce(function (b, s) { return (num(s.reps) || 0) > (num(b.reps) || 0) ? s : b; });
    if (tipo === 'pliometria') return sets.reduce(function (b, s) { return (num(s.altura_cm) || 0) > (num(b.altura_cm) || 0) ? s : b; });
    return sets.reduce(function (b, s) {
      var bp = num(b.peso) || 0, sp = num(s.peso) || 0;
      if (sp > bp) return s;
      if (sp === bp && (num(s.reps) || 0) > (num(b.reps) || 0)) return s;
      return b;
    });
  }

  // La sesión más reciente en la que hiciste ese ejercicio, con todas sus series.
  function sesionPreviaDe(nombre, excluirId) {
    var hist = leerHistorial();
    for (var i = 0; i < hist.length; i++) {
      var p = hist[i].payload;
      if (excluirId && p.sesion_id === excluirId) continue;
      var sets = p.sets.filter(function (s) { return s.ej === nombre; });
      if (sets.length) {
        sets.sort(function (a, b) { return (a.serie || 0) - (b.serie || 0); });
        return { fecha: p.fecha, titulo: p.titulo, sets: sets };
      }
    }
    return null;
  }

  function ejerciciosDeHistorial() {
    var vistos = {}, out = [];
    leerHistorial().forEach(function (h) {
      h.payload.sets.forEach(function (s) {
        if (!vistos[s.ej]) { vistos[s.ej] = 1; out.push({ nombre: s.ej, grupo: s.grupo || 'Otros', tipo: s.tipo }); }
      });
    });
    out.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
    return out;
  }

  function buscarEnCatalogo(nombre) {
    var todos = todosLosEjercicios();
    for (var i = 0; i < todos.length; i++) if (todos[i].nombre === nombre) return todos[i];
    return null;
  }

  // Lunes 00:00 local de la semana que contiene d.
  function inicioSemana(d) {
    var x = new Date(d); var lun = (x.getDay() + 6) % 7; // 0 = lunes
    x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - lun); return x;
  }

  function agregarSemana(desde, hasta) {
    var agg = { nSesiones: 0, nSeries: 0, volumen: 0, tiempoMin: 0, grupos: {}, reps: 0 };
    leerHistorial().forEach(function (h) {
      var f = new Date(h.payload.fecha);
      if (f < desde || f >= hasta) return;
      agg.nSesiones++;
      agg.tiempoMin += h.payload.durMin || 0;
      h.payload.sets.forEach(function (s) {
        agg.nSeries++;
        agg.reps += num(s.reps) || 0;
        agg.volumen += (num(s.peso) || 0) * (num(s.reps) || 0);
        var g = s.grupo || 'Otros';
        agg.grupos[g] = (agg.grupos[g] || 0) + 1;
      });
    });
    agg.volumen = Math.round(agg.volumen);
    return agg;
  }

  // Las últimas n semanas (la actual al final), ya agregadas.
  function ultimasSemanas(n) {
    var out = [], ini = inicioSemana(new Date());
    for (var i = n - 1; i >= 0; i--) {
      var desde = new Date(ini.getTime() - i * 7 * 864e5);
      var hasta = new Date(desde.getTime() + 7 * 864e5);
      out.push({ desde: desde, hasta: hasta, etq: fmtDiaMes(desde), agg: agregarSemana(desde, hasta) });
    }
    return out;
  }

  // Semanas seguidas entrenando (cuenta hacia atrás; la semana en curso solo suma si ya entrenaste).
  function rachaSemanas() {
    var ini = inicioSemana(new Date()), racha = 0, i = 0;
    for (;;) {
      var desde = new Date(ini.getTime() - i * 7 * 864e5);
      var hasta = new Date(desde.getTime() + 7 * 864e5);
      var n = agregarSemana(desde, hasta).nSesiones;
      if (n > 0) racha++;
      else if (i > 0) break;       // una semana vacía corta la racha…
      else if (i === 0) { i++; continue; } // …salvo la actual, que quizá aún no empiezas
      i++;
      if (i > 104) break;
    }
    return racha;
  }

  // Récords conseguidos dentro de un rango: recorre el historial en orden y marca
  // cada vez que una serie superó lo mejor que había hasta ese momento.
  function prsEnRango(desde, hasta) {
    var mejor = {}, out = [];
    historialAsc().forEach(function (h) {
      var f = new Date(h.payload.fecha);
      var porEj = {};
      h.payload.sets.forEach(function (s) { (porEj[s.ej] = porEj[s.ej] || []).push(s); });
      Object.keys(porEj).forEach(function (nombre) {
        var sets = porEj[nombre], tipo = sets[0].tipo;
        var m = mejor[nombre] || (mejor[nombre] = { peso: 0, e1rm: 0, reps: 0, altura: 0, seg: 0, visto: false });
        var antes = { peso: m.peso, e1rm: m.e1rm, reps: m.reps, altura: m.altura, seg: m.seg, visto: m.visto };
        sets.forEach(function (s) {
          var p = num(s.peso) || 0, r = num(s.reps) || 0, a = num(s.altura_cm) || 0, g = num(s.segundos) || 0;
          if (p > m.peso) m.peso = p;
          if (r > m.reps) m.reps = r;
          if (a > m.altura) m.altura = a;
          if (g > m.seg) m.seg = g;
          if (p > 0 && r > 0) { var e = p * (1 + r / 30); if (e > m.e1rm) m.e1rm = e; }
        });
        m.visto = true;
        if (!antes.visto) return;             // la primera vez que lo haces no es récord
        if (f < desde || f >= hasta) return;
        var txt = null;
        if (tipo === 'peso_reps') {
          if (m.peso > antes.peso) txt = m.peso + ' kg';
          else if (m.e1rm > antes.e1rm) txt = 'e1RM ' + redondear(m.e1rm) + ' kg';
        } else if (tipo === 'pliometria') {
          if (m.altura > antes.altura) txt = m.altura + ' cm';
          else if (m.reps > antes.reps) txt = m.reps + ' reps';
        } else if (tipo === 'tiempo') {
          if (m.seg > antes.seg) txt = m.seg + ' s';
        } else if (m.reps > antes.reps) txt = m.reps + ' reps';
        if (txt) out.push({ ej: nombre, grupo: sets[0].grupo || 'Otros', texto: txt, fecha: h.payload.fecha });
      });
    });
    return out;
  }

  // Métricas disponibles según el tipo de ejercicio (la primera es la de por defecto).
  function metricasDe(tipo) {
    function maxDe(sets, campo) {
      return sets.reduce(function (m, s) { return Math.max(m, num(s[campo]) || 0); }, 0);
    }
    function sumDe(sets, campo) {
      return sets.reduce(function (m, s) { return m + (num(s[campo]) || 0); }, 0);
    }
    if (tipo === 'tiempo') return [
      { id: 'segmax', etq: 'Mejor', unidad: 's', calc: function (ss) { return maxDe(ss, 'segundos') || maxDe(ss, 'reps'); } },
      { id: 'segtot', etq: 'Total', unidad: 's', calc: function (ss) { return sumDe(ss, 'segundos'); } },
      { id: 'series', etq: 'Series', unidad: '', calc: function (ss) { return ss.length; } },
    ];
    if (tipo === 'pliometria') return [
      { id: 'altura', etq: 'Altura', unidad: 'cm', calc: function (ss) { return maxDe(ss, 'altura_cm'); } },
      { id: 'repsmax', etq: 'Reps máx', unidad: 'reps', calc: function (ss) { return maxDe(ss, 'reps'); } },
      { id: 'repstot', etq: 'Reps total', unidad: 'reps', calc: function (ss) { return sumDe(ss, 'reps'); } },
      { id: 'series', etq: 'Series', unidad: '', calc: function (ss) { return ss.length; } },
    ];
    if (tipo === 'reps') return [
      { id: 'repsmax', etq: 'Reps máx', unidad: 'reps', calc: function (ss) { return maxDe(ss, 'reps'); } },
      { id: 'repstot', etq: 'Reps total', unidad: 'reps', calc: function (ss) { return sumDe(ss, 'reps'); } },
      { id: 'series', etq: 'Series', unidad: '', calc: function (ss) { return ss.length; } },
    ];
    return [ // peso_reps
      { id: 'e1rm', etq: 'e1RM', unidad: 'kg', calc: function (ss) {
        return redondear(ss.reduce(function (m, s) {
          var p = num(s.peso) || 0, r = num(s.reps) || 0;
          return Math.max(m, p > 0 && r > 0 ? p * (1 + r / 30) : 0);
        }, 0));
      } },
      { id: 'pesomax', etq: 'Peso máx', unidad: 'kg', calc: function (ss) { return maxDe(ss, 'peso'); } },
      { id: 'volumen', etq: 'Volumen', unidad: 'kg', calc: function (ss) { return Math.round(volumenSets(ss)); } },
      { id: 'repstot', etq: 'Reps', unidad: 'reps', calc: function (ss) { return sumDe(ss, 'reps'); } },
    ];
  }

  // Una marca por sesión para el ejercicio y la métrica elegidos.
  function serieDeMetrica(nombre, metrica) {
    var pts = [];
    historialAsc().forEach(function (h) {
      var sets = h.payload.sets.filter(function (s) { return s.ej === nombre; });
      if (!sets.length) return;
      pts.push({ fecha: h.payload.fecha, valor: metrica.calc(sets), sets: sets, titulo: h.payload.titulo });
    });
    return pts;
  }

  // ── 4. Gráficas (SVG inline, sin librerías; los colores salen del CSS) ───────
  // Convenciones: trazos finos, rejilla discreta, etiquetas directas solo en los
  // puntos que importan (último y mejor) y tabla de apoyo debajo de cada gráfica.
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function fmtVal(v, unidad) {
    var t = Math.abs(v) >= 1000 ? miles(v) : String(redondear(v));
    return unidad ? t + ' ' + unidad : t;
  }

  function svgLinea(pts, unidad) {
    var W = 320, H = 178, pl = 42, pr = 14, pt = 20, pb = 26;
    var vals = pts.map(function (p) { return p.valor; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var holgura = (max - min) || Math.max(1, Math.abs(max) * 0.1);
    var lo = min - holgura * 0.3, hi = max + holgura * 0.3;
    if (lo === hi) { lo -= 1; hi += 1; }
    var iw = W - pl - pr, ih = H - pt - pb;
    function X(i) { return pts.length <= 1 ? pl + iw / 2 : pl + iw * i / (pts.length - 1); }
    function Y(v) { return pt + ih * (1 - (v - lo) / (hi - lo)); }

    var rejilla = '', niveles = [max, (max + min) / 2, min];
    niveles.forEach(function (v, k) {
      if (k === 1 && max === min) return;
      var y = Y(v).toFixed(1);
      rejilla += '<line class="grid" x1="' + pl + '" y1="' + y + '" x2="' + (W - pr) + '" y2="' + y + '"/>'
        + '<text class="lbl" x="' + (pl - 6) + '" y="' + (+y + 3.5).toFixed(1) + '" text-anchor="end">' + esc(redondear(v)) + '</text>';
    });

    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.valor).toFixed(1); }).join(' ');
    var area = pts.length > 1
      ? '<path class="area" d="' + d + ' L' + X(pts.length - 1).toFixed(1) + ' ' + (pt + ih) + ' L' + X(0).toFixed(1) + ' ' + (pt + ih) + ' Z"/>'
      : '';

    var iMax = 0;
    pts.forEach(function (p, i) { if (p.valor > pts[iMax].valor) iMax = i; });
    var puntos = pts.map(function (p, i) {
      var ult = i === pts.length - 1;
      return '<circle class="pt' + (ult ? ' ult' : '') + '" cx="' + X(i).toFixed(1) + '" cy="' + Y(p.valor).toFixed(1) + '" r="' + (ult ? 5 : 4) + '"'
        + ' data-detalle="' + esc(fmtFechaCorta(p.fecha) + ' · ' + fmtVal(p.valor, unidad)) + '">'
        + '<title>' + esc(fmtFechaCorta(p.fecha) + ': ' + fmtVal(p.valor, unidad)) + '</title></circle>';
    }).join('');

    // Etiquetas directas: solo el último punto y, si es otro, el mejor.
    var etiquetas = '<text class="val" x="' + X(pts.length - 1).toFixed(1) + '" y="' + (Y(pts[pts.length - 1].valor) - 10).toFixed(1) + '" text-anchor="end">'
      + esc(fmtVal(pts[pts.length - 1].valor, unidad)) + '</text>';
    if (iMax !== pts.length - 1) {
      etiquetas += '<text class="val tenue" x="' + X(iMax).toFixed(1) + '" y="' + (Y(pts[iMax].valor) - 10).toFixed(1) + '" text-anchor="middle">'
        + esc(fmtVal(pts[iMax].valor, '')) + '</text>';
    }

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Progresión en ' + esc(unidad || 'la métrica elegida') + '">'
      + rejilla + area + (pts.length > 1 ? '<path class="linea" d="' + d + '"/>' : '') + puntos + etiquetas
      + '<text class="lbl" x="' + pl + '" y="' + (H - 7) + '" text-anchor="start">' + esc(fmtDiaMes(pts[0].fecha)) + '</text>'
      + '<text class="lbl" x="' + (W - pr) + '" y="' + (H - 7) + '" text-anchor="end">' + esc(fmtDiaMes(pts[pts.length - 1].fecha)) + '</text>'
      + '</svg>';
  }

  // items: [{etq, valor, destacado}]
  function svgBarras(items, unidad) {
    var W = 320, H = 156, pl = 40, pr = 10, pt = 22, pb = 26;
    var max = items.reduce(function (m, i) { return Math.max(m, i.valor); }, 0) || 1;
    var iw = W - pl - pr, ih = H - pt - pb;
    var paso = iw / items.length;
    var bw = Math.max(8, Math.min(30, paso - 6)); // el hueco deja respirar las barras
    var base = pt + ih;

    var rejilla = '';
    [max, max / 2].forEach(function (v) {
      var y = (base - ih * (v / max)).toFixed(1);
      rejilla += '<line class="grid" x1="' + pl + '" y1="' + y + '" x2="' + (W - pr) + '" y2="' + y + '"/>'
        + '<text class="lbl" x="' + (pl - 6) + '" y="' + (+y + 3.5).toFixed(1) + '" text-anchor="end">' + esc(max >= 1000 ? Math.round(v / 100) / 10 + 'k' : redondear(v)) + '</text>';
    });

    var barras = items.map(function (it, i) {
      var h = it.valor > 0 ? Math.max(2, ih * (it.valor / max)) : 0;
      var x = pl + paso * i + (paso - bw) / 2, y = base - h;
      var r = Math.min(4, bw / 2, h);
      var d = h > 0
        ? 'M' + x.toFixed(1) + ' ' + base + ' L' + x.toFixed(1) + ' ' + (y + r).toFixed(1)
          + ' Q' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x + r).toFixed(1) + ' ' + y.toFixed(1)
          + ' L' + (x + bw - r).toFixed(1) + ' ' + y.toFixed(1)
          + ' Q' + (x + bw).toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x + bw).toFixed(1) + ' ' + (y + r).toFixed(1)
          + ' L' + (x + bw).toFixed(1) + ' ' + base + ' Z'
        : '';
      var vacio = h === 0 ? '<line class="cero" x1="' + x.toFixed(1) + '" y1="' + base + '" x2="' + (x + bw).toFixed(1) + '" y2="' + base + '"/>' : '';
      return '<g data-detalle="' + esc(it.etq + ' · ' + fmtVal(it.valor, unidad)) + '">'
        + '<rect class="zona" x="' + (pl + paso * i).toFixed(1) + '" y="' + pt + '" width="' + paso.toFixed(1) + '" height="' + ih + '"/>'
        + (d ? '<path class="barra' + (it.destacado ? ' act' : '') + '" d="' + d + '"/>' : vacio)
        + '<title>' + esc(it.etq + ': ' + fmtVal(it.valor, unidad)) + '</title></g>';
    }).join('');

    // Etiqueta directa solo en la barra destacada (normalmente la semana en curso).
    var etiqueta = '';
    items.forEach(function (it, i) {
      if (!it.destacado || !it.valor) return;
      var h = Math.max(2, ih * (it.valor / max));
      etiqueta = '<text class="val" x="' + (pl + paso * i + paso / 2).toFixed(1) + '" y="' + (base - h - 8).toFixed(1) + '" text-anchor="middle">'
        + esc(fmtVal(it.valor, '')) + '</text>';
    });

    // Con muchas barras se etiqueta una sí y una no, contando desde la última.
    var ejeX = items.map(function (it, i) {
      if (items.length > 5 && (items.length - 1 - i) % 2 !== 0) return '';
      return '<text class="lbl" x="' + (pl + paso * i + paso / 2).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(it.etq) + '</text>';
    }).join('');

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Comparativa por periodo">'
      + rejilla + barras + etiqueta + ejeX + '</svg>';
  }

  // Mini barras para el panel de inicio (sin ejes; el dato exacto va en el pie).
  function svgSpark(items) {
    var W = 300, H = 46, max = items.reduce(function (m, i) { return Math.max(m, i.valor); }, 0) || 1;
    var paso = W / items.length, bw = Math.max(6, paso - 5);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Volumen de las últimas semanas">'
      + items.map(function (it, i) {
        var h = it.valor > 0 ? Math.max(2, (H - 4) * (it.valor / max)) : 1.5;
        var x = paso * i + (paso - bw) / 2;
        return '<rect class="barra' + (it.destacado ? ' act' : '') + '" x="' + x.toFixed(1) + '" y="' + (H - h).toFixed(1)
          + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"><title>' + esc(it.etq + ': ' + miles(it.valor) + ' kg') + '</title></rect>';
      }).join('') + '</svg>';
  }

  // Inserta una gráfica y deja que al tocarla se lea el valor exacto abajo.
  function pintarChart(cont, svgStr, pieDefecto) {
    if (cont._migym) cont.removeEventListener('click', cont._migym); // no apilar oyentes al repintar
    cont.innerHTML = svgStr + '<small class="chart-pie">' + esc(pieDefecto || '') + '</small>';
    var pie = cont.querySelector('.chart-pie');
    cont._migym = function (ev) {
      var n = ev.target;
      while (n && n !== cont && !(n.getAttribute && n.getAttribute('data-detalle'))) n = n.parentNode;
      if (n && n !== cont) pie.textContent = n.getAttribute('data-detalle');
    };
    cont.addEventListener('click', cont._migym);
  }

  // Barra horizontal comparando esta semana con la anterior, con el nombre siempre
  // visible: el color identifica el grupo, nunca lo sustituye.
  function filaGrupo(nombre, actual, previo, max) {
    var fila = el('div', 'grupo-fila g-' + slugGrupo(nombre));
    var cab = el('div', 'grupo-cab');
    cab.appendChild(el('span', 'grupo-nom', nombre));
    cab.appendChild(el('span', 'grupo-val', actual + ' series'));
    cab.appendChild(deltaChip(actual, previo, ''));
    fila.appendChild(cab);

    var pista = el('div', 'grupo-pista');
    // Un grupo en cero no pinta barra: un muñón de color se leería como algo hecho.
    var b1 = el('div', 'grupo-barra act');
    b1.style.width = anchoBarra(actual, max);
    var b2 = el('div', 'grupo-barra ant');
    b2.style.width = anchoBarra(previo, max);
    pista.appendChild(b1); pista.appendChild(b2);
    fila.appendChild(pista);
    fila.appendChild(el('small', 'grupo-pie', 'semana anterior: ' + previo));
    return fila;
  }

  function anchoBarra(valor, max) { return (valor > 0 && max ? Math.max(3, valor / max * 100) : 0) + '%'; }

  // Reparto de series por grupo en una sesión: segmentos etiquetados + leyenda.
  function barraDistribucion(grupos) {
    var total = 0;
    Object.keys(grupos).forEach(function (g) { total += grupos[g]; });
    if (!total) return null;
    var caja = el('div', 'dist');
    var barra = el('div', 'dist-barra');
    var leyenda = el('div', 'dist-leyenda');
    Object.keys(grupos).sort(function (a, b) { return grupos[b] - grupos[a]; }).forEach(function (g) {
      var seg = el('div', 'dist-seg g-' + slugGrupo(g));
      seg.style.width = (grupos[g] / total * 100) + '%';
      seg.title = g + ': ' + grupos[g] + ' series';
      barra.appendChild(seg);
      var it = el('span', 'dist-item g-' + slugGrupo(g));
      it.appendChild(el('i', 'punto'));
      it.appendChild(el('span', null, g + ' ' + grupos[g]));
      leyenda.appendChild(it);
    });
    caja.appendChild(barra); caja.appendChild(leyenda);
    return caja;
  }

  function deltaChip(actual, previo, unidad) {
    var dif = redondear(actual - previo);
    var cls = dif > 0 ? 'sube' : dif < 0 ? 'baja' : '';
    var flecha = dif > 0 ? '▲' : dif < 0 ? '▼' : '●';
    var val = dif > 0 ? '+' + miles(dif) : dif < 0 ? '−' + miles(Math.abs(dif)) : '0';
    var pct = previo ? ' (' + (dif >= 0 ? '+' : '−') + Math.abs(Math.round((actual - previo) / previo * 100)) + '%)' : '';
    var txt = (dif === 0) ? '● igual' : flecha + ' ' + val + (unidad ? ' ' + unidad : '') + pct;
    return el('span', 'res-delta ' + cls, txt);
  }

  function tile(label, valor, extra, cls) {
    var c = el('div', 'tile' + (cls ? ' ' + cls : ''));
    c.appendChild(el('span', 'tile-label', label));
    c.appendChild(el('span', 'tile-num', valor));
    if (extra) c.appendChild(el('span', 'tile-extra', extra));
    return c;
  }

  // ── 5. Navegación ───────────────────────────────────────────────────────────
  var PANTALLAS = ['inicio', 'sesion', 'historial', 'detalle', 'progreso', 'resumen', 'records'];
  function irA(nombre) {
    PANTALLAS.forEach(function (p) { $('pantalla-' + p).classList.toggle('oculto', p !== nombre); });
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  // ── 6. Pantalla inicio ──────────────────────────────────────────────────────
  function pintarInicio() {
    irA('inicio');
    pintarPanelInicio();

    var sugerida = sesionSugerida();
    var cont = $('lista-sesiones');
    cont.innerHTML = '';
    CAT.sesiones.forEach(function (s) {
      var card = el('button', 'tarjeta');
      var cab = el('div', 'hist-cab');
      cab.appendChild(el('span', null, s.nombre));
      if (s.nombre === sugerida) cab.appendChild(el('span', 'chip sug', 'sugerida'));
      card.appendChild(cab);
      if (s.ejercicios.length) {
        card.appendChild(el('small', null,
          s.ejercicios.length + ' ejercicios · ' + s.ejercicios.map(function (e) { return e.nombre; }).slice(0, 2).join(' · ') + '…'));
        var tira = el('div', 'tira-ilus');
        s.ejercicios.slice(0, 5).forEach(function (e) { tira.appendChild(ilustracion(e, 'mini')); });
        card.appendChild(tira);
      } else {
        card.appendChild(el('small', null, 'Elige los ejercicios a mano'));
      }
      card.addEventListener('click', function () { iniciarSesion(s); });
      cont.appendChild(card);
    });
    actualizarPendientes();
  }

  function pintarPanelInicio() {
    var sem = ultimasSemanas(8);
    var esta = sem[sem.length - 1].agg;
    var total = leerHistorial().length;
    if (!total) { $('inicio-panel').classList.add('oculto'); return; }
    $('inicio-panel').classList.remove('oculto');

    var tiles = $('inicio-tiles'); tiles.innerHTML = '';
    tiles.appendChild(tile('Sesiones', String(esta.nSesiones), 'esta semana'));
    tiles.appendChild(tile('Volumen', miles(esta.volumen), 'kg esta semana'));
    tiles.appendChild(tile('Series', String(esta.nSeries), 'esta semana'));
    tiles.appendChild(tile('Racha', String(rachaSemanas()), 'semanas seguidas'));

    var items = sem.map(function (s, i) { return { etq: s.etq, valor: s.agg.volumen, destacado: i === sem.length - 1 }; });
    $('inicio-spark').innerHTML = svgSpark(items);
    var ultima = leerHistorial()[0];
    $('inicio-spark-pie').textContent = 'Volumen por semana (8 sem)' +
      (ultima ? ' · última sesión ' + haceTexto(ultima.payload.fecha) : '');
  }

  // Siguiente sesión de la rotación después de la última que registraste.
  function sesionSugerida() {
    var conPlan = CAT.sesiones.filter(function (s) { return s.ejercicios.length; });
    if (!conPlan.length) return null;
    var hist = leerHistorial();
    for (var i = 0; i < hist.length; i++) {
      for (var j = 0; j < conPlan.length; j++) {
        if (conPlan[j].nombre === hist[i].payload.titulo) return conPlan[(j + 1) % conPlan.length].nombre;
      }
    }
    return conPlan[0].nombre;
  }

  function actualizarPendientes() {
    var cola = leerCola();
    var btn = $('btn-pendientes');
    if (cola.length) {
      btn.textContent = 'Subir ' + cola.length + ' sesión(es) pendiente(s)';
      btn.classList.remove('oculto');
    } else {
      btn.classList.add('oculto');
    }
  }

  // ── 7. Sesión en curso ──────────────────────────────────────────────────────
  var INC_KG = 2.5; // subida por defecto cuando llegas al tope del rango

  function iniciarSesion(plantilla) {
    sesion = {
      sesion_id: nuevoId(),
      inicio: Date.now(),
      titulo: plantilla.nombre,
      ejercicios: plantilla.ejercicios.map(clonarEjercicio),
    };
    guardarBorrador();
    abrirSesion();
  }

  function clonarEjercicio(e) {
    var ej = {
      nombre: e.nombre, grupo: e.grupo, tipo: e.tipo, reps: e.reps || '', img: e.img || '',
      guia: (e.series || '') + ' × ' + (e.reps || '') + '  ·  descanso ' + fmtTiempo(e.descanso || 90),
      descanso: e.descanso || 90, nuevo: !!e.nuevo, nota: '', series: [],
    };
    var n = e.series || 1;
    for (var i = 0; i < n; i++) ej.series.push(nuevaSerie());
    return ej;
  }

  function nuevaSerie() { return { peso: '', reps: '', altura_cm: '', segundos: '', rpe: '', hecha: false }; }
  function nuevoId() { return new Date().toISOString(); }

  function abrirSesion() {
    irA('sesion');
    $('titulo-sesion').textContent = sesion.titulo;
    $('chip-rpe').classList.toggle('on', prefs.rpe);
    $('chip-notas').classList.toggle('on', prefs.notas);
    pintarEjercicios();
    arrancarCronoSesion();
  }

  function arrancarCronoSesion() {
    clearInterval(cronoSesionInt);
    cronoSesionInt = setInterval(function () {
      $('crono-sesion').textContent = 'sesión ' + fmtTiempo((Date.now() - sesion.inicio) / 1000);
    }, 1000);
  }

  function pintarEjercicios() {
    var cont = $('lista-ejercicios');
    cont.innerHTML = '';
    piesEjercicio = [];
    sesion.ejercicios.forEach(function (ej, idx) { cont.appendChild(tarjetaEjercicio(ej, idx)); });
    actualizarStatsSesion();
  }

  function tarjetaEjercicio(ej, idx) {
    var caja = el('div', 'ejercicio');

    var cab = el('div', 'ejercicio-cab');
    cab.appendChild(ilustracion(ej));
    var tit = el('div', 'ej-tit');
    tit.appendChild(el('h3', null, ej.nombre));
    tit.appendChild(el('span', 'guia', ej.guia));
    cab.appendChild(tit);
    var lado = el('div', 'ej-lado');
    lado.appendChild(el('span', 'chip' + (ej.nuevo ? ' nuevo' : ''), ej.nuevo ? 'nuevo' : ej.grupo));
    var quitar = el('button', 'quitar-ej', '✕');
    quitar.title = 'Quitar este ejercicio';
    quitar.setAttribute('aria-label', 'Quitar ' + ej.nombre);
    quitar.addEventListener('click', function () { quitarEjercicio(idx); });
    lado.appendChild(quitar);
    cab.appendChild(lado);
    caja.appendChild(cab);

    var stats = statsEjercicio(ej.nombre);
    var prev = sesionPreviaDe(ej.nombre, sesion.sesion_id);

    if (prev) caja.appendChild(bloqueAnterior(ej, prev, stats));
    if (stats.ultima) {
      var sug = sugerencia_(ej, stats);
      if (sug) caja.appendChild(el('div', 'sugerencia', sug));
    }

    ej.series.forEach(function (serie, si) {
      caja.appendChild(filaSerie(ej, serie, si, stats, prev));
    });

    var acciones = el('div', 'ej-acciones');
    var add = el('button', 'mini-accion', '+ serie');
    add.addEventListener('click', function () {
      ej.series.push(nuevaSerie());
      guardarBorrador();
      pintarEjercicios();
    });
    acciones.appendChild(add);

    var quitarSerie = el('button', 'mini-accion', '− serie');
    quitarSerie.disabled = ej.series.length <= 1;
    quitarSerie.addEventListener('click', function () { quitarUltimaSerie(ej); });
    acciones.appendChild(quitarSerie);

    if (prefs.notas || ej.nota) {
      var nota = el('input', 'ej-nota');
      nota.type = 'text';
      nota.placeholder = 'Nota (sensaciones, ajustes de máquina…)';
      nota.value = ej.nota || '';
      nota.addEventListener('input', function () { ej.nota = nota.value; guardarBorrador(); });
      acciones.appendChild(nota);
    }
    caja.appendChild(acciones);

    var pie = el('small', 'ej-pie');
    caja.appendChild(pie);
    piesEjercicio.push({ ej: ej, nodo: pie, prev: prev, stats: stats });
    return caja;
  }

  // Lo que hiciste la última vez, serie por serie (el dato que más se extraña en el gym).
  function bloqueAnterior(ej, prev, stats) {
    var b = el('div', 'anterior');
    var cab = el('div', 'anterior-cab');
    cab.appendChild(el('span', 'anterior-tit', 'Sesión anterior · ' + fmtFechaCorta(prev.fecha)));
    var btn = el('button', 'mini-accion', '↺ repetir');
    btn.title = 'Copiar esos pesos y reps a las casillas de hoy';
    btn.addEventListener('click', function () { copiarAnterior(ej, prev); });
    cab.appendChild(btn);
    b.appendChild(cab);

    var lista = el('div', 'anterior-sets');
    prev.sets.forEach(function (s, i) {
      var chip = el('span', 'set-prev');
      chip.appendChild(el('b', null, String(i + 1)));
      chip.appendChild(el('span', null, textoSet(s)));
      if (s.rpe) chip.appendChild(el('i', 'rpe-mini', 'RPE ' + s.rpe));
      lista.appendChild(chip);
    });
    b.appendChild(lista);

    var cuando = haceTexto(prev.fecha);
    var partes = [cuando.charAt(0).toUpperCase() + cuando.slice(1), prev.sets.length + ' series'];
    var vol = volumenSets(prev.sets);
    if (vol > 0) partes.push(miles(vol) + ' kg de volumen');
    if (stats.mejorE1rm) partes.push('mejor e1RM ' + stats.mejorE1rm + ' kg');
    else if (stats.mejorAltura) partes.push('mejor ' + stats.mejorAltura + ' cm');
    else if (stats.mejorSeg) partes.push('mejor ' + stats.mejorSeg + ' s');
    else if (stats.mejorReps) partes.push('mejor ' + stats.mejorReps + ' reps');
    b.appendChild(el('small', 'anterior-pie', partes.join(' · ')));

    var nota = (prev.sets[0] && prev.sets[0].nota) || '';
    if (nota) b.appendChild(el('small', 'anterior-nota', '“' + nota + '”'));
    return b;
  }

  function copiarAnterior(ej, prev) {
    prev.sets.forEach(function (s, i) {
      if (!ej.series[i]) ej.series.push(nuevaSerie());
      var d = ej.series[i];
      d.peso = s.peso != null && s.peso !== 0 ? String(s.peso) : '';
      d.reps = s.reps != null ? String(s.reps) : '';
      d.altura_cm = s.altura_cm != null ? String(s.altura_cm) : '';
      d.segundos = s.segundos != null ? String(s.segundos) : '';
    });
    guardarBorrador();
    pintarEjercicios();
    aviso('Copiado de la sesión anterior. Ajusta lo que cambie.');
  }

  function quitarEjercicio(idx) {
    var ej = sesion.ejercicios[idx];
    if (!ej) return;
    if (tieneDatos(ej) && !confirm('“' + ej.nombre + '” ya tiene series con datos. ¿Quitarlo de la sesión?')) return;
    sesion.ejercicios.splice(idx, 1);
    guardarBorrador();
    pintarEjercicios();
    aviso('Quitado: ' + ej.nombre);
  }

  function quitarUltimaSerie(ej) {
    if (ej.series.length <= 1) return;
    var ultima = ej.series[ej.series.length - 1];
    if (serieConDatos(ultima) && !confirm('La última serie tiene datos. ¿Quitarla?')) return;
    ej.series.pop();
    guardarBorrador();
    pintarEjercicios();
  }

  function quitarSerie(ej, si) {
    if (ej.series.length <= 1) return;
    if (serieConDatos(ej.series[si]) && !confirm('Esa serie tiene datos. ¿Quitarla?')) return;
    ej.series.splice(si, 1);
    guardarBorrador();
    pintarEjercicios();
  }

  function serieConDatos(s) {
    return !!(num(s.peso) || num(s.reps) || num(s.altura_cm) || num(s.segundos));
  }
  function tieneDatos(ej) {
    return ej.series.some(function (s) { return serieConDatos(s); });
  }

  function filaSerie(ej, serie, si, stats, prev) {
    var anterior = prev && prev.sets[si] ? prev.sets[si] : null;
    var fila = el('div', 'serie tipo-' + ej.tipo + (prefs.rpe ? ' con-rpe' : ''));
    fila.appendChild(el('span', 'n', String(si + 1)));

    function revisar() {
      fila.classList.toggle('pr', esPR(stats, serie, ej.tipo));
      fila.classList.toggle('mejora', mejoraSobre(serie, anterior, ej.tipo));
    }
    fila.addEventListener('input', revisar);

    if (ej.tipo === 'tiempo') {
      fila.appendChild(campoNum(serie, 'segundos', 'seg', anterior));
    } else if (ej.tipo === 'reps') {
      fila.appendChild(campoNum(serie, 'reps', 'reps', anterior));
    } else if (ej.tipo === 'pliometria') {
      fila.appendChild(campoNum(serie, 'reps', 'reps', anterior));
      fila.appendChild(campoNum(serie, 'altura_cm', 'cm', anterior));
    } else {
      fila.appendChild(campoNum(serie, 'peso', 'kg', anterior));
      fila.appendChild(campoNum(serie, 'reps', 'reps', anterior));
    }

    if (prefs.rpe) {
      var cRpe = campoNum(serie, 'rpe', 'RPE', null);
      cRpe.classList.add('campo-rpe');
      fila.appendChild(cRpe);
    }

    var check = el('button', 'check' + (serie.hecha ? ' hecha' : ''), serie.hecha ? '✓' : '○');
    check.setAttribute('aria-label', 'Marcar serie ' + (si + 1) + ' como hecha');
    check.addEventListener('click', function () {
      serie.hecha = !serie.hecha;
      check.className = 'check' + (serie.hecha ? ' hecha' : '');
      check.textContent = serie.hecha ? '✓' : '○';
      guardarBorrador();
      revisar();
      actualizarStatsSesion();
      if (serie.hecha) iniciarDescanso(ej.descanso);
    });
    fila.appendChild(check);

    var borrar = el('button', 'quitar-serie', '✕');
    borrar.title = 'Quitar esta serie';
    borrar.setAttribute('aria-label', 'Quitar serie ' + (si + 1));
    borrar.disabled = ej.series.length <= 1;
    borrar.addEventListener('click', function () { quitarSerie(ej, si); });
    fila.appendChild(borrar);

    revisar(); // por si vuelves a una sesión con valores del borrador
    return fila;
  }

  // El valor de la sesión anterior va como placeholder: lo ves dentro de la casilla
  // y desaparece en cuanto escribes el de hoy.
  function campoNum(serie, campo, unidad, anterior) {
    var wrap = el('div', 'campo');
    var inp = el('input');
    inp.type = 'number';
    inp.inputMode = 'decimal';
    inp.value = serie[campo];
    inp.setAttribute('aria-label', unidad);
    if (anterior && anterior[campo] != null && anterior[campo] !== '' && anterior[campo] !== 0) {
      inp.placeholder = String(anterior[campo]);
    } else if (campo === 'rpe') {
      inp.placeholder = 'RPE';
    }
    inp.addEventListener('input', function () { serie[campo] = inp.value; guardarBorrador(); });
    wrap.appendChild(inp);
    wrap.appendChild(el('span', 'u', unidad));
    return wrap;
  }

  function mejoraSobre(serie, anterior, tipo) {
    if (!anterior) return false;
    var p = num(serie.peso) || 0, r = num(serie.reps) || 0, a = num(serie.altura_cm) || 0, g = num(serie.segundos) || 0;
    var ap = num(anterior.peso) || 0, ar = num(anterior.reps) || 0, aa = num(anterior.altura_cm) || 0, ag = num(anterior.segundos) || 0;
    if (tipo === 'peso_reps') return r > 0 && (p > ap || (p === ap && r > ar));
    if (tipo === 'pliometria') return a > 0 ? a > aa : r > ar;
    if (tipo === 'tiempo') return g > ag;
    return r > ar;
  }

  // ¿La serie que acabas de meter supera tu mejor marca previa? (solo si ya hay historia)
  function esPR(stats, serie, tipo) {
    if (!stats || !stats.ultima) return false;
    var p = num(serie.peso) || 0, r = num(serie.reps) || 0, a = num(serie.altura_cm) || 0, g = num(serie.segundos) || 0;
    if (tipo === 'peso_reps') return p > 0 && r > 0 && (p > stats.mejorPeso + 1e-9 || p * (1 + r / 30) > stats.mejorE1rm + 1e-9);
    if (tipo === 'pliometria') return a > 0 ? a > stats.mejorAltura + 1e-9 : r > stats.mejorReps;
    if (tipo === 'reps') return r > stats.mejorReps;
    if (tipo === 'tiempo') return g > stats.mejorSeg;
    return false;
  }

  // Sugerencia de progresión (solo fuerza): si el tope del rango se cumplió, +2.5 kg.
  function sugerencia_(ej, stats) {
    if (ej.tipo !== 'peso_reps' || !stats.ultima) return null;
    var t = stats.ultima.top, peso = num(t.peso) || 0, reps = num(t.reps) || 0;
    if (peso <= 0) return null;
    var nums = String(ej.reps || '').match(/\d+/g);
    var tope = nums ? +nums[nums.length - 1] : null;
    if (tope && reps >= tope) return 'Hoy: sube a ' + (peso + INC_KG) + ' kg';
    if (tope) return 'Hoy: ' + peso + ' kg · apunta a ' + tope + ' reps';
    return 'Hoy: ' + peso + ' kg';
  }

  // Marcador en vivo de la sesión: series hechas, volumen y comparación con la vez pasada.
  function actualizarStatsSesion() {
    if (!sesion) return;
    var hechas = 0, total = 0, vol = 0, ejsConDato = 0;
    sesion.ejercicios.forEach(function (ej) {
      var algo = false;
      ej.series.forEach(function (s) {
        total++;
        if (s.hecha) hechas++;
        if (serieConDatos(s)) algo = true;
        vol += (num(s.peso) || 0) * (num(s.reps) || 0);
      });
      if (algo) ejsConDato++;
    });

    var tiles = $('sesion-tiles'); tiles.innerHTML = '';
    tiles.appendChild(tile('Series', hechas + '/' + total, 'hechas'));
    tiles.appendChild(tile('Volumen', miles(vol), 'kg'));
    tiles.appendChild(tile('Ejercicios', ejsConDato + '/' + sesion.ejercicios.length, 'con datos'));
    $('sesion-barra-prog').firstChild.style.width = (total ? hechas / total * 100 : 0) + '%';

    piesEjercicio.forEach(function (ref) {
      var hoyVol = volumenSets(ref.ej.series.map(function (s) {
        return { peso: num(s.peso) || 0, reps: num(s.reps) || 0 };
      }));
      var hechasEj = ref.ej.series.filter(function (s) { return s.hecha; }).length;
      var antVol = ref.prev ? volumenSets(ref.prev.sets) : 0;
      var txt = 'Hoy: ' + hechasEj + '/' + ref.ej.series.length + ' series';
      // El volumen se muestra como "lo de hoy / lo de la vez pasada": a media sesión
      // una resta suelta se leería como retroceso cuando solo faltan series.
      if (hoyVol > 0 || antVol > 0) {
        txt += ' · ' + miles(hoyVol) + (antVol > 0 ? ' / ' + miles(antVol) : '') + ' kg';
        if (antVol > 0) txt += ' de la vez pasada';
      }
      ref.nodo.textContent = txt;
    });
  }

  // ── Cronómetro de descanso ──────────────────────────────────────────────────
  var descansoRestante = 0;
  function iniciarDescanso(seg) {
    descansoRestante = seg || 90;
    mostrar('descanso');
    pintarDescanso();
    clearInterval(descansoInt);
    descansoInt = setInterval(function () {
      descansoRestante--;
      pintarDescanso();
      if (descansoRestante <= 0) finDescanso();
    }, 1000);
  }
  function pintarDescanso() { $('descanso-tiempo').textContent = fmtTiempo(descansoRestante); }
  function finDescanso() {
    clearInterval(descansoInt);
    var d = $('descanso');
    d.classList.add('suena');
    vibrar([200, 100, 200]);
    setTimeout(function () { d.classList.remove('suena'); ocultar('descanso'); }, 1800);
  }
  function vibrar(p) { if (navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }

  // ── Selector de ejercicio (para "Libre" o añadir extra) ─────────────────────
  function abrirSelector() {
    var lista = todosLosEjercicios();
    var cont = $('selector-lista');
    var buscar = $('selector-buscar');
    buscar.value = '';
    function pintar(filtro) {
      cont.innerHTML = '';
      lista.filter(function (e) { return !filtro || e.nombre.toLowerCase().indexOf(filtro.toLowerCase()) >= 0; })
        .forEach(function (e) {
          var item = el('div', 'selector-item');
          item.appendChild(ilustracion(e, 'mini'));
          var txt = el('div', 'selector-txt');
          txt.appendChild(el('span', null, e.nombre));
          var st = statsEjercicio(e.nombre);
          txt.appendChild(el('small', null, st.ultima
            ? 'última vez ' + haceTexto(st.ultimaFecha) + ' · ' + textoSet(st.ultima.top)
            : 'sin registros aún'));
          item.appendChild(txt);
          item.appendChild(el('span', 'chip' + (e.nuevo ? ' nuevo' : ''), e.nuevo ? 'nuevo' : e.grupo));
          item.addEventListener('click', function () {
            sesion.ejercicios.push(clonarEjercicio(e));
            guardarBorrador();
            cerrarSelector();
            pintarEjercicios();
          });
          cont.appendChild(item);
        });
    }
    pintar('');
    buscar.oninput = function () { pintar(buscar.value); };
    mostrar('selector');
    buscar.focus();
  }
  function cerrarSelector() { ocultar('selector'); }

  function todosLosEjercicios() {
    var vistos = {}, out = [];
    CAT.sesiones.forEach(function (s) {
      s.ejercicios.forEach(function (e) { if (!vistos[e.nombre]) { vistos[e.nombre] = 1; out.push(e); } });
    });
    (CAT.extras || []).forEach(function (e) { if (!vistos[e.nombre]) { vistos[e.nombre] = 1; out.push(e); } });
    // Lo que ya registraste pero no está en el catálogo también debe poder repetirse.
    ejerciciosDeHistorial().forEach(function (e) {
      if (!vistos[e.nombre]) { vistos[e.nombre] = 1; out.push({ nombre: e.nombre, grupo: e.grupo, tipo: e.tipo, series: 3, reps: '', descanso: 90 }); }
    });
    out.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
    return out;
  }

  // ── 8. Historial y detalle ──────────────────────────────────────────────────
  function abrirHistorial() {
    irA('historial');
    var hist = leerHistorial();
    $('hist-vacio').classList.toggle('oculto', hist.length > 0);

    var tiles = $('hist-tiles'); tiles.innerHTML = '';
    if (hist.length) {
      var vol = 0, series = 0, min = 0;
      hist.forEach(function (h) { vol += volumenSets(h.payload.sets); series += h.payload.sets.length; min += h.payload.durMin || 0; });
      tiles.appendChild(tile('Sesiones', String(hist.length), 'guardadas'));
      tiles.appendChild(tile('Series', miles(series), 'en total'));
      tiles.appendChild(tile('Volumen', miles(vol), 'kg acumulados'));
      tiles.appendChild(tile('Tiempo', miles(Math.round(min / 60)), 'horas'));
    }

    var cont = $('lista-historial');
    cont.innerHTML = '';
    hist.forEach(function (h, i) { cont.appendChild(tarjetaHistorial(h, i)); });
  }

  function tarjetaHistorial(h, i) {
    var p = h.payload;
    var card = el('button', 'tarjeta');
    var cab = el('div', 'hist-cab');
    cab.appendChild(el('span', null, p.titulo || 'Sesión'));
    cab.appendChild(el('span', 'chip' + (h.subida ? '' : ' pend'), h.subida ? '✓ subida' : '↑ pendiente'));
    card.appendChild(cab);
    card.appendChild(el('small', null, fmtFecha(p.fecha) + '  ·  ' + statsSesion(p)));

    var grupos = {};
    p.sets.forEach(function (s) { var g = s.grupo || 'Otros'; grupos[g] = (grupos[g] || 0) + 1; });
    var dist = barraDistribucion(grupos);
    if (dist) card.appendChild(dist);

    card.addEventListener('click', function () { abrirDetalle(i); });
    return card;
  }

  function abrirDetalle(i) {
    var hist = leerHistorial();
    var h = hist[i]; if (!h) return;
    var p = h.payload;
    irA('detalle');
    $('detalle-titulo').textContent = p.titulo || 'Sesión';
    $('detalle-sub').textContent = fmtFecha(p.fecha) + (h.subida ? '  ·  ✓ subida' : '  ·  ↑ pendiente');

    var ejs = agruparPorEjercicio(p.sets);
    var vol = volumenSets(p.sets);
    var reps = p.sets.reduce(function (m, s) { return m + (num(s.reps) || 0); }, 0);

    var tiles = $('detalle-tiles'); tiles.innerHTML = '';
    tiles.appendChild(tile('Duración', (p.durMin || 0) + '', 'min'));
    tiles.appendChild(tile('Ejercicios', String(ejs.length), ''));
    tiles.appendChild(tile('Series', String(p.sets.length), reps + ' reps'));
    tiles.appendChild(tile('Volumen', miles(vol), 'kg'));

    var grupos = {};
    p.sets.forEach(function (s) { var g = s.grupo || 'Otros'; grupos[g] = (grupos[g] || 0) + 1; });
    var cg = $('detalle-grupos'); cg.innerHTML = '';
    var dist = barraDistribucion(grupos);
    if (dist) cg.appendChild(dist);

    var cuerpo = $('detalle-cuerpo');
    cuerpo.innerHTML = '';
    ejs.forEach(function (g) {
      var caja = el('div', 'ejercicio');
      var cab = el('div', 'ejercicio-cab');
      cab.appendChild(ilustracion({ nombre: g.ej, grupo: g.grupo }));
      var tit = el('div', 'ej-tit');
      tit.appendChild(el('h3', null, g.ej));
      var volEj = volumenSets(g.sets);
      tit.appendChild(el('span', 'guia', g.sets.length + ' series' + (volEj > 0 ? ' · ' + miles(volEj) + ' kg' : '')));
      cab.appendChild(tit);
      var bp = el('button', 'mini-prog', '📈');
      bp.title = 'Ver progreso de ' + g.ej;
      bp.addEventListener('click', function (ev) { ev.stopPropagation(); abrirProgreso(g.ej); });
      cab.appendChild(bp);
      caja.appendChild(cab);

      g.sets.forEach(function (s, si) {
        var fila = el('div', 'det-serie');
        fila.appendChild(el('span', 'n', String(si + 1)));
        fila.appendChild(el('span', null, textoSet(s)));
        if (s.rpe) fila.appendChild(el('span', 'rpe-mini', 'RPE ' + s.rpe));
        caja.appendChild(fila);
      });
      var nota = g.sets[0] && g.sets[0].nota;
      if (nota) caja.appendChild(el('small', 'anterior-nota', '“' + nota + '”'));
      cuerpo.appendChild(caja);
    });

    $('btn-det-repetir').onclick = function () { repetirSesion(p); };
    $('btn-det-borrar').onclick = function () {
      if (!confirm('¿Borrar esta sesión del historial del celular? No afecta lo ya guardado en el Sheet.')) return;
      var h2 = leerHistorial(); h2.splice(i, 1); escribirHistorial(h2);
      abrirHistorial();
    };
  }

  // Arranca una sesión nueva con los mismos ejercicios y series de una ya hecha.
  function repetirSesion(p) {
    if (sesion && !confirm('Tienes una sesión en curso. ¿Descartarla y empezar esta?')) return;
    var plantilla = {
      nombre: p.titulo || 'Sesión',
      ejercicios: agruparPorEjercicio(p.sets).map(function (g) {
        var base = buscarEnCatalogo(g.ej) || {};
        return {
          nombre: g.ej,
          grupo: base.grupo || g.grupo || 'Otros',
          tipo: base.tipo || g.sets[0].tipo || 'peso_reps',
          series: g.sets.length,
          reps: base.reps || '',
          descanso: base.descanso || 90,
          img: base.img || '',
        };
      }),
    };
    iniciarSesion(plantilla);
  }

  // ── 9. Progreso · Resumen · Récords ─────────────────────────────────────────
  function abrirProgreso(preselec) {
    irA('progreso');
    var sel = $('prog-ejercicio');
    var lista = ejerciciosDeHistorial();
    sel.innerHTML = '';
    lista.forEach(function (e) { var o = el('option', null, e.nombre); o.value = e.nombre; sel.appendChild(o); });

    var vacio = !lista.length;
    $('prog-vacio').classList.toggle('oculto', !vacio);
    $('prog-cab').classList.toggle('oculto', vacio);
    if (vacio) {
      ['prog-resumen', 'prog-chart', 'prog-chart2', 'prog-tabla', 'prog-chips', 'prog-tiles'].forEach(vaciar);
      $('prog-h-vol').classList.add('oculto');
      $('prog-h-hist').classList.add('oculto');
      return;
    }
    if (preselec && lista.some(function (e) { return e.nombre === preselec; })) sel.value = preselec;
    progMetricaId = null; // cada ejercicio arranca en su métrica natural
    renderProgreso(sel.value);
  }

  function renderProgreso(nombre) {
    var st = statsEjercicio(nombre);
    var metricas = metricasDe(st.tipo);
    var metrica = metricas.filter(function (m) { return m.id === progMetricaId; })[0] || metricas[0];
    progMetricaId = metrica.id;

    $('prog-ilus').innerHTML = ILUS.svgDe(nombre, st.grupo);

    var chips = $('prog-chips'); chips.innerHTML = '';
    metricas.forEach(function (m) {
      var b = el('button', 'chip-btn' + (m.id === metrica.id ? ' on' : ''), m.etq);
      b.addEventListener('click', function () { progMetricaId = m.id; renderProgreso(nombre); });
      chips.appendChild(b);
    });

    var pts = serieDeMetrica(nombre, metrica);
    var resumen = $('prog-resumen'); resumen.innerHTML = '';
    ['prog-chart', 'prog-chart2', 'prog-tabla', 'prog-tiles'].forEach(vaciar);
    if (!pts.length) return;

    var primero = pts[0].valor, ultimo = pts[pts.length - 1].valor;
    resumen.appendChild(el('span', 'prog-valor', fmtVal(ultimo, metrica.unidad)));
    if (pts.length > 1) {
      var dif = redondear(ultimo - primero);
      var pct = primero ? Math.round((ultimo - primero) / primero * 100) : null;
      var signo = dif > 0 ? '▲ +' : dif < 0 ? '▼ ' : '● ';
      resumen.appendChild(el('span', 'prog-delta ' + (dif > 0 ? 'sube' : dif < 0 ? 'baja' : ''),
        signo + dif + ' ' + metrica.unidad + (pct != null ? ' (' + (pct >= 0 ? '+' : '') + pct + '%)' : '')));
    }
    resumen.appendChild(el('small', null, 'desde ' + fmtDiaMes(pts[0].fecha)));

    pintarChart($('prog-chart'), svgLinea(pts, metrica.unidad),
      metrica.etq + ' por sesión · toca un punto para ver la fecha');

    var tiles = $('prog-tiles');
    tiles.appendChild(tile('Sesiones', String(st.nSesiones), 'registradas'));
    tiles.appendChild(tile('Series', String(st.nSeries), 'en total'));
    if (st.tipo === 'peso_reps') {
      tiles.appendChild(tile('Mejor peso', st.mejorPeso + '', 'kg'));
      tiles.appendChild(tile('Mejor e1RM', st.mejorE1rm + '', 'kg' + (st.fechaMejor ? ' · ' + fmtDiaMes(st.fechaMejor) : '')));
    } else if (st.tipo === 'pliometria') {
      tiles.appendChild(tile('Mejor altura', st.mejorAltura + '', 'cm'));
      tiles.appendChild(tile('Mejor reps', st.mejorReps + '', 'reps'));
    } else if (st.tipo === 'tiempo') {
      tiles.appendChild(tile('Mejor tiempo', st.mejorSeg + '', 's'));
      tiles.appendChild(tile('Última vez', haceTexto(st.ultimaFecha), ''));
    } else {
      tiles.appendChild(tile('Mejor reps', st.mejorReps + '', 'reps'));
      tiles.appendChild(tile('Última vez', haceTexto(st.ultimaFecha), ''));
    }

    // Segunda gráfica: carga total por sesión (volumen en fuerza, reps en el resto).
    var esFuerza = st.tipo === 'peso_reps';
    var barras = pts.slice(-8).map(function (p, i, arr) {
      var v = esFuerza ? Math.round(volumenSets(p.sets)) : p.sets.reduce(function (m, s) { return m + (num(s.reps) || 0); }, 0);
      return { etq: fmtDiaMes(p.fecha), valor: v, destacado: i === arr.length - 1 };
    });
    $('prog-h-vol').classList.remove('oculto');
    $('prog-h-vol').textContent = esFuerza ? 'Volumen por sesión' : 'Reps totales por sesión';
    pintarChart($('prog-chart2'), svgBarras(barras, esFuerza ? 'kg' : 'reps'),
      'Últimas ' + barras.length + ' sesiones · toca una barra');

    // Tabla: cada sesión con TODAS sus series, que es el detalle que se consulta.
    $('prog-h-hist').classList.remove('oculto');
    var tabla = $('prog-tabla');
    pts.slice().reverse().slice(0, 8).forEach(function (p) {
      var caja = el('div', 'prog-sesion');
      var cab = el('div', 'prog-sesion-cab');
      cab.appendChild(el('span', 'prog-sesion-fecha', fmtFechaCorta(p.fecha)));
      cab.appendChild(el('span', 'prog-cell', fmtVal(p.valor, metrica.unidad)));
      caja.appendChild(cab);
      var sets = el('div', 'anterior-sets');
      p.sets.slice().sort(function (a, b) { return (a.serie || 0) - (b.serie || 0); }).forEach(function (s, i) {
        var chip = el('span', 'set-prev');
        chip.appendChild(el('b', null, String(i + 1)));
        chip.appendChild(el('span', null, textoSet(s)));
        sets.appendChild(chip);
      });
      caja.appendChild(sets);
      tabla.appendChild(caja);
    });
  }

  var ORDEN_GRUPOS = ['Piernas', 'Empuje', 'Tirón', 'Pliometría', 'Core', 'Otros'];
  var GRUPOS_OBJETIVO = ['Piernas', 'Empuje', 'Tirón']; // deberían tocarse cada semana

  function abrirResumen() {
    irA('resumen');
    var sem = ultimasSemanas(8);
    var esta = sem[sem.length - 1].agg;
    var ant = sem[sem.length - 2].agg;
    var iniEsta = sem[sem.length - 1].desde;

    $('res-rango').textContent = fmtRango(iniEsta, new Date(iniEsta.getTime() + 6 * 864e5));

    var vacio = esta.nSesiones === 0 && ant.nSesiones === 0;
    $('res-vacio').classList.toggle('oculto', !vacio);
    ['res-metricas', 'res-grupos', 'res-chart', 'res-chips', 'res-prs'].forEach(vaciar);
    ['res-h-grupos', 'res-h-tend', 'res-h-prs', 'res-descubiertos'].forEach(function (id) { $(id).classList.add('oculto'); });
    if (vacio && leerHistorial().length === 0) return;

    var met = $('res-metricas');
    met.appendChild(tarjetaMetrica('Sesiones', esta.nSesiones, ant.nSesiones, ''));
    met.appendChild(tarjetaMetrica('Series', esta.nSeries, ant.nSeries, ''));
    met.appendChild(tarjetaMetrica('Volumen', esta.volumen, ant.volumen, 'kg'));
    met.appendChild(tarjetaMetrica('Tiempo', esta.tiempoMin, ant.tiempoMin, 'min'));

    var descub = GRUPOS_OBJETIVO.filter(function (g) { return !esta.grupos[g]; });
    if (descub.length) {
      $('res-descubiertos').textContent = '⚠️ Sin tocar esta semana: ' + descub.join(', ');
      $('res-descubiertos').classList.remove('oculto');
    }

    // Tendencia de 8 semanas, con la métrica que elijas.
    var METRICAS_RES = [
      { id: 'volumen', etq: 'Volumen', unidad: 'kg', val: function (a) { return a.volumen; } },
      { id: 'series', etq: 'Series', unidad: '', val: function (a) { return a.nSeries; } },
      { id: 'sesiones', etq: 'Sesiones', unidad: '', val: function (a) { return a.nSesiones; } },
      { id: 'tiempo', etq: 'Minutos', unidad: 'min', val: function (a) { return a.tiempoMin; } },
    ];
    var mr = METRICAS_RES.filter(function (m) { return m.id === resMetricaId; })[0] || METRICAS_RES[0];
    $('res-h-tend').classList.remove('oculto');
    var chips = $('res-chips');
    METRICAS_RES.forEach(function (m) {
      var b = el('button', 'chip-btn' + (m.id === mr.id ? ' on' : ''), m.etq);
      b.addEventListener('click', function () { resMetricaId = m.id; abrirResumen(); });
      chips.appendChild(b);
    });
    var items = sem.map(function (s, i) { return { etq: s.etq, valor: mr.val(s.agg), destacado: i === sem.length - 1 }; });
    pintarChart($('res-chart'), svgBarras(items, mr.unidad), mr.etq + ' por semana · toca una barra');

    // Series por grupo: esta semana contra la anterior.
    var claves = Object.keys(esta.grupos).concat(Object.keys(ant.grupos));
    var vistos = {}, grupos = [];
    ORDEN_GRUPOS.forEach(function (g) { if (claves.indexOf(g) >= 0 && !vistos[g]) { vistos[g] = 1; grupos.push(g); } });
    claves.forEach(function (g) { if (!vistos[g]) { vistos[g] = 1; grupos.push(g); } });
    if (grupos.length) {
      $('res-h-grupos').classList.remove('oculto');
      var max = grupos.reduce(function (m, g) { return Math.max(m, esta.grupos[g] || 0, ant.grupos[g] || 0); }, 0);
      var cont = $('res-grupos');
      grupos.forEach(function (g) { cont.appendChild(filaGrupo(g, esta.grupos[g] || 0, ant.grupos[g] || 0, max)); });
    }

    // Récords conseguidos esta semana.
    var prs = prsEnRango(iniEsta, new Date(iniEsta.getTime() + 7 * 864e5));
    if (prs.length) {
      $('res-h-prs').classList.remove('oculto');
      var cp = $('res-prs');
      prs.forEach(function (pr) {
        var fila = el('div', 'rec-fila');
        fila.appendChild(ilustracion({ nombre: pr.ej, grupo: pr.grupo }, 'mini'));
        var t = el('div', 'rec-txt');
        t.appendChild(el('span', 'rec-nom', pr.ej));
        t.appendChild(el('small', null, fmtFechaCorta(pr.fecha)));
        fila.appendChild(t);
        fila.appendChild(el('span', 'rec-val', '★ ' + pr.texto));
        cp.appendChild(fila);
      });
    }
  }

  function tarjetaMetrica(label, actual, previo, unidad) {
    var c = el('div', 'res-card');
    c.appendChild(el('span', 'res-label', label));
    c.appendChild(el('span', 'res-num', miles(actual) + (unidad ? ' ' + unidad : '')));
    c.appendChild(deltaChip(actual, previo, unidad));
    c.appendChild(el('span', 'res-prev', 'antes ' + miles(previo)));
    return c;
  }

  function abrirRecords() {
    irA('records');
    var lista = ejerciciosDeHistorial();
    $('records-vacio').classList.toggle('oculto', lista.length > 0);

    var grupos = ['Todos'];
    lista.forEach(function (e) { if (grupos.indexOf(e.grupo) < 0) grupos.push(e.grupo); });
    if (grupos.indexOf(recGrupo) < 0) recGrupo = 'Todos';

    var filtros = $('rec-filtros'); filtros.innerHTML = '';
    grupos.forEach(function (g) {
      var b = el('button', 'chip-btn' + (g === recGrupo ? ' on' : ''), g);
      b.addEventListener('click', function () { recGrupo = g; abrirRecords(); });
      filtros.appendChild(b);
    });

    var cont = $('lista-records'); cont.innerHTML = '';
    lista.filter(function (e) { return recGrupo === 'Todos' || e.grupo === recGrupo; })
      .forEach(function (e) {
        var st = statsEjercicio(e.nombre);
        var fila = el('button', 'rec-fila');
        fila.appendChild(ilustracion(e, 'mini'));
        var t = el('div', 'rec-txt');
        t.appendChild(el('span', 'rec-nom', e.nombre));
        t.appendChild(el('small', null, st.nSesiones + ' sesiones · última ' + haceTexto(st.ultimaFecha)
          + (st.fechaMejor ? ' · PR ' + fmtDiaMes(st.fechaMejor) : '')));
        fila.appendChild(t);
        fila.appendChild(el('span', 'rec-val', recMarca_(st)));
        fila.addEventListener('click', function () { abrirProgreso(e.nombre); });
        cont.appendChild(fila);
      });
  }

  function recMarca_(st) {
    if (st.tipo === 'peso_reps') return (st.mejorPeso || 0) + ' kg' + (st.mejorE1rm ? '  ·  e1RM ' + st.mejorE1rm : '');
    if (st.tipo === 'pliometria') return st.mejorAltura ? st.mejorAltura + ' cm' : (st.mejorReps || 0) + ' reps';
    if (st.tipo === 'tiempo') return (st.mejorSeg || 0) + ' s';
    return (st.mejorReps || 0) + ' reps';
  }

  // ── 10. Guardar / sincronizar / arranque ────────────────────────────────────
  function guardarSesion() {
    var payload = construirPayload();
    if (!payload.sets.length) { aviso('No hay series con datos para guardar.', true); return; }

    var cola = leerCola();
    cola.push(payload);
    escribirCola(cola);

    // Guarda también en el historial local (persiste aunque la cola se limpie al subir).
    var hist = leerHistorial();
    hist.unshift({ payload: payload, subida: false, guardadaEn: Date.now() });
    escribirHistorial(hist.slice(0, HIST_MAX));

    localStorage.removeItem(BORRADOR_KEY);

    clearInterval(cronoSesionInt);
    sesion = null;
    pintarInicio();
    aviso('Sesión guardada. Sincronizando…');
    sincronizar();
  }

  // Convierte la sesión en curso al formato del backend (una entrada por serie con reps > 0).
  function construirPayload() {
    var sets = [];
    sesion.ejercicios.forEach(function (ej) {
      ej.series.forEach(function (serie, si) {
        var reps = num(serie.reps);
        var segundos = num(serie.segundos);
        // Se guarda si hay reps, o si es isométrico con segundos.
        var repsEfectivas = reps != null ? reps : (segundos != null ? 1 : null);
        if (repsEfectivas == null || repsEfectivas <= 0) return;
        sets.push({
          ej: ej.nombre, grupo: ej.grupo, tipo: ej.tipo, serie: si + 1,
          peso: num(serie.peso) != null ? num(serie.peso) : 0,
          reps: repsEfectivas,
          altura_cm: num(serie.altura_cm),
          segundos: segundos,
          rpe: num(serie.rpe),
          nota: ej.nota || '',
        });
      });
    });
    return {
      sesion_id: sesion.sesion_id,
      fecha: new Date(sesion.inicio).toISOString(),
      titulo: sesion.titulo,
      durMin: Math.max(1, Math.round((Date.now() - sesion.inicio) / 60000)),
      sets: sets,
    };
  }

  function sincronizar() {
    var cola = leerCola();
    if (!cola.length) { marcarEstado('ok'); actualizarPendientes(); return; }
    if (!CFG.EXEC_URL) {
      marcarEstado('sinc');
      aviso('Guardado en el celular. Configura EXEC_URL para subir al Sheet.');
      actualizarPendientes();
      return;
    }
    if (!navigator.onLine) { marcarEstado('sinc'); actualizarPendientes(); return; }

    marcarEstado('sinc');
    fetch(CFG.EXEC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain evita el preflight CORS
      body: JSON.stringify({ secreto: secretoParaSubir(), sesiones: cola }),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          escribirCola([]); // el backend es idempotente por sesion_id
          marcarSubidas(cola);
          marcarEstado('ok');
          aviso('Subido: ' + (res.sesiones || cola.length) + ' sesión(es).');
        } else {
          marcarEstado('error');
          if (/autoriz/i.test((res && res.error) || '')) {
            localStorage.removeItem(SECRETO_KEY);
            aviso('Clave incorrecta. La borré; te la pediré de nuevo al reintentar.', true);
          } else {
            aviso('El servidor rechazó los datos: ' + (res && res.error || '?'), true);
          }
        }
        actualizarPendientes();
      })
      .catch(function () {
        marcarEstado('error');
        aviso('Sin conexión. Se reintenta luego.', true);
        actualizarPendientes();
      });
  }

  function marcarEstado(clase) {
    var e = $('estado');
    e.className = 'estado ' + clase;
    e.textContent = clase === 'ok' ? '✓' : clase === 'error' ? '!' : clase === 'sinc' ? '↑' : '•';
  }

  function recuperarBorrador() {
    try {
      var b = JSON.parse(localStorage.getItem(BORRADOR_KEY));
      if (b && b.ejercicios) {
        sesion = b;
        abrirSesion();
        aviso('Retomando tu sesión en curso.');
      }
    } catch (e) {}
  }

  function descartarSesion() {
    if (!confirm('¿Descartar esta sesión sin guardar?')) return;
    clearInterval(cronoSesionInt);
    sesion = null;
    localStorage.removeItem(BORRADOR_KEY);
    pintarInicio();
  }

  function init() {
    leerPrefs();
    pintarInicio();

    $('btn-volver').addEventListener('click', function () {
      // Volver al inicio conservando el borrador (no descarta).
      clearInterval(cronoSesionInt);
      pintarInicio();
    });
    $('btn-guardar').addEventListener('click', guardarSesion);
    $('btn-descartar').addEventListener('click', descartarSesion);
    $('btn-agregar-ejercicio').addEventListener('click', abrirSelector);
    $('selector-cerrar').addEventListener('click', cerrarSelector);
    $('btn-pendientes').addEventListener('click', sincronizar);

    // Al teclear en cualquier casilla se refrescan los marcadores de la sesión.
    $('lista-ejercicios').addEventListener('input', actualizarStatsSesion);

    $('chip-rpe').addEventListener('click', function () {
      prefs.rpe = !prefs.rpe; guardarPrefs();
      $('chip-rpe').classList.toggle('on', prefs.rpe);
      if (sesion) pintarEjercicios();
    });
    $('chip-notas').addEventListener('click', function () {
      prefs.notas = !prefs.notas; guardarPrefs();
      $('chip-notas').classList.toggle('on', prefs.notas);
      if (sesion) pintarEjercicios();
    });

    $('btn-historial').addEventListener('click', abrirHistorial);
    $('btn-hist-volver').addEventListener('click', pintarInicio);
    $('btn-det-volver').addEventListener('click', abrirHistorial);

    $('btn-progreso').addEventListener('click', function () { abrirProgreso(); });
    $('btn-prog-volver').addEventListener('click', pintarInicio);
    $('prog-ejercicio').addEventListener('change', function () { progMetricaId = null; renderProgreso(this.value); });

    $('btn-resumen').addEventListener('click', abrirResumen);
    $('btn-res-volver').addEventListener('click', pintarInicio);

    $('btn-records').addEventListener('click', abrirRecords);
    $('btn-rec-volver').addEventListener('click', pintarInicio);

    $('descanso-menos').addEventListener('click', function () { descansoRestante = Math.max(0, descansoRestante - 15); pintarDescanso(); });
    $('descanso-mas').addEventListener('click', function () { descansoRestante += 15; pintarDescanso(); });
    $('descanso-saltar').addEventListener('click', function () { clearInterval(descansoInt); ocultar('descanso'); });

    window.addEventListener('online', sincronizar);

    recuperarBorrador();
    sincronizar(); // intenta subir lo que quedó pendiente

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
