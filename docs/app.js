/* app.js — Mi Gym. Registro de sesiones + cola offline + sincronización al Sheet. */
(function () {
  'use strict';

  var CFG = window.MIGYM_CONFIG || { EXEC_URL: '', APP_SECRETO: '' };
  var CAT = window.MIGYM_CATALOGO || { sesiones: [], extras: [] };
  var COLA_KEY = 'migym_cola_v1';       // sesiones guardadas pendientes de subir
  var BORRADOR_KEY = 'migym_borrador_v1'; // sesión en curso (por si cierras la app)
  var HIST_KEY = 'migym_historial_v1';  // historial local de sesiones (subidas o no)
  var HIST_MAX = 300;                   // tope de sesiones guardadas en el celular
  var SECRETO_KEY = 'migym_secreto_v1'; // clave de sincronización, solo en este celular (nunca en el repo)

  // Estado de la sesión en curso
  var sesion = null; // { sesion_id, inicio, titulo, ejercicios:[{nombre,grupo,tipo,guia,series:[{peso,reps,altura_cm,segundos,hecha}]}] }
  var cronoSesionInt = null;
  var descansoInt = null;

  // ── Utilidades DOM ──────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function mostrar(id) { $(id).classList.remove('oculto'); }
  function ocultar(id) { $(id).classList.add('oculto'); }

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

  // ── Pantalla inicio ─────────────────────────────────────────────────────────
  function pintarInicio() {
    var cont = $('lista-sesiones');
    cont.innerHTML = '';
    CAT.sesiones.forEach(function (s) {
      var card = el('button', 'tarjeta');
      card.appendChild(el('span', null, s.nombre));
      if (s.ejercicios.length) {
        card.appendChild(el('small', null, s.ejercicios.map(function (e) { return e.nombre; }).slice(0, 3).join(' · ') + (s.ejercicios.length > 3 ? '…' : '')));
      } else {
        card.appendChild(el('small', null, 'Elige los ejercicios a mano'));
      }
      card.addEventListener('click', function () { iniciarSesion(s); });
      cont.appendChild(card);
    });
    actualizarPendientes();
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

  // ── Historial ───────────────────────────────────────────────────────────────
  function abrirHistorial() {
    ocultar('pantalla-inicio'); ocultar('pantalla-detalle');
    mostrar('pantalla-historial');
    pintarHistorial();
  }

  function pintarHistorial() {
    var hist = leerHistorial();
    var cont = $('lista-historial');
    cont.innerHTML = '';
    $('hist-vacio').classList.toggle('oculto', hist.length > 0);
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
    card.addEventListener('click', function () { abrirDetalle(i); });
    return card;
  }

  function statsSesion(p) {
    var ejs = {}, vol = 0;
    p.sets.forEach(function (s) { ejs[s.ej] = true; vol += (s.peso || 0) * (s.reps || 0); });
    var partes = [Object.keys(ejs).length + ' ej', p.sets.length + ' series'];
    if (vol > 0) partes.push(Math.round(vol) + ' kg vol');
    return partes.join(' · ');
  }

  function abrirDetalle(i) {
    var hist = leerHistorial();
    var h = hist[i]; if (!h) return;
    var p = h.payload;
    ocultar('pantalla-historial'); mostrar('pantalla-detalle');
    $('detalle-titulo').textContent = p.titulo || 'Sesión';
    $('detalle-sub').textContent = fmtFecha(p.fecha) +
      (p.durMin ? '  ·  ' + p.durMin + ' min' : '') + (h.subida ? '  ·  ✓ subida' : '  ·  ↑ pendiente');

    var cuerpo = $('detalle-cuerpo');
    cuerpo.innerHTML = '';
    agruparPorEjercicio(p.sets).forEach(function (g) {
      var caja = el('div', 'ejercicio');
      var cab = el('div', 'ejercicio-cab');
      cab.appendChild(el('h3', null, g.ej));
      if (g.grupo) cab.appendChild(el('span', 'chip', g.grupo));
      var bp = el('button', 'mini-prog', '📈');
      bp.title = 'Ver progreso';
      (function (nombre) { bp.addEventListener('click', function (ev) { ev.stopPropagation(); abrirProgreso(nombre); }); })(g.ej);
      cab.appendChild(bp);
      caja.appendChild(cab);
      g.sets.forEach(function (s, si) {
        var fila = el('div', 'det-serie');
        fila.appendChild(el('span', 'n', (si + 1) + ''));
        fila.appendChild(el('span', null, textoSet(s)));
        caja.appendChild(fila);
      });
      cuerpo.appendChild(caja);
    });

    $('btn-det-borrar').onclick = function () {
      if (!confirm('¿Borrar esta sesión del historial del celular? No afecta lo ya guardado en el Sheet.')) return;
      var h2 = leerHistorial(); h2.splice(i, 1); escribirHistorial(h2);
      ocultar('pantalla-detalle'); abrirHistorial();
    };
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
    if (s.tipo === 'pliometria') return s.reps + ' reps' + (s.altura_cm ? '  ·  ' + s.altura_cm + ' cm' : '');
    if (s.peso && s.peso > 0) return s.peso + ' kg × ' + s.reps;
    return s.reps + ' reps';
  }

  function fmtFecha(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }) +
        ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(iso); }
  }

  // ── Progreso por ejercicio ──────────────────────────────────────────────────
  // Métrica por tipo: fuerza → mejor e1RM · pliometría → altura (o reps) · tiempo →
  // segundos · peso corporal → reps. Todo sale del historial local, una marca por sesión.
  function ejerciciosDeHistorial() {
    var vistos = {}, out = [];
    leerHistorial().forEach(function (h) {
      h.payload.sets.forEach(function (s) { if (!vistos[s.ej]) { vistos[s.ej] = 1; out.push(s.ej); } });
    });
    out.sort(function (a, b) { return a.localeCompare(b); });
    return out;
  }

  function abrirProgreso(preselec) {
    ocultar('pantalla-inicio'); ocultar('pantalla-historial'); ocultar('pantalla-detalle');
    mostrar('pantalla-progreso');
    var sel = $('prog-ejercicio');
    var lista = ejerciciosDeHistorial();
    sel.innerHTML = '';
    lista.forEach(function (n) { var o = el('option', null, n); o.value = n; sel.appendChild(o); });
    var vacio = !lista.length;
    $('prog-vacio').classList.toggle('oculto', !vacio);
    sel.classList.toggle('oculto', vacio);
    if (vacio) { $('prog-resumen').innerHTML = ''; $('prog-chart').innerHTML = ''; $('prog-tabla').innerHTML = ''; return; }
    if (preselec && lista.indexOf(preselec) >= 0) sel.value = preselec;
    renderProgreso(sel.value);
  }

  function maxReps(sets) { return Math.max.apply(null, sets.map(function (s) { return s.reps || 0; })); }

  function metricaPorSesion(nombre) {
    var puntos = [], unidad = '', tipo = null;
    leerHistorial().forEach(function (h) {
      var sets = h.payload.sets.filter(function (s) { return s.ej === nombre; });
      if (!sets.length) return;
      if (!tipo) tipo = sets[0].tipo;
      var valor;
      if (tipo === 'pliometria') {
        var alt = sets.map(function (s) { return num(s.altura_cm); }).filter(function (x) { return x != null; });
        if (alt.length) { valor = Math.max.apply(null, alt); unidad = 'cm'; }
        else { valor = maxReps(sets); unidad = 'reps'; }
      } else if (tipo === 'tiempo') {
        valor = Math.max.apply(null, sets.map(function (s) { return num(s.segundos) || s.reps || 0; })); unidad = 's';
      } else if (tipo === 'reps') {
        valor = maxReps(sets); unidad = 'reps';
      } else { // peso_reps → mejor e1RM (Epley); si nunca hubo peso, cae a reps
        valor = Math.max.apply(null, sets.map(function (s) { return s.peso > 0 ? s.peso * (1 + s.reps / 30) : 0; }));
        if (valor > 0) { valor = Math.round(valor * 10) / 10; unidad = 'e1RM kg'; }
        else { valor = maxReps(sets); unidad = 'reps'; }
      }
      puntos.push({ fecha: h.payload.fecha, valor: valor });
    });
    puntos.sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); });
    return { puntos: puntos, unidad: unidad };
  }

  function renderProgreso(nombre) {
    var m = metricaPorSesion(nombre), pts = m.puntos;
    var resumen = $('prog-resumen'), chart = $('prog-chart'), tabla = $('prog-tabla');
    resumen.innerHTML = ''; chart.innerHTML = ''; tabla.innerHTML = '';
    if (!pts.length) return;

    var primero = pts[0].valor, ultimo = pts[pts.length - 1].valor;
    resumen.appendChild(el('span', 'prog-valor', redondear(ultimo) + ' ' + m.unidad));
    if (pts.length > 1) {
      var dif = Math.round((ultimo - primero) * 10) / 10;
      var pct = primero ? Math.round((ultimo - primero) / primero * 100) : null;
      var signo = dif > 0 ? '▲ +' : dif < 0 ? '▼ ' : '● ';
      var txt = signo + dif + ' ' + m.unidad + (pct != null ? ' (' + (pct >= 0 ? '+' : '') + pct + '%)' : '');
      resumen.appendChild(el('span', 'prog-delta ' + (dif > 0 ? 'sube' : dif < 0 ? 'baja' : ''), txt));
    }
    resumen.appendChild(el('small', null, pts.length + ' sesión(es)'));

    chart.innerHTML = dibujarLinea(pts, m.unidad);

    pts.slice().reverse().slice(0, 8).forEach(function (p) {
      var fila = el('div', 'det-serie');
      fila.appendChild(el('span', null, fmtFecha(p.fecha)));
      fila.appendChild(el('span', 'prog-cell', redondear(p.valor) + ' ' + m.unidad));
      tabla.appendChild(fila);
    });
  }

  function redondear(v) { return Math.round(v * 10) / 10; }

  // Gráfica de línea en SVG inline (sin librerías; hereda colores del CSS).
  function dibujarLinea(pts, unidad) {
    var W = 320, H = 172, pl = 42, pr = 14, pt = 16, pb = 28;
    var vals = pts.map(function (p) { return p.valor; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min = min - 1; max = max + 1; }
    var iw = W - pl - pr, ih = H - pt - pb;
    function X(i) { return pts.length <= 1 ? pl + iw / 2 : pl + iw * i / (pts.length - 1); }
    function Y(v) { return pt + ih * (1 - (v - min) / (max - min)); }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.valor).toFixed(1); }).join(' ');
    var circ = pts.map(function (p, i) {
      return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.valor).toFixed(1) + '" r="3.2" class="pt' + (i === pts.length - 1 ? ' ult' : '') + '"/>';
    }).join('');
    var yMax = Y(max), yMin = Y(min);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Progreso (' + unidad + ')">'
      + '<line class="grid" x1="' + pl + '" y1="' + yMax.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + yMax.toFixed(1) + '"/>'
      + '<line class="grid" x1="' + pl + '" y1="' + yMin.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + yMin.toFixed(1) + '"/>'
      + '<text class="lbl" x="' + (pl - 6) + '" y="' + (yMax + 3).toFixed(1) + '" text-anchor="end">' + redondear(max) + '</text>'
      + '<text class="lbl" x="' + (pl - 6) + '" y="' + (yMin + 3).toFixed(1) + '" text-anchor="end">' + redondear(min) + '</text>'
      + (pts.length > 1 ? '<path class="linea" d="' + d + '"/>' : '')
      + circ
      + '<text class="lbl" x="' + pl + '" y="' + (H - 8) + '" text-anchor="start">' + fmtFechaCorta(pts[0].fecha) + '</text>'
      + '<text class="lbl" x="' + (W - pr) + '" y="' + (H - 8) + '" text-anchor="end">' + fmtFechaCorta(pts[pts.length - 1].fecha) + '</text>'
      + '</svg>';
  }

  function fmtFechaCorta(iso) {
    try { return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }); }
    catch (e) { return ''; }
  }

  // ── Resumen semanal (esta semana vs la anterior) ────────────────────────────
  var ORDEN_GRUPOS = ['Piernas', 'Empuje', 'Tirón', 'Pliometría', 'Core', 'Otros'];
  var GRUPOS_OBJETIVO = ['Piernas', 'Empuje', 'Tirón']; // deberían tocarse cada semana

  // Lunes 00:00 local de la semana que contiene d.
  function inicioSemana(d) {
    var x = new Date(d); var lun = (x.getDay() + 6) % 7; // 0 = lunes
    x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - lun); return x;
  }

  function agregarSemana(desde, hasta) {
    var agg = { nSesiones: 0, nSeries: 0, volumen: 0, tiempoMin: 0, grupos: {} };
    leerHistorial().forEach(function (h) {
      var f = new Date(h.payload.fecha);
      if (f < desde || f >= hasta) return;
      agg.nSesiones++;
      agg.tiempoMin += h.payload.durMin || 0;
      h.payload.sets.forEach(function (s) {
        agg.nSeries++;
        agg.volumen += (s.peso || 0) * (s.reps || 0);
        var g = s.grupo || 'Otros';
        agg.grupos[g] = (agg.grupos[g] || 0) + 1;
      });
    });
    agg.volumen = Math.round(agg.volumen);
    return agg;
  }

  function abrirResumen() {
    ocultar('pantalla-inicio'); ocultar('pantalla-historial');
    ocultar('pantalla-detalle'); ocultar('pantalla-progreso');
    mostrar('pantalla-resumen');

    var iniEsta = inicioSemana(new Date());
    var finEsta = new Date(iniEsta.getTime() + 7 * 864e5);
    var iniAnt = new Date(iniEsta.getTime() - 7 * 864e5);
    var esta = agregarSemana(iniEsta, finEsta);
    var ant = agregarSemana(iniAnt, iniEsta);

    $('res-rango').textContent = fmtRango(iniEsta, new Date(iniEsta.getTime() + 6 * 864e5));

    var vacio = esta.nSesiones === 0 && ant.nSesiones === 0;
    $('res-vacio').classList.toggle('oculto', !vacio);
    ['res-metricas', 'res-grupos'].forEach(function (id) { $(id).innerHTML = ''; });
    $('res-h-grupos').classList.add('oculto');
    $('res-descubiertos').classList.add('oculto');
    if (vacio) return;

    // Tarjetas de métricas
    var met = $('res-metricas');
    met.appendChild(tarjetaMetrica('Sesiones', esta.nSesiones, ant.nSesiones, ''));
    met.appendChild(tarjetaMetrica('Series', esta.nSeries, ant.nSeries, ''));
    met.appendChild(tarjetaMetrica('Volumen', esta.volumen, ant.volumen, 'kg'));
    met.appendChild(tarjetaMetrica('Tiempo', esta.tiempoMin, ant.tiempoMin, 'min'));

    // Grupos objetivo no tocados esta semana
    var descub = GRUPOS_OBJETIVO.filter(function (g) { return !esta.grupos[g]; });
    if (descub.length) {
      $('res-descubiertos').textContent = '⚠️ Sin tocar esta semana: ' + descub.join(', ');
      $('res-descubiertos').classList.remove('oculto');
    }

    // Series por grupo
    var claves = Object.keys(esta.grupos).concat(Object.keys(ant.grupos));
    var vistos = {}, grupos = [];
    ORDEN_GRUPOS.forEach(function (g) { if (claves.indexOf(g) >= 0 && !vistos[g]) { vistos[g] = 1; grupos.push(g); } });
    claves.forEach(function (g) { if (!vistos[g]) { vistos[g] = 1; grupos.push(g); } });

    if (grupos.length) {
      $('res-h-grupos').classList.remove('oculto');
      var cont = $('res-grupos');
      grupos.forEach(function (g) {
        cont.appendChild(filaGrupo(g, esta.grupos[g] || 0, ant.grupos[g] || 0));
      });
    }
  }

  function tarjetaMetrica(label, actual, previo, unidad) {
    var c = el('div', 'res-card');
    c.appendChild(el('span', 'res-label', label));
    c.appendChild(el('span', 'res-num', redondear(actual) + (unidad ? ' ' + unidad : '')));
    c.appendChild(deltaChip(actual, previo, unidad));
    c.appendChild(el('span', 'res-prev', 'antes ' + redondear(previo)));
    return c;
  }

  function filaGrupo(nombre, actual, previo) {
    var fila = el('div', 'res-grupo');
    fila.appendChild(el('span', 'res-g-nom', nombre));
    fila.appendChild(el('span', 'res-g-val', actual + ' vs ' + previo));
    fila.appendChild(deltaChip(actual, previo, ''));
    return fila;
  }

  // Insignia de variación ▲/▼ con valor absoluto y % (cuando la semana previa no fue 0).
  function deltaChip(actual, previo, unidad) {
    var dif = redondear(actual - previo);
    var cls = dif > 0 ? 'sube' : dif < 0 ? 'baja' : '';
    var flecha = dif > 0 ? '▲' : dif < 0 ? '▼' : '●';
    var val = dif > 0 ? '+' + dif : '' + dif;
    var pct = previo ? ' (' + (dif >= 0 ? '+' : '') + Math.round((actual - previo) / previo * 100) + '%)' : '';
    var txt = (dif === 0) ? '● igual' : flecha + ' ' + val + (unidad ? ' ' + unidad : '') + pct;
    return el('span', 'res-delta ' + cls, txt);
  }

  function fmtRango(ini, fin) {
    var o = { day: 'numeric', month: 'short' };
    try { return ini.toLocaleDateString('es-CO', o) + ' – ' + fin.toLocaleDateString('es-CO', o); }
    catch (e) { return ''; }
  }

  // ── Iniciar / construir sesión ──────────────────────────────────────────────
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
      nombre: e.nombre, grupo: e.grupo, tipo: e.tipo,
      guia: (e.series || '') + ' × ' + (e.reps || '') + '  ·  descanso ' + fmtTiempo(e.descanso || 90),
      descanso: e.descanso || 90, nuevo: !!e.nuevo, series: [],
    };
    var n = e.series || 1;
    for (var i = 0; i < n; i++) ej.series.push(nuevaSerie());
    return ej;
  }

  function nuevaSerie() { return { peso: '', reps: '', altura_cm: '', segundos: '', hecha: false }; }
  function nuevoId() { return new Date().toISOString(); }

  function abrirSesion() {
    ocultar('pantalla-inicio');
    mostrar('pantalla-sesion');
    $('titulo-sesion').textContent = sesion.titulo;
    pintarEjercicios();
    arrancarCronoSesion();
  }

  function arrancarCronoSesion() {
    clearInterval(cronoSesionInt);
    cronoSesionInt = setInterval(function () {
      $('crono-sesion').textContent = 'sesión ' + fmtTiempo((Date.now() - sesion.inicio) / 1000);
    }, 1000);
  }

  // ── Pintar ejercicios y series ──────────────────────────────────────────────
  function pintarEjercicios() {
    var cont = $('lista-ejercicios');
    cont.innerHTML = '';
    sesion.ejercicios.forEach(function (ej, idx) {
      cont.appendChild(tarjetaEjercicio(ej, idx));
    });
  }

  function tarjetaEjercicio(ej, idx) {
    var caja = el('div', 'ejercicio');
    var cab = el('div', 'ejercicio-cab');
    cab.appendChild(el('h3', null, ej.nombre));
    var chip = el('span', 'chip' + (ej.nuevo ? ' nuevo' : ''), ej.nuevo ? 'nuevo' : ej.grupo);
    cab.appendChild(chip);
    caja.appendChild(cab);
    caja.appendChild(el('div', 'guia', ej.guia));

    ej.series.forEach(function (serie, si) {
      caja.appendChild(filaSerie(ej, idx, serie, si));
    });

    var add = el('button', 'add-serie', '+ serie');
    add.addEventListener('click', function () {
      ej.series.push(nuevaSerie());
      guardarBorrador();
      pintarEjercicios();
    });
    caja.appendChild(add);
    return caja;
  }

  function filaSerie(ej, idx, serie, si) {
    var fila = el('div', 'serie tipo-' + ej.tipo);
    fila.appendChild(el('span', 'n', si + 1));

    if (ej.tipo === 'tiempo') {
      fila.appendChild(campoNum(serie, 'segundos', 'seg'));
    } else if (ej.tipo === 'reps') {
      fila.appendChild(campoNum(serie, 'reps', 'reps'));
    } else if (ej.tipo === 'pliometria') {
      fila.appendChild(campoNum(serie, 'reps', 'reps'));
      fila.appendChild(campoNum(serie, 'altura_cm', 'cm'));
    } else { // peso_reps
      fila.appendChild(campoNum(serie, 'peso', 'kg'));
      fila.appendChild(campoNum(serie, 'reps', 'reps'));
    }

    var check = el('button', 'check' + (serie.hecha ? ' hecha' : ''), serie.hecha ? '✓' : '○');
    check.addEventListener('click', function () {
      serie.hecha = !serie.hecha;
      check.className = 'check' + (serie.hecha ? ' hecha' : '');
      check.textContent = serie.hecha ? '✓' : '○';
      guardarBorrador();
      if (serie.hecha) iniciarDescanso(ej.descanso);
    });
    fila.appendChild(check);
    return fila;
  }

  function campoNum(serie, campo, unidad) {
    var wrap = el('div', 'campo');
    var inp = el('input');
    inp.type = 'number';
    inp.inputMode = 'decimal';
    inp.value = serie[campo];
    inp.setAttribute('aria-label', unidad);
    inp.addEventListener('input', function () { serie[campo] = inp.value; guardarBorrador(); });
    wrap.appendChild(inp);
    wrap.appendChild(el('span', 'u', unidad));
    return wrap;
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
          item.appendChild(el('span', null, e.nombre));
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
    out.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
    return out;
  }

  // ── Guardar / sincronizar ───────────────────────────────────────────────────
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

    // Volver al inicio
    clearInterval(cronoSesionInt);
    sesion = null;
    ocultar('pantalla-sesion');
    mostrar('pantalla-inicio');
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

  function num(v) {
    if (v == null || v === '') return null;
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
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
          marcarSubidas(cola); // deja constancia en el historial de las que subieron
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
      .catch(function (err) {
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

  // ── Cola y borrador en localStorage ─────────────────────────────────────────
  function leerCola() { try { return JSON.parse(localStorage.getItem(COLA_KEY)) || []; } catch (e) { return []; } }
  function escribirCola(c) { localStorage.setItem(COLA_KEY, JSON.stringify(c)); }
  // La clave sale de config.js si está (compatibilidad) o del almacén local del celular.
  function obtenerSecreto() { return CFG.APP_SECRETO || localStorage.getItem(SECRETO_KEY) || ''; }
  // Devuelve la clave; si no hay, la pide una vez y la guarda en este celular.
  function secretoParaSubir() {
    var s = obtenerSecreto();
    if (s) return s;
    s = (window.prompt('Clave de sincronización (te la piden una sola vez y queda guardada en este celular):') || '').trim();
    if (s) localStorage.setItem(SECRETO_KEY, s);
    return s;
  }
  function leerHistorial() { try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch (e) { return []; } }
  function escribirHistorial(h) { localStorage.setItem(HIST_KEY, JSON.stringify(h)); }
  // Marca en el historial las sesiones que acaban de subir bien (por sesion_id).
  function marcarSubidas(cola) {
    var ids = {}; cola.forEach(function (p) { ids[p.sesion_id] = true; });
    var hist = leerHistorial();
    hist.forEach(function (h) { if (ids[h.payload.sesion_id]) h.subida = true; });
    escribirHistorial(hist);
  }
  function guardarBorrador() { if (sesion) localStorage.setItem(BORRADOR_KEY, JSON.stringify(sesion)); }

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
    ocultar('pantalla-sesion');
    mostrar('pantalla-inicio');
    pintarInicio();
  }

  // ── Arranque ────────────────────────────────────────────────────────────────
  function init() {
    pintarInicio();

    $('btn-volver').addEventListener('click', function () {
      // Volver al inicio conservando el borrador (no descarta).
      clearInterval(cronoSesionInt);
      ocultar('pantalla-sesion'); mostrar('pantalla-inicio'); pintarInicio();
    });
    $('btn-guardar').addEventListener('click', guardarSesion);
    $('btn-descartar').addEventListener('click', descartarSesion);
    $('btn-agregar-ejercicio').addEventListener('click', abrirSelector);
    $('selector-cerrar').addEventListener('click', cerrarSelector);
    $('btn-pendientes').addEventListener('click', sincronizar);

    $('btn-historial').addEventListener('click', abrirHistorial);
    $('btn-hist-volver').addEventListener('click', function () { ocultar('pantalla-historial'); mostrar('pantalla-inicio'); pintarInicio(); });
    $('btn-det-volver').addEventListener('click', function () { ocultar('pantalla-detalle'); abrirHistorial(); });

    $('btn-progreso').addEventListener('click', function () { abrirProgreso(); });
    $('btn-prog-volver').addEventListener('click', function () { ocultar('pantalla-progreso'); mostrar('pantalla-inicio'); pintarInicio(); });
    $('prog-ejercicio').addEventListener('change', function () { renderProgreso(this.value); });

    $('btn-resumen').addEventListener('click', abrirResumen);
    $('btn-res-volver').addEventListener('click', function () { ocultar('pantalla-resumen'); mostrar('pantalla-inicio'); pintarInicio(); });

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
