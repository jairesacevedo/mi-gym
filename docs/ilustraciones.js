/* ilustraciones.js — Pictogramas SVG de los ejercicios.
 *
 * Son dibujos vectoriales EN EL PROPIO ARCHIVO: no descargan nada, pesan casi nada
 * y funcionan sin señal (que es todo el punto de la app en el gym). Heredan el color
 * del tema: el cuerpo usa el color del texto y el equipo (barra, mancuerna, máquina)
 * el color de acento.
 *
 * Cómo se elige el dibujo de un ejercicio:
 *   1. Si el ejercicio del catálogo trae `img: 'url'`, la app muestra esa foto.
 *   2. Si no, se busca el nombre en PATRONES (sin acentos, sin mayúsculas).
 *   3. Si no coincide nada, se usa el dibujo del grupo (Empuje, Tirón, Piernas…).
 *
 * Para añadir uno nuevo: agrega el trazado en DIBUJOS y su patrón en PATRONES.
 */
(function () {
  'use strict';

  function svg(inner) {
    return '<svg class="ilus" viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  // Trazados. Clases: .fig = cuerpo · .eq = equipo · .llena = relleno · .traza = trayectoria.
  var DIBUJOS = {

    // ── Empuje ────────────────────────────────────────────────────────────────
    banca:
      '<rect class="eq" x="8" y="41" width="42" height="4.5" rx="2.2"/>' +
      '<path class="eq" d="M14 46v7M46 46v7"/>' +
      '<circle class="fig" cx="15" cy="35" r="4"/>' +
      '<path class="fig" d="M19.5 39h18l7.5 7"/>' +
      '<path class="fig" d="M25 38.5V27M33 38.5V27"/>' +
      '<path class="eq" d="M18 25.5h22"/>' +
      '<path class="eq" d="M20.5 21v9M37.5 21v9"/>',

    banca_inclinada:
      '<path class="eq" d="M12 50L40 28"/>' +
      '<path class="eq" d="M12 50h16"/>' +
      '<circle class="fig" cx="38" cy="25" r="4"/>' +
      '<path class="fig" d="M35 28L18 42"/>' +
      '<path class="fig" d="M18 42l-6 6M18 42l8 8"/>' +
      '<path class="fig" d="M33 30l-6-11M30 33l-6-12"/>' +
      '<path class="eq" d="M20 19h16"/>' +
      '<path class="eq" d="M23 15v8M33 15v8"/>',

    press_hombro:
      '<circle class="fig" cx="30" cy="24" r="4.2"/>' +
      '<path class="fig" d="M30 28.5v12"/>' +
      '<path class="fig" d="M30 40.5h10v10"/>' +
      '<path class="fig" d="M30 32l-8-10M30 32l8-10"/>' +
      '<path class="eq" d="M16 20h28"/>' +
      '<path class="eq" d="M20 16v8M40 16v8"/>' +
      '<rect class="eq" x="22" y="41" width="12" height="3.5" rx="1.7"/>',

    elevacion_lateral:
      '<circle class="fig" cx="32" cy="18" r="4.2"/>' +
      '<path class="fig" d="M32 22.5v16"/>' +
      '<path class="fig" d="M32 38.5l-6 13M32 38.5l6 13"/>' +
      '<path class="fig" d="M32 27H18M32 27h14"/>' +
      '<rect class="eq llena" x="11" y="23" width="6" height="8" rx="2"/>' +
      '<rect class="eq llena" x="47" y="23" width="6" height="8" rx="2"/>',

    pushdown:
      '<path class="eq" d="M42 7v15"/>' +
      '<path class="eq" d="M35 22h13"/>' +
      '<circle class="fig" cx="24" cy="20" r="4"/>' +
      '<path class="fig" d="M24 24.5v14"/>' +
      '<path class="fig" d="M24 38.5l-5 13M24 38.5l6 13"/>' +
      '<path class="fig" d="M24 28l11-2 6-3"/>',

    fondos:
      '<path class="eq" d="M12 24v26M52 24v26"/>' +
      '<path class="eq" d="M12 26h10M42 26h10"/>' +
      '<circle class="fig" cx="32" cy="22" r="4.2"/>' +
      '<path class="fig" d="M32 26.5v12"/>' +
      '<path class="fig" d="M32 38.5l8 6M32 38.5l-2 10"/>' +
      '<path class="fig" d="M30 28l-9-2M34 28l9-2"/>',

    // ── Tirón ─────────────────────────────────────────────────────────────────
    dominada:
      '<path class="eq" d="M10 12h44"/>' +
      '<path class="eq" d="M14 6v6M50 6v6"/>' +
      '<path class="fig" d="M26 12l3 10M38 12l-3 10"/>' +
      '<circle class="fig" cx="32" cy="26" r="4.2"/>' +
      '<path class="fig" d="M32 30.5v11"/>' +
      '<path class="fig" d="M32 41.5l-5 12M32 41.5l5 12"/>',

    jalon:
      '<path class="eq" d="M32 6v8"/>' +
      '<path class="eq" d="M18 14h28"/>' +
      '<path class="fig" d="M25 15l4 9M39 15l-4 9"/>' +
      '<circle class="fig" cx="32" cy="28" r="4.2"/>' +
      '<path class="fig" d="M32 32.5v9"/>' +
      '<path class="fig" d="M32 41.5h9v10"/>' +
      '<rect class="eq" x="24" y="42" width="13" height="3.5" rx="1.7"/>',

    remo_sentado:
      '<path class="eq" d="M6 26h16"/>' +
      '<path class="eq" d="M22 22v8"/>' +
      '<circle class="fig" cx="36" cy="20" r="4.2"/>' +
      '<path class="fig" d="M36 24.5v12"/>' +
      '<path class="fig" d="M36 27l-10-1h-4"/>' +
      '<path class="fig" d="M36 36.5l-14 4-4 10"/>' +
      '<rect class="eq" x="33" y="37" width="13" height="3.5" rx="1.7"/>',

    remo_inclinado:
      '<circle class="fig" cx="16" cy="24" r="4"/>' +
      '<path class="fig" d="M20 26l18 6"/>' +
      '<path class="fig" d="M38 32l2 12-4 10"/>' +
      '<path class="fig" d="M27 29l-1 11"/>' +
      '<rect class="eq llena" x="21" y="40" width="11" height="5.5" rx="2.4"/>',

    curl_biceps:
      '<circle class="fig" cx="32" cy="16" r="4.2"/>' +
      '<path class="fig" d="M32 20.5v16"/>' +
      '<path class="fig" d="M32 36.5l-5 15M32 36.5l5 15"/>' +
      '<path class="fig" d="M32 25l-6 9 4-9"/>' +
      '<rect class="eq llena" x="25" y="20" width="10" height="5" rx="2.4"/>',

    // ── Piernas ───────────────────────────────────────────────────────────────
    sentadilla:
      '<path class="eq" d="M14 20h36"/>' +
      '<path class="eq" d="M17 15v10M47 15v10"/>' +
      '<circle class="fig" cx="32" cy="13" r="4"/>' +
      '<path class="fig" d="M32 21v11"/>' +
      '<path class="fig" d="M32 32l10 6-6 12"/>' +
      '<path class="fig" d="M32 32l-10 6 6 12"/>',

    sentadilla_goblet:
      '<circle class="fig" cx="32" cy="13" r="4"/>' +
      '<path class="fig" d="M32 17v15"/>' +
      '<path class="fig" d="M32 32l10 6-6 12"/>' +
      '<path class="fig" d="M32 32l-10 6 6 12"/>' +
      '<path class="fig" d="M32 21l-6 4M32 21l6 4"/>' +
      '<rect class="eq" x="25" y="23" width="14" height="9" rx="3"/>',

    prensa:
      '<path class="eq" d="M34 12L54 32"/>' +
      '<path class="eq" d="M36 8l6 6"/>' +
      '<rect class="eq" x="6" y="44" width="32" height="4" rx="2"/>' +
      '<circle class="fig" cx="12" cy="38" r="4"/>' +
      '<path class="fig" d="M16 41h14"/>' +
      '<path class="fig" d="M30 41l8-11 7-5"/>',

    leg_extension:
      '<path class="eq" d="M14 24v16"/>' +
      '<rect class="eq" x="13" y="39" width="18" height="4" rx="2"/>' +
      '<circle class="fig" cx="19" cy="22" r="4.2"/>' +
      '<path class="fig" d="M19 26.5v11"/>' +
      '<path class="fig" d="M19 37.5h15"/>' +
      '<path class="fig" d="M34 37.5l12-6"/>' +
      '<rect class="eq llena" x="43" y="27" width="9" height="5" rx="2.4"/>',

    leg_curl:
      '<rect class="eq" x="8" y="38" width="40" height="4" rx="2"/>' +
      '<circle class="fig" cx="12" cy="32" r="4"/>' +
      '<path class="fig" d="M16 35h18"/>' +
      '<path class="fig" d="M34 35l10 3V26"/>' +
      '<rect class="eq llena" x="39" y="21" width="10" height="5" rx="2.4"/>',

    pantorrilla:
      '<path class="eq" d="M10 50h44"/>' +
      '<rect class="eq" x="20" y="44" width="24" height="5" rx="2"/>' +
      '<circle class="fig" cx="32" cy="16" r="4.2"/>' +
      '<path class="fig" d="M32 20.5v14"/>' +
      '<path class="fig" d="M32 34.5l-4 9M32 34.5l4 9"/>' +
      '<path class="eq" d="M48 34v-9M44 29l4-4 4 4"/>',

    peso_muerto:
      '<circle class="fig" cx="18" cy="20" r="4"/>' +
      '<path class="fig" d="M22 22l16 6"/>' +
      '<path class="fig" d="M38 28l2 14-4 10"/>' +
      '<path class="fig" d="M28 25l-1 15"/>' +
      '<path class="eq" d="M15 41h24"/>' +
      '<path class="eq" d="M19 35v12M35 35v12"/>',

    hip_thrust:
      '<rect class="eq" x="6" y="27" width="16" height="4" rx="2"/>' +
      '<circle class="fig" cx="14" cy="22" r="4"/>' +
      '<path class="fig" d="M18 27l18 4"/>' +
      '<path class="fig" d="M36 31l9 9v11"/>' +
      '<path class="eq" d="M28 29h16"/>' +
      '<path class="eq" d="M31 25v9M41 25v9"/>',

    zancada:
      '<circle class="fig" cx="28" cy="14" r="4.2"/>' +
      '<path class="fig" d="M28 18.5v14"/>' +
      '<path class="fig" d="M28 32.5l12 4v13"/>' +
      '<path class="fig" d="M28 32.5l-8 10 2 9"/>' +
      '<rect class="eq llena" x="16" y="24" width="6" height="8" rx="2"/>' +
      '<rect class="eq llena" x="36" y="24" width="6" height="8" rx="2"/>',

    // ── Core ──────────────────────────────────────────────────────────────────
    plancha:
      '<path class="eq" d="M8 50h48"/>' +
      '<circle class="fig" cx="16" cy="30" r="4"/>' +
      '<path class="fig" d="M20 32l26 10"/>' +
      '<path class="fig" d="M18 34v14h8"/>' +
      '<path class="fig" d="M46 42l5 8"/>',

    plancha_lateral:
      '<path class="eq" d="M8 52h48"/>' +
      '<circle class="fig" cx="18" cy="18" r="4"/>' +
      '<path class="fig" d="M21 21l25 27"/>' +
      '<path class="fig" d="M24 26l-4 15-4 9"/>' +
      '<path class="fig" d="M24 26l5-13"/>',

    colgado:
      '<path class="eq" d="M10 10h44"/>' +
      '<path class="eq" d="M14 5v5M50 5v5"/>' +
      '<path class="fig" d="M27 10v11M37 10v11"/>' +
      '<circle class="fig" cx="32" cy="25" r="4.2"/>' +
      '<path class="fig" d="M32 29.5v10"/>' +
      '<path class="fig" d="M32 39.5l12-3 5-8"/>',

    rueda:
      '<path class="eq" d="M6 50h52"/>' +
      '<circle class="eq" cx="48" cy="44" r="6"/>' +
      '<path class="eq" d="M41 44h14"/>' +
      '<circle class="fig" cx="22" cy="30" r="4"/>' +
      '<path class="fig" d="M25 33L14 46h-4"/>' +
      '<path class="fig" d="M26 32l16 10"/>',

    crunch:
      '<path class="eq" d="M8 50h48"/>' +
      '<circle class="fig" cx="24" cy="30" r="4"/>' +
      '<path class="fig" d="M22 34l-8 10"/>' +
      '<path class="fig" d="M27 32l10 8-6 8"/>' +
      '<path class="fig" d="M37 40l8 8"/>',

    // ── Pliometría ────────────────────────────────────────────────────────────
    box_jump:
      '<rect class="eq" x="36" y="34" width="22" height="16" rx="2"/>' +
      '<path class="eq" d="M6 50h28"/>' +
      '<path class="eq traza" d="M12 44Q24 16 42 32"/>' +
      '<circle class="fig" cx="20" cy="16" r="4.2"/>' +
      '<path class="fig" d="M20 20.5l4 9"/>' +
      '<path class="fig" d="M24 29.5h8M24 29.5l-2 9"/>' +
      '<path class="fig" d="M21 23l-9-5M22 24l8-4"/>',

    jump_squat:
      '<path class="eq" d="M10 54h44"/>' +
      '<circle class="fig" cx="32" cy="13" r="4.2"/>' +
      '<path class="fig" d="M32 17.5v11"/>' +
      '<path class="fig" d="M32 28.5l-8 8 2 8M32 28.5l8 8-2 8"/>' +
      '<path class="fig" d="M31 21l-9 5M33 21l9 5"/>' +
      '<path class="eq" d="M16 50v-8M12 46l4-4 4 4"/>' +
      '<path class="eq" d="M48 50v-8M44 46l4-4 4 4"/>',

    broad_jump:
      '<path class="eq" d="M6 52h52"/>' +
      '<path class="eq traza" d="M12 46q16-16 32 0"/>' +
      '<circle class="fig" cx="24" cy="16" r="4.2"/>' +
      '<path class="fig" d="M27 19l9 7"/>' +
      '<path class="fig" d="M36 26l-6 8 4 6"/>' +
      '<path class="fig" d="M26 20l-10-2M28 23l-10 3"/>' +
      '<path class="eq" d="M41 43l5 3-5 3"/>',

    lateral_bound:
      '<path class="eq" d="M6 52h52"/>' +
      '<path class="eq traza" d="M14 48h28"/>' +
      '<circle class="fig" cx="26" cy="16" r="4.2"/>' +
      '<path class="fig" d="M26 20.5v9"/>' +
      '<path class="fig" d="M26 29.5l-8 8M26 29.5l10 6 4 8"/>' +
      '<path class="fig" d="M26 23l9-3M26 23l-9 3"/>' +
      '<path class="eq" d="M42 45l5 3-5 3"/>',

    pogo:
      '<path class="eq" d="M14 52h36"/>' +
      '<circle class="fig" cx="32" cy="16" r="4.2"/>' +
      '<path class="fig" d="M32 20.5v14"/>' +
      '<path class="fig" d="M32 34.5l-4 11M32 34.5l4 11"/>' +
      '<path class="fig" d="M32 24l-8 6M32 24l8 6"/>' +
      '<path class="eq" d="M18 36v-9M14 31l4-4 4 4"/>' +
      '<path class="eq" d="M46 36v-9M42 31l4-4 4 4"/>',

    tuck_jump:
      '<path class="eq" d="M10 54h44"/>' +
      '<circle class="fig" cx="30" cy="14" r="4.2"/>' +
      '<path class="fig" d="M30 18.5l2 9"/>' +
      '<path class="fig" d="M32 27.5l11-4-4 9M32 27.5l9 8-6 5"/>' +
      '<path class="fig" d="M29 20l-9-3M30 23l-9 4"/>',

    // ── Genéricos ─────────────────────────────────────────────────────────────
    mancuerna:
      '<path class="eq" d="M15 32h34"/>' +
      '<rect class="eq llena" x="7" y="24" width="7" height="16" rx="3"/>' +
      '<rect class="eq llena" x="50" y="24" width="7" height="16" rx="3"/>' +
      '<rect class="eq llena" x="16" y="27" width="4" height="10" rx="2"/>' +
      '<rect class="eq llena" x="44" y="27" width="4" height="10" rx="2"/>',
  };

  // Primer patrón que coincida manda: de lo más específico a lo más genérico.
  var PATRONES = [
    [/box ?jump|cajon/, 'box_jump'],
    [/jump ?squat|squat ?jump|salto vertical/, 'jump_squat'],
    [/broad ?jump|salto largo|salto horizontal/, 'broad_jump'],
    [/lateral bound|bound|salto lateral/, 'lateral_bound'],
    [/pogo/, 'pogo'],
    [/tuck ?jump/, 'tuck_jump'],

    [/incline|inclinad/, 'banca_inclinada'],
    [/bench|banca|press de pecho/, 'banca'],
    [/shoulder press|press militar|press de hombro|overhead press/, 'press_hombro'],
    [/lateral raise|elevacion lateral|vuelo lateral/, 'elevacion_lateral'],
    [/pushdown|triceps|extension de triceps/, 'pushdown'],
    [/dip|fondo/, 'fondos'],

    [/pull-?up|chin-?up|dominad/, 'dominada'],
    [/pulldown|jalon/, 'jalon'],
    [/seated row|low row|remo sentado|remo en polea/, 'remo_sentado'],

    [/leg curl|femoral|lying curl/, 'leg_curl'],
    [/leg extension|extension de pierna|cuadricep/, 'leg_extension'],
    [/leg press|prensa/, 'prensa'],
    [/calf|pantorrilla|gemelo/, 'pantorrilla'],
    [/deadlift|peso muerto|straight leg|rdl|hip hinge/, 'peso_muerto'],
    [/hip thrust|puente de gluteo|glute bridge/, 'hip_thrust'],
    [/lunge|zancada|bulgar|step-?up/, 'zancada'],
    [/goblet/, 'sentadilla_goblet'],
    [/squat|sentadilla/, 'sentadilla'],

    [/curl/, 'curl_biceps'],
    [/row|remo/, 'remo_inclinado'],

    [/plancha lateral|side plank/, 'plancha_lateral'],
    [/plancha|plank/, 'plancha'],
    [/colgad|hanging|elevacion de pierna/, 'colgado'],
    [/rueda|ab ?wheel|roll-?out/, 'rueda'],
    [/crunch|abdominal|sit-?up/, 'crunch'],
  ];

  var POR_GRUPO = {
    empuje: 'banca',
    tiron: 'remo_inclinado',
    piernas: 'sentadilla',
    core: 'plancha',
    pliometria: 'jump_squat',
  };

  // Minúsculas y sin acentos, para que "Elevación" y "elevacion" coincidan igual.
  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s;
  }

  function idDe(nombre, grupo) {
    var n = norm(nombre);
    for (var i = 0; i < PATRONES.length; i++) {
      if (PATRONES[i][0].test(n)) return PATRONES[i][1];
    }
    return POR_GRUPO[norm(grupo)] || 'mancuerna';
  }

  window.MIGYM_ILUSTRACIONES = {
    idDe: idDe,
    // Devuelve el SVG listo para inyectar como innerHTML.
    svgDe: function (nombre, grupo) { return svg(DIBUJOS[idDe(nombre, grupo)] || DIBUJOS.mancuerna); },
    dibujos: DIBUJOS,
  };
})();
