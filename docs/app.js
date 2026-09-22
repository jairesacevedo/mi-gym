/* app.js — Mi Gym "Next Level".
 * Arquitectura multi-ventana (Tab Bar), animaciones de personas de palitos,
 * seguimiento de peso corporal, editor de rutinas personalizadas, temporizador
 * circular con audio sintético (Web Audio API) y sincronización a Google Sheets.
 */
(function () {
  'use strict';

  var CFG = window.MIGYM_CONFIG || { EXEC_URL: '', APP_SECRETO: '' };
  var CAT = window.MIGYM_CATALOGO || { sesiones: [], extras: [] };
  var ILUS = window.MIGYM_ILUSTRACIONES || {
    svgDe: function () { return ''; },
    infoDe: function (n) { return { nombre: n, musculos: { primarios: [] }, tips: [] }; }
  };

  // Claves de almacenamiento local (offline-first)
  var COLA_KEY = 'migym_cola_v1';
  var BORRADOR_KEY = 'migym_borrador_v1';
  var HIST_KEY = 'migym_historial_v1';
  var PREFS_KEY = 'migym_prefs_v2';
  var PESOS_KEY = 'migym_pesos_v1';
  var RUTINAS_KEY = 'migym_rutinas_custom_v1';
  var HIST_MAX = 400;
  var SECRETO_KEY = 'migym_secreto_v1';

  // ── 1. Estado y configuración global ───────────────────────────────────────
  var sesion = null;
  var cronoSesionInt = null;
  var descansoInt = null;
  var descansoTotal = 90;
  var descansoRestante = 0;
  var descansoPausado = false;
  var tabActual = 'entrenar';
  var rutinaEditando = null; // para el modal de edición de rutina

  var prefs = {
    rpe: false,
    notas: false,
    audioDescanso: true,
    vibrarDescanso: true,
    animaciones: true
  };

  var piesEjercicio = [];
  var progMetricaId = null;
  var resMetricaId = 'volumen';
  var recGrupo = 'Todos';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function mostrar(id) { var e = $(id); if (e) e.classList.remove('oculto'); }
  function ocultar(id) { var e = $(id); if (e) e.classList.add('oculto'); }
  function vaciar(id) { var e = $(id); if (e) e.innerHTML = ''; }

  function aviso(msg, esError) {
    var a = $('aviso');
    if (!a) return;
    a.textContent = msg;
    a.className = 'aviso' + (esError ? ' error' : '');
    setTimeout(function () { a.classList.add('oculto'); }, 2800);
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

  function slugGrupo(g) {
    var s = String(g == null ? '' : g).toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.replace(/[^a-z]/g, '');
    return ['piernas', 'empuje', 'tiron', 'pliometria', 'core'].indexOf(s) >= 0 ? s : 'otros';
  }

  function ilustracion(ej, cls) {
    var caja = el('div', 'ej-ilus' + (cls ? ' ' + cls : ''));
    caja.title = 'Toca para ver técnica animada';
    if (ej.img) {
      var img = el('img');
      img.src = ej.img; img.alt = ''; img.loading = 'lazy';
      caja.appendChild(img);
    } else {
      caja.innerHTML = ILUS.svgDe(ej.nombre || ej.ej, ej.grupo);
    }
    caja.addEventListener('click', function (ev) {
      ev.stopPropagation();
      abrirModalTecnica(ej.nombre || ej.ej, ej.grupo);
    });
    return caja;
  }

  // ── 2. Almacenamiento local y preferencias ──────────────────────────────────
  function leerCola() { try { return JSON.parse(localStorage.getItem(COLA_KEY)) || []; } catch (e) { return []; } }
  function escribirCola(c) { localStorage.setItem(COLA_KEY, JSON.stringify(c)); }

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
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY));
      if (p) {
        prefs.rpe = !!p.rpe;
        prefs.notas = !!p.notas;
        if (p.audioDescanso !== undefined) prefs.audioDescanso = !!p.audioDescanso;
        if (p.vibrarDescanso !== undefined) prefs.vibrarDescanso = !!p.vibrarDescanso;
        if (p.animaciones !== undefined) prefs.animaciones = !!p.animaciones;
      }
    } catch (e) {}
  }
  function guardarPrefs() { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }

  function obtenerSecreto() { return CFG.APP_SECRETO || localStorage.getItem(SECRETO_KEY) || ''; }
  function secretoParaSubir() {
    var s = obtenerSecreto();
    if (s) return s;
    s = (window.prompt('Clave de sincronización de Mi Gym (se guarda en este celular):') || '').trim();
    if (s) localStorage.setItem(SECRETO_KEY, s);
    return s;
  }

  function marcarSubidas(cola) {
    var ids = {}; cola.forEach(function (p) { ids[p.sesion_id] = true; });
    var hist = leerHistorial();
    hist.forEach(function (h) { if (ids[h.payload.sesion_id]) h.subida = true; });
    escribirHistorial(hist);
  }

  // ── 3. Motor de Audio Sintético (Web Audio API) ─────────────────────────────
  // Genera tonos limpios de alerta sin depender de archivos MP3 externos.
  function reproducirAlertaDescanso() {
    if (!prefs.audioDescanso) return;
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();

      var notas = [
        { f: 880, dur: 0.12, inicio: 0 },
        { f: 880, dur: 0.12, inicio: 0.15 },
        { f: 1174.66, dur: 0.28, inicio: 0.32 }
      ];

      notas.forEach(function (n) {
        var osc = ctx.createOscillator();
        var ganancia = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, ctx.currentTime + n.inicio);

        ganancia.gain.setValueAtTime(0.2, ctx.currentTime + n.inicio);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.inicio + n.dur);

        osc.connect(ganancia);
        ganancia.connect(ctx.destination);

        osc.start(ctx.currentTime + n.inicio);
        osc.stop(ctx.currentTime + n.inicio + n.dur);
      });
    } catch (e) {}
  }

  function vibrar(p) {
    if (prefs.vibrarDescanso && navigator.vibrate) {
      try { navigator.vibrate(p); } catch (e) {}
    }
  }

  // ── 4. Navegación Multi-Ventana (Tab Bar) ───────────────────────────────────
  var TABS = ['dashboard', 'rutinas', 'peso', 'progreso', 'historial'];

  function irATab(nombre) {
    tabActual = nombre;
    TABS.forEach(function (t) {
      var btn = $('tab-' + t);
      if (btn) btn.classList.toggle('activo', t === nombre);
      var pant = $('pantalla-' + t);
      if (pant) pant.classList.toggle('oculto', t !== nombre);
    });

    ocultar('pantalla-sesion');
    ocultar('pantalla-detalle');
    ocultar('pantalla-ajustes');

    // Banner de sesión activa persistente si hay entreno en marcha
    actualizarBannerSesionActiva();

    if (nombre === 'dashboard') pintarDashboard();
    else if (nombre === 'rutinas') pintarRutinasGestor();
    else if (nombre === 'peso') pintarModuloPeso();
    else if (nombre === 'progreso') abrirProgreso();
    else if (nombre === 'historial') abrirHistorial();

    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function actualizarBannerSesionActiva() {
    var banner = $('banner-sesion-activa');
    if (!banner) return;
    if (sesion && tabActual !== 'sesion') {
      $('banner-activa-tit').textContent = sesion.titulo || 'Entrenamiento en curso';
      var hechas = 0, total = 0;
      sesion.ejercicios.forEach(function (e) {
        e.series.forEach(function (s) { total++; if (s.hecha) hechas++; });
      });
      var transcurrido = fmtTiempo((Date.now() - sesion.inicio) / 1000);
      $('banner-activa-sub').textContent = transcurrido + ' · ' + hechas + '/' + total + ' series';
      mostrar('banner-sesion-activa');
    } else {
      ocultar('banner-sesion-activa');
    }
  }

  // ── 5. Módulo de Seguimiento de Peso Corporal ───────────────────────────────
  function leerPesos() {
    try { return JSON.parse(localStorage.getItem(PESOS_KEY)) || []; }
    catch (e) { return []; }
  }

  function guardarPesos(arr) {
    localStorage.setItem(PESOS_KEY, JSON.stringify(arr));
  }

  function registrarPeso(val, fecha, nota) {
    val = num(val);
    if (!val || val <= 0) { aviso('Ingresa un peso válido (ej: 75.4)', true); return; }
    fecha = fecha || new Date().toISOString().slice(0, 10);

    var lista = leerPesos();
    lista.unshift({
      id: 'peso_' + Date.now(),
      fecha: fecha,
      valor: redondear(val),
      nota: String(nota || '').trim()
    });
    // Ordenar de más reciente a más antiguo
    lista.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    guardarPesos(lista);
    aviso('Peso registrado: ' + redondear(val) + ' kg');
    pintarModuloPeso();
  }

  function borrarPeso(id) {
    if (!confirm('¿Eliminar este registro de peso?')) return;
    var lista = leerPesos().filter(function (p) { return p.id !== id; });
    guardarPesos(lista);
    pintarModuloPeso();
  }

  function pintarModuloPeso() {
    var lista = leerPesos();
    var tiles = $('peso-tiles');
    tiles.innerHTML = '';

    var inputFecha = $('peso-fecha');
    if (inputFecha && !inputFecha.value) inputFecha.value = new Date().toISOString().slice(0, 10);

    if (lista.length) {
      var actual = lista[0].valor;
      var vals = lista.map(function (p) { return p.valor; });
      var min = Math.min.apply(null, vals);
      var max = Math.max.apply(null, vals);

      // Variación en 7 días
      var hace7 = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      var registro7 = null;
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].fecha <= hace7) { registro7 = lista[i]; break; }
      }
      var delta7 = registro7 ? redondear(actual - registro7.valor) : null;
      var d7Txt = delta7 != null ? (delta7 > 0 ? '+' + delta7 : String(delta7)) + ' kg' : '—';

      tiles.appendChild(tile('Actual', actual + ' kg', fmtFechaCorta(lista[0].fecha)));
      tiles.appendChild(tile('Δ 7 días', d7Txt, registro7 ? 'vs ' + registro7.valor + ' kg' : 'primeros datos'));
      tiles.appendChild(tile('Mínimo', min + ' kg', 'histórico'));
      tiles.appendChild(tile('Máximo', max + ' kg', 'histórico'));
    } else {
      tiles.appendChild(tile('Peso', '—', 'Sin registros'));
      tiles.appendChild(tile('Meta', 'Registra', 'tu primer peso'));
    }

    // Gráfica de peso interactiva
    var chartCont = $('peso-chart');
    if (lista.length >= 2) {
      mostrar('peso-caja-chart');
      var pts = lista.slice(0, 30).reverse().map(function (p) {
        return { fecha: p.fecha, valor: p.valor };
      });
      pintarChart(chartCont, svgLinea(pts, 'kg'), 'Evolución de peso · toca un punto');
    } else {
      ocultar('peso-caja-chart');
    }

    // Lista histórica
    var contLista = $('lista-pesos');
    contLista.innerHTML = '';
    if (!lista.length) {
      contLista.innerHTML = '<p class="ayuda">Aún no has registrado pesajes. Empieza anotando tu peso de hoy.</p>';
      return;
    }

    lista.forEach(function (p, idx) {
      var item = el('div', 'item-peso');
      var izq = el('div');
      izq.appendChild(el('span', 'item-peso-val', p.valor + ' kg'));
      var sub = fmtFechaCorta(p.fecha) + (p.nota ? ' · “' + p.nota + '”' : '');
      izq.appendChild(el('div', 'item-peso-fecha', sub));
      item.appendChild(izq);

      var der = el('div', 'barra-lado');
      if (idx < lista.length - 1) {
        var dif = redondear(p.valor - lista[idx + 1].valor);
        var clsDif = dif > 0 ? 'sube' : dif < 0 ? 'baja' : 'igual';
        var txtDif = (dif > 0 ? '+' : '') + dif + ' kg';
        der.appendChild(el('span', 'item-peso-dif ' + clsDif, txtDif));
      }
      var btnDel = el('button', 'quitar-serie', '✕');
      btnDel.title = 'Eliminar registro';
      btnDel.addEventListener('click', function () { borrarPeso(p.id); });
      der.appendChild(btnDel);

      item.appendChild(der);
      contLista.appendChild(item);
    });
  }

  // ── 6. Gestor y Editor de Rutinas Personalizadas ───────────────────────────
  function leerRutinasCustom() {
    try { return JSON.parse(localStorage.getItem(RUTINAS_KEY)) || []; }
    catch (e) { return []; }
  }

  function guardarRutinasCustom(arr) {
    localStorage.setItem(RUTINAS_KEY, JSON.stringify(arr));
  }

  function todasLasRutinas() {
    var fijas = CAT.sesiones || [];
    var custom = leerRutinasCustom();
    return fijas.concat(custom);
  }

  function pintarRutinasGestor() {
    var lista = todasLasRutinas();
    var cont = $('lista-rutinas-gestor');
    cont.innerHTML = '';

    lista.forEach(function (r, rIdx) {
      var card = el('div', 'rutina-card');
      var cab = el('div', 'rutina-cab');
      var tit = el('span', 'rutina-tit', r.nombre);
      cab.appendChild(tit);
      if (r.esCustom) cab.appendChild(el('span', 'chip nuevo', 'Personalizada'));
      card.appendChild(cab);

      var nEj = r.ejercicios ? r.ejercicios.length : 0;
      var resumen = nEj > 0
        ? nEj + ' ejercicios: ' + r.ejercicios.map(function (e) { return e.nombre; }).slice(0, 3).join(', ') + (nEj > 3 ? '…' : '')
        : 'Rutina libre (selección manual)';
      card.appendChild(el('small', 'ayuda', resumen));

      if (nEj > 0) {
        var tira = el('div', 'tira-ilus');
        r.ejercicios.slice(0, 6).forEach(function (e) { tira.appendChild(ilustracion(e, 'mini')); });
        card.appendChild(tira);
      }

      var acciones = el('div', 'rutina-acciones');
      var btnIniciar = el('button', 'primario', 'Iniciar entreno');
      btnIniciar.addEventListener('click', function () { iniciarSesion(r); });
      acciones.appendChild(btnIniciar);

      var btnEditar = el('button', 'secundario', r.esCustom ? 'Editar' : 'Duplicar');
      btnEditar.addEventListener('click', function () {
        if (r.esCustom) abrirEditorRutina(r);
        else clonarYEditarRutina(r);
      });
      acciones.appendChild(btnEditar);

      if (r.esCustom) {
        var btnBorrar = el('button', 'quitar-serie', '🗑️');
        btnBorrar.title = 'Eliminar rutina';
        btnBorrar.style.width = '38px'; btnBorrar.style.height = '38px';
        btnBorrar.addEventListener('click', function () { eliminarRutinaCustom(r.id); });
        acciones.appendChild(btnBorrar);
      }

      card.appendChild(acciones);
      cont.appendChild(card);
    });
  }

  function clonarYEditarRutina(r) {
    var nueva = {
      id: 'rutina_' + Date.now(),
      nombre: r.nombre + ' (Copia)',
      esCustom: true,
      ejercicios: (r.ejercicios || []).map(function (e) {
        return {
          nombre: e.nombre, grupo: e.grupo, tipo: e.tipo || 'peso_reps',
          series: e.series || 3, reps: e.reps || '8-10', descanso: e.descanso || 90
        };
      })
    };
    abrirEditorRutina(nueva);
  }

  function eliminarRutinaCustom(id) {
    if (!confirm('¿Eliminar esta rutina personalizada?')) return;
    var list = leerRutinasCustom().filter(function (r) { return r.id !== id; });
    guardarRutinasCustom(list);
    pintarRutinasGestor();
    pintarDashboard();
  }

  function abrirEditorRutina(r) {
    rutinaEditando = JSON.parse(JSON.stringify(r || {
      id: 'rutina_' + Date.now(),
      nombre: 'Nueva rutina',
      esCustom: true,
      ejercicios: []
    }));

    $('rutina-editor-titulo').textContent = r ? 'Editar Rutina' : 'Crear Rutina';
    $('rutina-editor-nombre').value = rutinaEditando.nombre;
    pintarEjerciciosEditorRutina();
    mostrar('modal-rutina-editor');
  }

  function pintarEjerciciosEditorRutina() {
    var cont = $('rutina-editor-lista');
    cont.innerHTML = '';
    if (!rutinaEditando.ejercicios.length) {
      cont.innerHTML = '<p class="ayuda" style="text-align:center; padding: 20px 0;">Aún no has agregado ejercicios. Pulsa "+ Añadir ejercicio".</p>';
      return;
    }

    rutinaEditando.ejercicios.forEach(function (e, idx) {
      var fila = el('div', 'editor-ej-fila');
      fila.appendChild(ilustracion(e, 'mini'));

      var info = el('div', 'editor-ej-info');
      info.appendChild(el('div', 'editor-ej-nom', e.nombre));
      var sub = (e.series || 3) + ' series × ' + (e.reps || '8-10') + ' · descanso ' + (e.descanso || 90) + 's';
      info.appendChild(el('div', 'editor-ej-sub', sub));
      fila.appendChild(info);

      var btns = el('div', 'editor-ej-btns');
      if (idx > 0) {
        var up = el('button', 'btn-orden', '▲');
        up.addEventListener('click', function () {
          var tmp = rutinaEditando.ejercicios[idx - 1];
          rutinaEditando.ejercicios[idx - 1] = e;
          rutinaEditando.ejercicios[idx] = tmp;
          pintarEjerciciosEditorRutina();
        });
        btns.appendChild(up);
      }
      if (idx < rutinaEditando.ejercicios.length - 1) {
        var down = el('button', 'btn-orden', '▼');
        down.addEventListener('click', function () {
          var tmp = rutinaEditando.ejercicios[idx + 1];
          rutinaEditando.ejercicios[idx + 1] = e;
          rutinaEditando.ejercicios[idx] = tmp;
          pintarEjerciciosEditorRutina();
        });
        btns.appendChild(down);
      }
      var del = el('button', 'quitar-ej', '✕');
      del.addEventListener('click', function () {
        rutinaEditando.ejercicios.splice(idx, 1);
        pintarEjerciciosEditorRutina();
      });
      btns.appendChild(del);

      fila.appendChild(btns);
      cont.appendChild(fila);
    });
  }

  function guardarRutinaDesdeEditor() {
    var nom = $('rutina-editor-nombre').value.trim();
    if (!nom) { aviso('Escribe un nombre para la rutina', true); return; }
    rutinaEditando.nombre = nom;
    rutinaEditando.esCustom = true;

    var lista = leerRutinasCustom();
    var idx = -1;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === rutinaEditando.id) { idx = i; break; }
    }
    if (idx >= 0) lista[idx] = rutinaEditando;
    else lista.push(rutinaEditando);

    guardarRutinasCustom(lista);
    ocultar('modal-rutina-editor');
    aviso('Rutina guardada: ' + nom);
    pintarRutinasGestor();
    pintarDashboard();
  }

  // ── 7. Modal de Técnica y Monigote Animado ──────────────────────────────────
  function abrirModalTecnica(nombre, grupo) {
    var info = ILUS.infoDe(nombre, grupo);
    $('tecnica-nombre').textContent = info.nombre;
    $('tecnica-grupo').textContent = info.grupo;
    $('tecnica-grupo').className = 'chip g-' + slugGrupo(info.grupo);

    var box = $('tecnica-ilus-box');
    box.innerHTML = ILUS.svgDe(info.nombre, info.grupo, 'jumbo');

    // Botones de control
    var btnPlay = $('btn-tecnica-play');
    var btnSlow = $('btn-tecnica-slow');
    btnPlay.classList.add('on'); btnPlay.textContent = '⏸ Pausar';
    btnSlow.classList.remove('on');

    btnPlay.onclick = function () {
      var svgEl = box.querySelector('svg');
      if (!svgEl) return;
      var pausado = svgEl.classList.toggle('pausado');
      btnPlay.classList.toggle('on', !pausado);
      btnPlay.textContent = pausado ? '▶ Reanudar' : '⏸ Pausar';
    };

    btnSlow.onclick = function () {
      var svgEl = box.querySelector('svg');
      if (!svgEl) return;
      var lento = svgEl.classList.toggle('lento');
      btnSlow.classList.toggle('on', lento);
    };

    $('btn-tecnica-prog').onclick = function () {
      ocultar('modal-tecnica');
      irATab('progreso');
      abrirProgreso(info.nombre);
    };

    // Músculos trabajados
    var musCont = $('tecnica-musculos');
    musCont.innerHTML = '';
    (info.musculos.primarios || []).forEach(function (m) {
      musCont.appendChild(el('span', 'chip-musculo', m));
    });
    (info.musculos.secundarios || []).forEach(function (m) {
      musCont.appendChild(el('span', 'chip-musculo sec', m));
    });

    // Pautas técnicas
    var tipsCont = $('tecnica-tips');
    tipsCont.innerHTML = '';
    (info.tips || []).forEach(function (t) {
      tipsCont.appendChild(el('li', null, t));
    });

    mostrar('modal-tecnica');
  }

  // ── 8. Temporizador de Descanso Circular Flotante ───────────────────────────
  function iniciarDescanso(seg, nombreEj) {
    descansoTotal = seg || 90;
    descansoRestante = descansoTotal;
    descansoPausado = false;
    $('descanso-pausa').textContent = 'Pausar';
    $('descanso-ej-nom').textContent = nombreEj ? 'Siguiente: ' + nombreEj : 'Tiempo de descanso';

    mostrar('descanso');
    actualizarDescansoUI();

    clearInterval(descansoInt);
    descansoInt = setInterval(function () {
      if (!descansoPausado) {
        descansoRestante--;
        actualizarDescansoUI();
        if (descansoRestante <= 0) finDescanso();
      }
    }, 1000);
  }

  function actualizarDescansoUI() {
    $('descanso-tiempo').textContent = fmtTiempo(descansoRestante);
    var ring = $('descanso-ring-fg');
    if (ring) {
      var totalCirc = 207.34;
      var frac = Math.max(0, descansoRestante / (descansoTotal || 1));
      var offset = totalCirc * (1 - frac);
      ring.style.strokeDashoffset = offset;
      if (descansoRestante <= 10) ring.style.stroke = 'var(--oro)';
      else ring.style.stroke = 'var(--aqua-brillante)';
    }
  }

  function finDescanso() {
    clearInterval(descansoInt);
    var d = $('descanso');
    d.classList.add('suena');
    reproducirAlertaDescanso();
    vibrar([250, 100, 250]);
    setTimeout(function () {
      d.classList.remove('suena');
      ocultar('descanso');
    }, 2200);
  }

  // ── 9. Consultas al Historial y Estadísticas ────────────────────────────────
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

  function inicioSemana(d) {
    var x = new Date(d); var lun = (x.getDay() + 6) % 7;
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

  function ultimasSemanas(n) {
    var out = [], ini = inicioSemana(new Date());
    for (var i = n - 1; i >= 0; i--) {
      var desde = new Date(ini.getTime() - i * 7 * 864e5);
      var hasta = new Date(desde.getTime() + 7 * 864e5);
      out.push({ desde: desde, hasta: hasta, etq: fmtDiaMes(desde), agg: agregarSemana(desde, hasta) });
    }
    return out;
  }

  function rachaSemanas() {
    var ini = inicioSemana(new Date()), racha = 0, i = 0;
    for (;;) {
      var desde = new Date(ini.getTime() - i * 7 * 864e5);
      var hasta = new Date(desde.getTime() + 7 * 864e5);
      var n = agregarSemana(desde, hasta).nSesiones;
      if (n > 0) racha++;
      else if (i > 0) break;
      else if (i === 0) { i++; continue; }
      i++;
      if (i > 104) break;
    }
    return racha;
  }

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
        if (!antes.visto) return;
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
    return [
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

  function serieDeMetrica(nombre, metrica) {
    var pts = [];
    historialAsc().forEach(function (h) {
      var sets = h.payload.sets.filter(function (s) { return s.ej === nombre; });
      if (!sets.length) return;
      pts.push({ fecha: h.payload.fecha, valor: metrica.calc(sets), sets: sets, titulo: h.payload.titulo });
    });
    return pts;
  }

  // ── 10. Gráficas SVG Inline ────────────────────────────────────────────────
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
      var y = Math.round(Y(v));
      rejilla += '<line class="grid" x1="' + pl + '" y1="' + y + '" x2="' + (W - pr) + '" y2="' + y + '"/>' +
        '<text class="lbl" x="' + (pl - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + esc(fmtVal(v, '')) + '</text>';
    });

    var dLinea = '', dArea = '';
    pts.forEach(function (p, i) {
      var x = Math.round(X(i)), y = Math.round(Y(p.valor));
      dLinea += (i === 0 ? 'M' : 'L') + x + ' ' + y;
      dArea += (i === 0 ? 'M' + x + ' ' + Math.round(Y(lo)) + 'L' + x + ' ' + y : 'L' + x + ' ' + y);
    });
    if (pts.length) dArea += 'L' + Math.round(X(pts.length - 1)) + ' ' + Math.round(Y(lo)) + 'Z';

    var puntos = '';
    pts.forEach(function (p, i) {
      var x = Math.round(X(i)), y = Math.round(Y(p.valor));
      var esUlt = i === pts.length - 1;
      var esMax = p.valor === max;
      puntos += '<circle class="pt' + (esUlt ? ' ult' : '') + '" cx="' + x + '" cy="' + y + '" r="' + (esUlt ? 4.5 : 3.5) + '"' +
        ' data-detalle="' + esc(fmtDiaMes(p.fecha) + ': ' + fmtVal(p.valor, unidad)) + '"/>';
      if (esUlt || esMax) {
        puntos += '<text class="val' + (esUlt ? '' : ' tenue') + '" x="' + x + '" y="' + (y - 7) + '" text-anchor="middle">' +
          esc(fmtVal(p.valor, '')) + '</text>';
      }
    });

    var fechas = '';
    if (pts.length) {
      fechas += '<text class="lbl" x="' + Math.round(X(0)) + '" y="' + (H - 6) + '" text-anchor="start">' + esc(fmtDiaMes(pts[0].fecha)) + '</text>';
      if (pts.length > 1) {
        fechas += '<text class="lbl" x="' + Math.round(X(pts.length - 1)) + '" y="' + (H - 6) + '" text-anchor="end">' +
          esc(fmtDiaMes(pts[pts.length - 1].fecha)) + '</text>';
      }
    }

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + rejilla +
      (dArea ? '<path class="area" d="' + dArea + '"/>' : '') +
      (dLinea ? '<path class="linea" d="' + dLinea + '"/>' : '') +
      puntos + fechas + '</svg>';
  }

  function svgBarras(items, unidad) {
    var W = 320, H = 140, pl = 16, pr = 16, pt = 16, pb = 22;
    var vals = items.map(function (it) { return it.valor; });
    var max = Math.max.apply(null, vals.concat([1]));
    var n = items.length || 1;
    var iw = W - pl - pr, ih = H - pt - pb;
    var rancho = iw / n;
    var anchoBarra = Math.max(8, rancho * 0.58);

    var barras = '', etiquetas = '';
    items.forEach(function (it, i) {
      var h = max ? (it.valor / max) * ih : 0;
      var x = pl + rancho * i + (rancho - anchoBarra) / 2;
      var y = pt + (ih - h);
      var cx = pl + rancho * i + rancho / 2;
      barras += '<rect class="barra' + (it.destacado ? ' act' : '') + '" x="' + Math.round(x) + '" y="' + Math.round(y) +
        '" width="' + Math.round(anchoBarra) + '" height="' + Math.max(2, Math.round(h)) + '"' +
        ' data-detalle="' + esc(it.etq + ': ' + fmtVal(it.valor, unidad)) + '"/>';
      etiquetas += '<text class="lbl" x="' + Math.round(cx) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(it.etq) + '</text>';
      if (it.valor > 0 && it.destacado) {
        barras += '<text class="val" x="' + Math.round(cx) + '" y="' + Math.round(y - 4) + '" text-anchor="middle">' + esc(fmtVal(it.valor, '')) + '</text>';
      }
    });

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' +
      '<line class="cero" x1="' + pl + '" y1="' + (pt + ih) + '" x2="' + (W - pr) + '" y2="' + (pt + ih) + '"/>' +
      barras + etiquetas + '</svg>';
  }

  function svgSpark(items) {
    var W = 280, H = 46, max = Math.max.apply(null, items.map(function (it) { return it.valor; }).concat([1]));
    var n = items.length || 1, rancho = W / n, bw = Math.max(5, rancho * 0.55);
    var barras = '';
    items.forEach(function (it, i) {
      var h = max ? (it.valor / max) * (H - 4) : 0;
      var x = rancho * i + (rancho - bw) / 2;
      barras += '<rect class="barra' + (it.destacado ? ' act' : '') + '" x="' + Math.round(x) + '" y="' + Math.round(H - h) +
        '" width="' + Math.round(bw) + '" height="' + Math.max(2, Math.round(h)) + '"/>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + barras + '</svg>';
  }

  function pintarChart(cont, svgStr, pieDefecto) {
    if (!cont) return;
    if (cont._migym) cont.removeEventListener('click', cont._migym);
    cont.innerHTML = svgStr + '<small class="chart-pie">' + esc(pieDefecto || '') + '</small>';
    var pie = cont.querySelector('.chart-pie');
    cont._migym = function (ev) {
      var n = ev.target;
      while (n && n !== cont && !(n.getAttribute && n.getAttribute('data-detalle'))) n = n.parentNode;
      if (n && n !== cont && pie) pie.textContent = n.getAttribute('data-detalle');
    };
    cont.addEventListener('click', cont._migym);
  }

  function tile(label, valor, extra, cls) {
    var c = el('div', 'tile' + (cls ? ' ' + cls : ''));
    c.appendChild(el('span', 'tile-label', label));
    c.appendChild(el('span', 'tile-num', valor));
    if (extra) c.appendChild(el('span', 'tile-extra', extra));
    return c;
  }

  function filaGrupo(nombre, actual, previo, max) {
    var fila = el('div', 'grupo-fila g-' + slugGrupo(nombre));
    var cab = el('div', 'grupo-cab');
    cab.appendChild(el('span', 'grupo-nom', nombre));
    cab.appendChild(el('span', 'grupo-val', actual + ' series'));
    cab.appendChild(deltaChip(actual, previo, ''));
    fila.appendChild(cab);

    var pista = el('div', 'grupo-pista');
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

  // ── 11. Dashboard Interactivo (Panel Principal) ─────────────────────────────
  function pintarDashboard() {
    var h = new Date().getHours();
    var saludoTxt = h < 12 ? '¡Buenos días! ☀️' : (h < 19 ? '¡Buenas tardes! 💪' : '¡Buenas noches! 🌙');
    $('dash-saludo').textContent = saludoTxt;
    $('dash-fecha-hoy').textContent = fmtFechaCorta(new Date()) + ' · Hoy es un gran día para entrenar';

    var racha = rachaSemanas();
    $('dash-racha').textContent = '🔥 ' + racha + (racha === 1 ? ' semana' : ' semanas');

    // 1. Matriz interactiva de días de la semana (L M X J V S D)
    var lun = inicioSemana(new Date());
    var hist = leerHistorial();
    var diasCont = $('dash-dias-semana');
    diasCont.innerHTML = '';
    var letras = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    for (var d = 0; d < 7; d++) {
      var fechaDia = new Date(lun.getTime() + d * 864e5);
      var isoDia = fechaDia.toISOString().slice(0, 10);
      var esHoy = fechaDia.toDateString() === new Date().toDateString();
      var sesionesDia = hist.filter(function (s) {
        return new Date(s.payload.fecha).toISOString().slice(0, 10) === isoDia;
      });
      var entrenado = sesionesDia.length > 0;
      var cardDia = el('div', 'dash-dia-card' + (esHoy ? ' hoy' : '') + (entrenado ? ' entrenado' : ''));
      cardDia.appendChild(el('span', 'dash-dia-letra', letras[d]));
      cardDia.appendChild(el('span', 'dash-dia-num', String(fechaDia.getDate())));
      cardDia.appendChild(el('span', 'dash-dia-dot'));
      if (entrenado) {
        cardDia.title = sesionesDia.map(function (s) { return s.payload.titulo; }).join(', ');
        cardDia.addEventListener('click', function () { irATab('historial'); });
      }
      diasCont.appendChild(cardDia);
    }

    // 2. Tarjeta Hero (Sesión en curso o rutina recomendada para hoy)
    var hero = $('dash-hero-box');
    hero.innerHTML = '';
    if (sesion) {
      var sub = el('div', 'dash-hero-sub', '⚡ ENTRENAMIENTO EN CURSO');
      var tit = el('div', 'dash-hero-tit', sesion.titulo || 'Sesión activa');
      var hechas = 0, total = 0;
      sesion.ejercicios.forEach(function (e) {
        e.series.forEach(function (s) { total++; if (s.hecha) hechas++; });
      });
      var desc = el('div', 'dash-hero-desc', fmtTiempo((Date.now() - sesion.inicio) / 1000) + ' transcurridos · ' + hechas + '/' + total + ' series hechas');
      var btn = el('button', 'dash-hero-btn', 'Continuar entrenamiento ›');
      btn.onclick = abrirSesion;
      hero.appendChild(sub); hero.appendChild(tit); hero.appendChild(desc); hero.appendChild(btn);
    } else {
      var sugNombre = sesionSugerida();
      var sugRutina = todasLasRutinas().filter(function (r) { return r.nombre === sugNombre; })[0] || todasLasRutinas()[0];
      var sub = el('div', 'dash-hero-sub', '🎯 RUTINA SUGERIDA DE HOY');
      var tit = el('div', 'dash-hero-tit', sugRutina ? sugRutina.nombre : 'Sesión Libre');
      var nEjs = sugRutina && sugRutina.ejercicios ? sugRutina.ejercicios.length : 0;
      var desc = el('div', 'dash-hero-desc', nEjs > 0 ? nEjs + ' ejercicios preparados · ritmo ideal' : 'Diseña tu sesión del día a tu gusto');
      var btn = el('button', 'dash-hero-btn', 'Empezar ' + (sugRutina ? sugRutina.nombre : 'ahora') + ' ›');
      btn.onclick = function () { iniciarSesion(sugRutina); };
      hero.appendChild(sub); hero.appendChild(tit); hero.appendChild(desc); hero.appendChild(btn);
    }

    // 3. KPIs interactivos de la semana
    var sem = ultimasSemanas(8);
    var esta = sem[sem.length - 1].agg;
    var ant = sem[sem.length - 2].agg;
    var kpis = $('dash-kpis');
    kpis.innerHTML = '';
    kpis.appendChild(tarjetaMetrica('Volumen', esta.volumen, ant.volumen, 'kg'));
    kpis.appendChild(tarjetaMetrica('Series', esta.nSeries, ant.nSeries, ''));
    kpis.appendChild(tarjetaMetrica('Sesiones', esta.nSesiones, ant.nSesiones, ''));
    kpis.appendChild(tarjetaMetrica('Tiempo', esta.tiempoMin, ant.tiempoMin, 'min'));

    // 4. Gráfica interactiva de 8 semanas
    var items = sem.map(function (s, i) {
      return { etq: s.etq, valor: s.agg.volumen, destacado: i === sem.length - 1 };
    });
    pintarChart($('dash-chart-vol'), svgBarras(items, 'kg'), 'Volumen semanal en kilogramos · toca una barra');

    // 5. Balance muscular semanal
    var contBalance = $('dash-balance-muscular');
    contBalance.innerHTML = '';
    var dist = barraDistribucion(esta.grupos);
    if (dist) contBalance.appendChild(dist);
    else contBalance.appendChild(el('p', 'ayuda', 'Registra tu primera sesión de esta semana para ver la distribución muscular.'));

    var faltan = ['Piernas', 'Empuje', 'Tirón'].filter(function (g) { return !esta.grupos[g]; });
    if (esta.nSesiones > 0 && faltan.length > 0) {
      var avisoB = el('div', 'res-aviso', '⚠️ Aún sin tocar esta semana: ' + faltan.join(', ') + '. ¡Prográmalo para un balance óptimo!');
      contBalance.appendChild(avisoB);
    }

    // 6. Tip del día con Monigote Animado
    var tipCard = $('dash-tip-card');
    tipCard.innerHTML = '';
    var tipsPool = [
      { nombre: 'Bench Press', grupo: 'Empuje', tip: 'Retrae las escápulas y apoya bien los pies. Baja con codos a 45° para proteger los hombros.' },
      { nombre: 'Sentadilla', grupo: 'Piernas', tip: 'Inicia con cadera hacia atrás y mantén el pecho alto. Empuja con todo el pie al subir.' },
      { nombre: 'Straight Leg Deadlift', grupo: 'Piernas', tip: 'Bisagra de cadera limpia con barra rozando las piernas y espalda neutra.' },
      { nombre: 'Assisted Pull-up', grupo: 'Tirón', tip: 'Activa las escápulas hacia abajo antes de tirar con los brazos para reclutar los dorsales.' },
      { nombre: 'Plancha', grupo: 'Core', tip: 'Aprieta glúteos y contrae el abdomen. Mantén una línea recta de la cabeza a los talones.' },
      { nombre: 'Triceps Pushdown', grupo: 'Empuje', tip: 'Pega los codos al torso y no los muevas. Bloquea abajo apretando el tríceps un segundo.' }
    ];
    var idxTip = (new Date().getDate() + new Date().getMonth() * 31) % tipsPool.length;
    var tipDelDia = tipsPool[idxTip];
    tipCard.appendChild(ilustracion({ nombre: tipDelDia.nombre, grupo: tipDelDia.grupo }));
    var txtBox = el('div', 'dash-tip-txt');
    txtBox.appendChild(el('span', 'dash-tip-badge', 'Técnica de hoy · ' + tipDelDia.nombre));
    txtBox.appendChild(el('div', 'dash-tip-desc', tipDelDia.tip));
    tipCard.appendChild(txtBox);
    tipCard.onclick = function () {
      abrirModalTecnica(tipDelDia.nombre, tipDelDia.grupo);
    };

    actualizarBannerSesionActiva();
  }

  function sesionSugerida() {
    var conPlan = todasLasRutinas().filter(function (s) { return s.ejercicios && s.ejercicios.length; });
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

  // ── 12. Sesión en Curso (Entrenamiento Activo) ──────────────────────────────
  var INC_KG = 2.5;

  function iniciarSesion(plantilla) {
    if (sesion && !confirm('Tienes un entrenamiento en curso. ¿Descartarlo y empezar este nuevo?')) return;
    sesion = {
      sesion_id: nuevoId(),
      inicio: Date.now(),
      titulo: plantilla.nombre,
      peso_hoy: '',
      ejercicios: (plantilla.ejercicios || []).map(clonarEjercicio),
    };
    guardarBorrador();
    abrirSesion();
  }

  function clonarEjercicio(e) {
    var ej = {
      nombre: e.nombre, grupo: e.grupo, tipo: e.tipo || 'peso_reps', reps: e.reps || '', img: e.img || '',
      guia: (e.series || '') + ' × ' + (e.reps || '') + ' · descanso ' + fmtTiempo(e.descanso || 90),
      descanso: e.descanso || 90, nuevo: !!e.nuevo, nota: '', series: [],
    };
    var n = e.series || 1;
    for (var i = 0; i < n; i++) ej.series.push(nuevaSerie());
    return ej;
  }

  function nuevaSerie() {
    return { peso: '', reps: '', altura_cm: '', segundos: '', rpe: '', tag: 'N', hecha: false };
  }
  function nuevoId() { return new Date().toISOString(); }

  function abrirSesion() {
    tabActual = 'sesion';
    TABS.forEach(function (t) {
      var btn = $('tab-' + t); if (btn) btn.classList.remove('activo');
      ocultar('pantalla-' + t);
    });
    ocultar('pantalla-detalle');
    ocultar('pantalla-ajustes');
    ocultar('banner-sesion-activa');

    mostrar('pantalla-sesion');
    $('titulo-sesion').textContent = sesion.titulo;
    $('chip-rpe').classList.toggle('on', prefs.rpe);
    $('chip-notas').classList.toggle('on', prefs.notas);
    pintarEjercicios();
    arrancarCronoSesion();
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function arrancarCronoSesion() {
    clearInterval(cronoSesionInt);
    cronoSesionInt = setInterval(function () {
      if (sesion) {
        var trans = fmtTiempo((Date.now() - sesion.inicio) / 1000);
        $('crono-sesion').textContent = trans;
        actualizarBannerSesionActiva();
      }
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
      nota.placeholder = 'Nota (sensaciones, máquina, ajuste…)';
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

    // Botón interactivo de etiqueta de serie (Normal -> Calentamiento -> Drop Set -> Fallo)
    var btnTag = el('button', 'btn-tag-serie', serie.tag || String(si + 1));
    btnTag.title = 'Tipo de serie (Normal, C: Calentamiento, D: Drop Set, F: Fallo)';
    if (serie.tag && serie.tag !== 'N') {
      btnTag.classList.add('tag-' + serie.tag);
      btnTag.textContent = serie.tag;
    } else {
      btnTag.textContent = String(si + 1);
    }
    btnTag.addEventListener('click', function () {
      var tags = ['N', 'W', 'D', 'F'];
      var curIdx = tags.indexOf(serie.tag || 'N');
      var sig = tags[(curIdx + 1) % tags.length];
      serie.tag = sig;
      btnTag.className = 'btn-tag-serie' + (sig !== 'N' ? ' tag-' + sig : '');
      btnTag.textContent = sig === 'N' ? String(si + 1) : sig;
      guardarBorrador();
    });
    fila.appendChild(btnTag);

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
      if (serie.hecha) iniciarDescanso(ej.descanso, ej.nombre);
    });
    fila.appendChild(check);

    var borrar = el('button', 'quitar-serie', '✕');
    borrar.title = 'Quitar esta serie';
    borrar.setAttribute('aria-label', 'Quitar serie ' + (si + 1));
    borrar.disabled = ej.series.length <= 1;
    borrar.addEventListener('click', function () { quitarSerie(ej, si); });
    fila.appendChild(borrar);

    revisar();
    return fila;
  }

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

  function esPR(stats, serie, tipo) {
    if (!stats || !stats.ultima) return false;
    var p = num(serie.peso) || 0, r = num(serie.reps) || 0, a = num(serie.altura_cm) || 0, g = num(serie.segundos) || 0;
    if (tipo === 'peso_reps') return p > 0 && r > 0 && (p > stats.mejorPeso + 1e-9 || p * (1 + r / 30) > stats.mejorE1rm + 1e-9);
    if (tipo === 'pliometria') return a > 0 ? a > stats.mejorAltura + 1e-9 : r > stats.mejorReps;
    if (tipo === 'reps') return r > stats.mejorReps;
    if (tipo === 'tiempo') return g > stats.mejorSeg;
    return false;
  }

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
    var barra = $('sesion-barra-prog');
    if (barra && barra.firstChild) {
      barra.firstChild.style.width = (total ? hechas / total * 100 : 0) + '%';
    }

    piesEjercicio.forEach(function (ref) {
      var hoyVol = volumenSets(ref.ej.series.map(function (s) {
        return { peso: num(s.peso) || 0, reps: num(s.reps) || 0 };
      }));
      var hechasEj = ref.ej.series.filter(function (s) { return s.hecha; }).length;
      var antVol = ref.prev ? volumenSets(ref.prev.sets) : 0;
      var txt = 'Hoy: ' + hechasEj + '/' + ref.ej.series.length + ' series';
      if (hoyVol > 0 || antVol > 0) {
        txt += ' · ' + miles(hoyVol) + (antVol > 0 ? ' / ' + miles(antVol) : '') + ' kg';
        if (antVol > 0) txt += ' de la vez pasada';
      }
      ref.nodo.textContent = txt;
    });

    actualizarBannerSesionActiva();
  }

  // ── 13. Selector de Ejercicios del Catálogo ─────────────────────────────────
  function abrirSelector(cbAlElegir) {
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
            cerrarSelector();
            if (cbAlElegir) cbAlElegir(e);
            else if (sesion) {
              sesion.ejercicios.push(clonarEjercicio(e));
              guardarBorrador();
              pintarEjercicios();
            }
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
    todasLasRutinas().forEach(function (s) {
      (s.ejercicios || []).forEach(function (e) {
        if (!vistos[e.nombre]) { vistos[e.nombre] = 1; out.push(e); }
      });
    });
    (CAT.extras || []).forEach(function (e) {
      if (!vistos[e.nombre]) { vistos[e.nombre] = 1; out.push(e); }
    });
    ejerciciosDeHistorial().forEach(function (e) {
      if (!vistos[e.nombre]) {
        vistos[e.nombre] = 1;
        out.push({ nombre: e.nombre, grupo: e.grupo, tipo: e.tipo, series: 3, reps: '8-10', descanso: 90 });
      }
    });
    out.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
    return out;
  }

  // ── 14. Historial, Detalle y Resumen ─────────────────────────────────────────
  function abrirHistorial() {
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
    card.appendChild(el('small', null, fmtFecha(p.fecha) + ' · ' + statsSesion(p)));

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

    TABS.forEach(function (t) { ocultar('pantalla-' + t); });
    mostrar('pantalla-detalle');

    $('detalle-titulo').textContent = p.titulo || 'Sesión';
    $('detalle-sub').textContent = fmtFecha(p.fecha) + (h.subida ? ' · ✓ subida al Sheet' : ' · ↑ pendiente de subir');

    var ejs = agruparPorEjercicio(p.sets);
    var vol = volumenSets(p.sets);
    var reps = p.sets.reduce(function (m, s) { return m + (num(s.reps) || 0); }, 0);

    var tiles = $('detalle-tiles'); tiles.innerHTML = '';
    tiles.appendChild(tile('Duración', (p.durMin || 0) + '', 'minutos'));
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
      bp.addEventListener('click', function (ev) {
        ev.stopPropagation();
        irATab('progreso');
        abrirProgreso(g.ej);
      });
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
      irATab('historial');
    };
  }

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

  function abrirResumen() {
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

    var descub = ['Piernas', 'Empuje', 'Tirón'].filter(function (g) { return !esta.grupos[g]; });
    if (descub.length) {
      $('res-descubiertos').textContent = '⚠️ Sin tocar esta semana: ' + descub.join(', ');
      $('res-descubiertos').classList.remove('oculto');
    }

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

    var claves = Object.keys(esta.grupos).concat(Object.keys(ant.grupos));
    var vistos = {}, grupos = [];
    ['Piernas', 'Empuje', 'Tirón', 'Pliometría', 'Core', 'Otros'].forEach(function (g) {
      if (claves.indexOf(g) >= 0 && !vistos[g]) { vistos[g] = 1; grupos.push(g); }
    });
    claves.forEach(function (g) { if (!vistos[g]) { vistos[g] = 1; grupos.push(g); } });
    if (grupos.length) {
      $('res-h-grupos').classList.remove('oculto');
      var max = grupos.reduce(function (m, g) { return Math.max(m, esta.grupos[g] || 0, ant.grupos[g] || 0); }, 0);
      var cont = $('res-grupos');
      grupos.forEach(function (g) { cont.appendChild(filaGrupo(g, esta.grupos[g] || 0, ant.grupos[g] || 0, max)); });
    }

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
    var c = el('div', 'tile');
    c.appendChild(el('span', 'tile-label', label));
    c.appendChild(el('span', 'tile-num', miles(actual) + (unidad ? ' ' + unidad : '')));
    c.appendChild(deltaChip(actual, previo, unidad));
    c.appendChild(el('span', 'tile-extra', 'anterior ' + miles(previo)));
    return c;
  }

  // ── 15. Progreso por Ejercicio y Salón de PRs ────────────────────────────────
  function abrirProgreso(preselec) {
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
    progMetricaId = null;
    renderProgreso(sel.value);
    abrirRecords();
  }

  function renderProgreso(nombre) {
    var st = statsEjercicio(nombre);
    var metricas = metricasDe(st.tipo);
    var metrica = metricas.filter(function (m) { return m.id === progMetricaId; })[0] || metricas[0];
    progMetricaId = metrica.id;

    var progIlus = $('prog-ilus');
    progIlus.innerHTML = ILUS.svgDe(nombre, st.grupo);
    progIlus.onclick = function () { abrirModalTecnica(nombre, st.grupo); };

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
      resumen.appendChild(el('span', 'res-delta ' + (dif > 0 ? 'sube' : dif < 0 ? 'baja' : ''),
        signo + dif + ' ' + metrica.unidad + (pct != null ? ' (' + (pct >= 0 ? '+' : '') + pct + '%)' : '')));
    }
    resumen.appendChild(el('small', null, 'desde ' + fmtDiaMes(pts[0].fecha)));

    pintarChart($('prog-chart'), svgLinea(pts, metrica.unidad),
      metrica.etq + ' por sesión · toca un punto para ver fecha y valor');

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

    var esFuerza = st.tipo === 'peso_reps';
    var barras = pts.slice(-8).map(function (p, i, arr) {
      var v = esFuerza ? Math.round(volumenSets(p.sets)) : p.sets.reduce(function (m, s) { return m + (num(s.reps) || 0); }, 0);
      return { etq: fmtDiaMes(p.fecha), valor: v, destacado: i === arr.length - 1 };
    });
    $('prog-h-vol').classList.remove('oculto');
    $('prog-h-vol').textContent = esFuerza ? 'Volumen por sesión' : 'Reps totales por sesión';
    pintarChart($('prog-chart2'), svgBarras(barras, esFuerza ? 'kg' : 'reps'),
      'Últimas ' + barras.length + ' sesiones · toca una barra');

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

  function abrirRecords() {
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
        var fila = el('button', 'tarjeta');
        fila.style.display = 'flex'; fila.style.alignItems = 'center'; fila.style.gap = '12px'; fila.style.padding = '12px';
        fila.appendChild(ilustracion(e, 'mini'));
        var t = el('div', 'rec-txt');
        t.appendChild(el('span', 'rec-nom', e.nombre));
        t.appendChild(el('small', null, st.nSesiones + ' sesiones · PR ' + (st.fechaMejor ? fmtDiaMes(st.fechaMejor) : '—')));
        fila.appendChild(t);
        fila.appendChild(el('span', 'chip sug', recMarca_(st)));
        fila.addEventListener('click', function () {
          $('subtab-prog-ej').click();
          $('prog-ejercicio').value = e.nombre;
          renderProgreso(e.nombre);
        });
        cont.appendChild(fila);
      });
  }

  function recMarca_(st) {
    if (st.tipo === 'peso_reps') return (st.mejorPeso || 0) + ' kg' + (st.mejorE1rm ? ' (e1RM ' + st.mejorE1rm + ')' : '');
    if (st.tipo === 'pliometria') return st.mejorAltura ? st.mejorAltura + ' cm' : (st.mejorReps || 0) + ' reps';
    if (st.tipo === 'tiempo') return (st.mejorSeg || 0) + ' s';
    return (st.mejorReps || 0) + ' reps';
  }

  // ── 16. Guardar Sesión y Sincronización ─────────────────────────────────────
  function guardarSesion() {
    var payload = construirPayload();
    if (!payload.sets.length) { aviso('No hay series con datos para guardar.', true); return; }

    // Si el usuario anotó su peso corporal hoy, registrarlo automáticamente en el Body Tracker
    var inputPesoSesion = $('input-peso-sesion');
    if (inputPesoSesion && inputPesoSesion.value) {
      registrarPeso(inputPesoSesion.value, new Date().toISOString().slice(0, 10), 'En sesión: ' + sesion.titulo);
    }

    var cola = leerCola();
    cola.push(payload);
    escribirCola(cola);

    var hist = leerHistorial();
    hist.unshift({ payload: payload, subida: false, guardadaEn: Date.now() });
    escribirHistorial(hist.slice(0, HIST_MAX));

    localStorage.removeItem(BORRADOR_KEY);
    clearInterval(cronoSesionInt);
    sesion = null;

    irATab('dashboard');
    aviso('¡Sesión guardada! Sincronizando…');
    sincronizar();
  }

  function construirPayload() {
    var sets = [];
    sesion.ejercicios.forEach(function (ej) {
      ej.series.forEach(function (serie, si) {
        var reps = num(serie.reps);
        var segundos = num(serie.segundos);
        var repsEfectivas = reps != null ? reps : (segundos != null ? 1 : null);
        if (repsEfectivas == null || repsEfectivas <= 0) return;

        // Si la serie tiene etiqueta especial (Calentamiento, Drop Set, Fallo), reflejarla en la nota
        var tagPrefijo = '';
        if (serie.tag === 'W') tagPrefijo = '[Calentamiento] ';
        else if (serie.tag === 'D') tagPrefijo = '[Drop Set] ';
        else if (serie.tag === 'F') tagPrefijo = '[Al Fallo] ';

        sets.push({
          ej: ej.nombre, grupo: ej.grupo, tipo: ej.tipo, serie: si + 1,
          peso: num(serie.peso) != null ? num(serie.peso) : 0,
          reps: repsEfectivas,
          altura_cm: num(serie.altura_cm),
          segundos: segundos,
          rpe: num(serie.rpe),
          nota: (tagPrefijo + (ej.nota || '')).trim(),
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
      aviso('Guardado localmente. Configura EXEC_URL para subir al Sheet.');
      actualizarPendientes();
      return;
    }
    if (!navigator.onLine) { marcarEstado('sinc'); actualizarPendientes(); return; }

    marcarEstado('sinc');
    fetch(CFG.EXEC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secreto: secretoParaSubir(), sesiones: cola }),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          escribirCola([]);
          marcarSubidas(cola);
          marcarEstado('ok');
          aviso('Subido: ' + (res.sesiones || cola.length) + ' sesión(es) a Google Sheets.');
        } else {
          marcarEstado('error');
          if (/autoriz/i.test((res && res.error) || '')) {
            localStorage.removeItem(SECRETO_KEY);
            aviso('Clave incorrecta. Se pedirá de nuevo al reintentar.', true);
          } else {
            aviso('Servidor Apps Script: ' + (res && res.error || '?'), true);
          }
        }
        actualizarPendientes();
      })
      .catch(function () {
        marcarEstado('error');
        aviso('Sin conexión a internet. Reintentando después.', true);
        actualizarPendientes();
      });
  }

  function marcarEstado(clase) {
    var e = $('estado');
    if (!e) return;
    e.className = 'estado ' + clase;
  }

  function recuperarBorrador() {
    try {
      var b = JSON.parse(localStorage.getItem(BORRADOR_KEY));
      if (b && b.ejercicios) {
        sesion = b;
        abrirSesion();
        aviso('Retomando sesión en curso.');
      }
    } catch (e) {}
  }

  function descartarSesion() {
    if (!confirm('¿Descartar esta sesión sin guardar?')) return;
    clearInterval(cronoSesionInt);
    sesion = null;
    localStorage.removeItem(BORRADOR_KEY);
    irATab('dashboard');
    aviso('Sesión descartada.');
  }

  // ── 17. Ajustes, Backup y Configuración ─────────────────────────────────────
  function pintarAjustes() {
    TABS.forEach(function (t) { ocultar('pantalla-' + t); });
    ocultar('pantalla-sesion');
    ocultar('pantalla-detalle');
    mostrar('pantalla-ajustes');

    $('btn-ajuste-audio').textContent = prefs.audioDescanso ? 'Activado' : 'Silenciado';
    $('btn-ajuste-audio').classList.toggle('on', prefs.audioDescanso);

    $('btn-ajuste-vibrar').textContent = prefs.vibrarDescanso ? 'Activada' : 'Desactivada';
    $('btn-ajuste-vibrar').classList.toggle('on', prefs.vibrarDescanso);

    $('btn-ajuste-anim').textContent = prefs.animaciones ? 'Activadas' : 'Pausadas';
    $('btn-ajuste-anim').classList.toggle('on', prefs.animaciones);

    $('ajustes-sync-status').textContent = CFG.EXEC_URL ? 'Conectado a Google Sheets' : 'Pendiente URL /exec';
  }

  function exportarDatos() {
    var backup = {
      fecha: new Date().toISOString(),
      historial: leerHistorial(),
      pesos: leerPesos(),
      rutinas: leerRutinasCustom(),
      prefs: prefs
    };
    var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'migym_backup_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    aviso('Backup descargado correctamente.');
  }

  function importarDatos(archivo) {
    if (!archivo) return;
    var lector = new FileReader();
    lector.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (data.historial && Array.isArray(data.historial)) escribirHistorial(data.historial);
        if (data.pesos && Array.isArray(data.pesos)) guardarPesos(data.pesos);
        if (data.rutinas && Array.isArray(data.rutinas)) guardarRutinasCustom(data.rutinas);
        aviso('Datos importados con éxito.');
        irATab('dashboard');
      } catch (err) {
        aviso('Error al leer el archivo de backup JSON.', true);
      }
    };
    lector.readAsText(archivo);
  }

  // ── 18. Inicialización y Eventos ────────────────────────────────────────────
  function init() {
    leerPrefs();
    irATab('dashboard');

    // Eventos de TabBar
    TABS.forEach(function (t) {
      var btn = $('tab-' + t);
      if (btn) btn.addEventListener('click', function () { irATab(t); });
    });

    // Subtabs de Progreso
    $('subtab-prog-ej').addEventListener('click', function () {
      $('subtab-prog-ej').classList.add('on');
      $('subtab-prog-prs').classList.remove('on');
      mostrar('vista-prog-ejercicio');
      ocultar('vista-prog-prs');
    });
    $('subtab-prog-prs').addEventListener('click', function () {
      $('subtab-prog-prs').classList.add('on');
      $('subtab-prog-ej').classList.remove('on');
      ocultar('vista-prog-ejercicio');
      mostrar('vista-prog-prs');
      abrirRecords();
    });

    // Subtabs de Historial
    $('subtab-hist-sesiones').addEventListener('click', function () {
      $('subtab-hist-sesiones').classList.add('on');
      $('subtab-hist-resumen').classList.remove('on');
      mostrar('vista-hist-sesiones');
      ocultar('vista-hist-resumen');
    });
    $('subtab-hist-resumen').addEventListener('click', function () {
      $('subtab-hist-resumen').classList.add('on');
      $('subtab-hist-sesiones').classList.remove('on');
      ocultar('vista-hist-sesiones');
      mostrar('vista-hist-resumen');
      abrirResumen();
    });

    // Botones de cabecera y banners
    $('btn-top-ajustes').addEventListener('click', pintarAjustes);
    $('btn-ajustes-volver').addEventListener('click', function () { irATab('dashboard'); });
    $('banner-activa-btn').addEventListener('click', abrirSesion);
    $('banner-sesion-activa').addEventListener('click', abrirSesion);

    // Sesión rápida / libre
    $('btn-sesion-rapida').addEventListener('click', function () {
      iniciarSesion({ nombre: 'Sesión libre', ejercicios: [] });
    });

    // Sesión activa
    $('btn-volver-sesion').addEventListener('click', function () {
      irATab('dashboard');
    });
    $('btn-guardar').addEventListener('click', guardarSesion);
    $('btn-descartar').addEventListener('click', descartarSesion);
    $('btn-agregar-ejercicio').addEventListener('click', function () { abrirSelector(); });
    $('selector-cerrar').addEventListener('click', cerrarSelector);
    $('btn-pendientes').addEventListener('click', sincronizar);

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
    $('chip-peso-hoy').addEventListener('click', function () {
      var fila = $('fila-peso-sesion');
      fila.classList.toggle('oculto');
      $('chip-peso-hoy').classList.toggle('on', !fila.classList.contains('oculto'));
    });

    // Rutinas y Editor
    $('btn-nueva-rutina').addEventListener('click', function () { abrirEditorRutina(); });
    $('btn-rutina-cerrar').addEventListener('click', function () { ocultar('modal-rutina-editor'); });
    $('btn-rutina-guardar').addEventListener('click', guardarRutinaDesdeEditor);
    $('btn-editor-add-ej').addEventListener('click', function () {
      abrirSelector(function (ej) {
        rutinaEditando.ejercicios.push({
          nombre: ej.nombre, grupo: ej.grupo, tipo: ej.tipo || 'peso_reps',
          series: 3, reps: '8-10', descanso: 90
        });
        pintarEjerciciosEditorRutina();
      });
    });

    // Módulo de Peso
    $('btn-registrar-peso').addEventListener('click', function () {
      var v = $('peso-valor').value;
      var f = $('peso-fecha').value;
      var n = $('peso-nota').value;
      registrarPeso(v, f, n);
      $('peso-valor').value = '';
      $('peso-nota').value = '';
    });

    // Selector de ejercicio en Progreso
    $('prog-ejercicio').addEventListener('change', function () {
      progMetricaId = null;
      renderProgreso(this.value);
    });

    // Detalle de sesión
    $('btn-det-volver').addEventListener('click', function () { irATab('historial'); });

    // Descanso flotante
    $('descanso-menos').addEventListener('click', function () {
      descansoRestante = Math.max(0, descansoRestante - 15);
      actualizarDescansoUI();
    });
    $('descanso-mas').addEventListener('click', function () {
      descansoRestante += 15;
      actualizarDescansoUI();
    });
    $('descanso-pausa').addEventListener('click', function () {
      descansoPausado = !descansoPausado;
      $('descanso-pausa').textContent = descansoPausado ? 'Reanudar' : 'Pausar';
    });
    $('descanso-saltar').addEventListener('click', function () {
      clearInterval(descansoInt);
      ocultar('descanso');
    });

    // Modal de técnica
    $('btn-tecnica-cerrar').addEventListener('click', function () { ocultar('modal-tecnica'); });

    // Ajustes
    $('btn-ajuste-audio').addEventListener('click', function () {
      prefs.audioDescanso = !prefs.audioDescanso; guardarPrefs();
      $('btn-ajuste-audio').textContent = prefs.audioDescanso ? 'Activado' : 'Silenciado';
      $('btn-ajuste-audio').classList.toggle('on', prefs.audioDescanso);
    });
    $('btn-ajuste-vibrar').addEventListener('click', function () {
      prefs.vibrarDescanso = !prefs.vibrarDescanso; guardarPrefs();
      $('btn-ajuste-vibrar').textContent = prefs.vibrarDescanso ? 'Activada' : 'Desactivada';
      $('btn-ajuste-vibrar').classList.toggle('on', prefs.vibrarDescanso);
    });
    $('btn-ajuste-anim').addEventListener('click', function () {
      prefs.animaciones = !prefs.animaciones; guardarPrefs();
      $('btn-ajuste-anim').textContent = prefs.animaciones ? 'Activadas' : 'Pausadas';
      $('btn-ajuste-anim').classList.toggle('on', prefs.animaciones);
      document.body.classList.toggle('sin-animaciones', !prefs.animaciones);
    });
    $('btn-probar-audio').addEventListener('click', function () {
      reproducirAlertaDescanso();
      vibrar([200, 100, 200]);
    });
    $('btn-cambiar-clave').addEventListener('click', function () {
      var s = (window.prompt('Nueva clave de sincronización:') || '').trim();
      if (s) {
        localStorage.setItem(SECRETO_KEY, s);
        aviso('Clave guardada.');
      }
    });
    $('btn-exportar-datos').addEventListener('click', exportarDatos);
    $('btn-importar-datos').addEventListener('click', function () {
      $('input-archivo-importar').click();
    });
    $('input-archivo-importar').addEventListener('change', function () {
      if (this.files && this.files[0]) importarDatos(this.files[0]);
    });

    window.addEventListener('online', sincronizar);

    recuperarBorrador();
    sincronizar();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
