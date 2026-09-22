/* ilustraciones.js — Pictogramas SVG animados y técnicos de los ejercicios.
 *
 * Dibujos vectoriales interactivos con monigotes de palitos ("stick figures")
 * enriquecidos con animaciones en bucle en CSS/SVG. Mantienen la esencia clásica
 * minimalista pero cobran vida para ilustrar la trayectoria y técnica correcta.
 *
 * Incluye metadatos técnicos (músculos trabajados, consejos posturales) para el
 * visor interactivo de ejercicios.
 */
(function () {
  'use strict';

  function svg(inner, cls) {
    return '<svg class="ilus ' + (cls || '') + '" viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  // Trazados vectoriales con grupos semánticos animados.
  // Clases CSS utilizadas:
  // .fig = cuerpo del monigote (color de texto)
  // .eq = equipamiento (barra, mancuerna, máquina, banco en color de acento)
  // .llena = relleno de placas/discos
  // .traza = guía de recorrido punteada
  // .anim-* = clases para animar la fase concéntrica y excéntrica del ejercicio
  var DIBUJOS = {

    // ── Empuje ────────────────────────────────────────────────────────────────
    banca:
      '<rect class="eq" x="8" y="42" width="44" height="4" rx="2"/>' +
      '<path class="eq" d="M14 46v7M44 46v7"/>' +
      '<circle class="fig" cx="15" cy="36" r="4"/>' +
      '<path class="fig" d="M19 39.5h18l7 6.5"/>' +
      '<g class="anim-banca">' +
        '<path class="fig" d="M25 39V27M33 39V27"/>' +
        '<path class="eq" d="M18 25.5h22"/>' +
        '<path class="eq" d="M20.5 21v9M37.5 21v9"/>' +
      '</g>',

    banca_inclinada:
      '<path class="eq" d="M12 50L40 28"/>' +
      '<path class="eq" d="M12 50h16"/>' +
      '<circle class="fig" cx="38" cy="25" r="4"/>' +
      '<path class="fig" d="M35 28L18 42"/>' +
      '<path class="fig" d="M18 42l-6 6M18 42l8 8"/>' +
      '<g class="anim-banca-inc">' +
        '<path class="fig" d="M33 30l-7-11M30 33l-7-12"/>' +
        '<path class="eq" d="M20 19h16"/>' +
        '<path class="eq" d="M22 15v8M34 15v8"/>' +
      '</g>',

    press_hombro:
      '<rect class="eq" x="22" y="41" width="12" height="3.5" rx="1.7"/>' +
      '<circle class="fig" cx="30" cy="24" r="4.2"/>' +
      '<path class="fig" d="M30 28.5v12"/>' +
      '<path class="fig" d="M30 40.5h10v10"/>' +
      '<g class="anim-ohp">' +
        '<path class="fig" d="M30 31l-8-10M30 31l8-10"/>' +
        '<path class="eq" d="M16 20h28"/>' +
        '<path class="eq" d="M19 15v10M41 15v10"/>' +
      '</g>',

    elevacion_lateral:
      '<circle class="fig" cx="32" cy="18" r="4.2"/>' +
      '<path class="fig" d="M32 22.5v16"/>' +
      '<path class="fig" d="M32 38.5l-6 13M32 38.5l6 13"/>' +
      '<g class="anim-lat-l">' +
        '<path class="fig" d="M32 26H18"/>' +
        '<rect class="eq llena" x="11" y="22" width="6" height="8" rx="2"/>' +
      '</g>' +
      '<g class="anim-lat-r">' +
        '<path class="fig" d="M32 26h14"/>' +
        '<rect class="eq llena" x="47" y="22" width="6" height="8" rx="2"/>' +
      '</g>',

    pushdown:
      '<path class="eq" d="M42 6v14"/>' +
      '<circle class="fig" cx="24" cy="20" r="4"/>' +
      '<path class="fig" d="M24 24.5v14"/>' +
      '<path class="fig" d="M24 38.5l-5 13M24 38.5l6 13"/>' +
      '<path class="fig" d="M24 28l7-1"/>' +
      '<g class="anim-pushdown">' +
        '<path class="fig" d="M31 27l10 5"/>' +
        '<path class="eq" d="M36 32h11"/>' +
      '</g>',

    fondos:
      '<path class="eq" d="M12 24v26M52 24v26"/>' +
      '<path class="eq" d="M12 26h10M42 26h10"/>' +
      '<g class="anim-dips">' +
        '<circle class="fig" cx="32" cy="22" r="4.2"/>' +
        '<path class="fig" d="M32 26.5v12"/>' +
        '<path class="fig" d="M32 38.5l8 6M32 38.5l-2 10"/>' +
        '<path class="fig" d="M30 28l-8-2M34 28l8-2"/>' +
      '</g>',

    // ── Tirón ─────────────────────────────────────────────────────────────────
    dominada:
      '<path class="eq" d="M10 12h44"/>' +
      '<path class="eq" d="M14 6v6M50 6v6"/>' +
      '<g class="anim-pullup">' +
        '<path class="fig" d="M26 12l4 8M38 12l-4 8"/>' +
        '<circle class="fig" cx="32" cy="24" r="4.2"/>' +
        '<path class="fig" d="M32 28.5v12"/>' +
        '<path class="fig" d="M32 40.5l-5 12M32 40.5l5 12"/>' +
      '</g>',

    jalon:
      '<path class="eq" d="M32 6v8"/>' +
      '<rect class="eq" x="24" y="42" width="13" height="3.5" rx="1.7"/>' +
      '<circle class="fig" cx="32" cy="28" r="4.2"/>' +
      '<path class="fig" d="M32 32.5v9"/>' +
      '<path class="fig" d="M32 41.5h9v10"/>' +
      '<g class="anim-pulldown">' +
        '<path class="eq" d="M18 14h28"/>' +
        '<path class="fig" d="M25 15l5 8M39 15l-5 8"/>' +
      '</g>',

    remo_sentado:
      '<path class="eq" d="M6 26h16"/>' +
      '<path class="eq" d="M22 22v8"/>' +
      '<rect class="eq" x="33" y="37" width="13" height="3.5" rx="1.7"/>' +
      '<circle class="fig" cx="36" cy="20" r="4.2"/>' +
      '<path class="fig" d="M36 24.5v12"/>' +
      '<path class="fig" d="M36 36.5l-14 4-4 10"/>' +
      '<g class="anim-remo-sentado">' +
        '<path class="fig" d="M36 27l-12-1h-6"/>' +
      '</g>',

    remo_inclinado:
      '<path class="fig" d="M38 32l2 12-4 10"/>' +
      '<circle class="fig" cx="16" cy="24" r="4"/>' +
      '<path class="fig" d="M20 26l18 6"/>' +
      '<g class="anim-remo-inc">' +
        '<path class="fig" d="M27 29l-2 11"/>' +
        '<rect class="eq llena" x="19" y="39" width="12" height="5.5" rx="2.4"/>' +
      '</g>',

    curl_biceps:
      '<circle class="fig" cx="32" cy="16" r="4.2"/>' +
      '<path class="fig" d="M32 20.5v16"/>' +
      '<path class="fig" d="M32 36.5l-5 15M32 36.5l5 15"/>' +
      '<path class="fig" d="M32 24l-3 8"/>' +
      '<g class="anim-curl">' +
        '<path class="fig" d="M29 32l-3-8"/>' +
        '<rect class="eq llena" x="22" y="21" width="9" height="5.5" rx="2.4"/>' +
      '</g>',

    // ── Piernas ───────────────────────────────────────────────────────────────
    sentadilla:
      '<g class="anim-squat">' +
        '<path class="eq" d="M14 19h36"/>' +
        '<path class="eq" d="M17 14v10M47 14v10"/>' +
        '<circle class="fig" cx="32" cy="12" r="4"/>' +
        '<path class="fig" d="M32 20v11"/>' +
        '<path class="fig" d="M32 31l9 7-5 12"/>' +
        '<path class="fig" d="M32 31l-9 7 5 12"/>' +
      '</g>',

    sentadilla_goblet:
      '<g class="anim-squat-goblet">' +
        '<circle class="fig" cx="32" cy="13" r="4"/>' +
        '<path class="fig" d="M32 17v15"/>' +
        '<path class="fig" d="M32 32l9 6-5 12"/>' +
        '<path class="fig" d="M32 32l-9 6 5 12"/>' +
        '<path class="fig" d="M32 21l-6 4M32 21l6 4"/>' +
        '<rect class="eq" x="25" y="23" width="14" height="9" rx="3"/>' +
      '</g>',

    prensa:
      '<rect class="eq" x="6" y="44" width="32" height="4" rx="2"/>' +
      '<circle class="fig" cx="12" cy="38" r="4"/>' +
      '<path class="fig" d="M16 41h14"/>' +
      '<g class="anim-prensa">' +
        '<path class="eq" d="M34 12L54 32"/>' +
        '<path class="eq" d="M36 8l6 6"/>' +
        '<path class="fig" d="M30 41l8-11 7-5"/>' +
      '</g>',

    leg_extension:
      '<path class="eq" d="M14 24v16"/>' +
      '<rect class="eq" x="13" y="39" width="18" height="4" rx="2"/>' +
      '<circle class="fig" cx="19" cy="22" r="4.2"/>' +
      '<path class="fig" d="M19 26.5v11"/>' +
      '<path class="fig" d="M19 37.5h15"/>' +
      '<g class="anim-leg-ext">' +
        '<path class="fig" d="M34 37.5l12-6"/>' +
        '<rect class="eq llena" x="43" y="27" width="9" height="5" rx="2.4"/>' +
      '</g>',

    leg_curl:
      '<rect class="eq" x="8" y="38" width="40" height="4" rx="2"/>' +
      '<circle class="fig" cx="12" cy="32" r="4"/>' +
      '<path class="fig" d="M16 35h18"/>' +
      '<g class="anim-leg-curl">' +
        '<path class="fig" d="M34 35l10 3V26"/>' +
        '<rect class="eq llena" x="39" y="21" width="10" height="5" rx="2.4"/>' +
      '</g>',

    pantorrilla:
      '<path class="eq" d="M10 50h44"/>' +
      '<rect class="eq" x="20" y="44" width="24" height="5" rx="2"/>' +
      '<g class="anim-pantorrilla">' +
        '<circle class="fig" cx="32" cy="16" r="4.2"/>' +
        '<path class="fig" d="M32 20.5v14"/>' +
        '<path class="fig" d="M32 34.5l-4 9M32 34.5l4 9"/>' +
        '<path class="eq" d="M48 34v-9M44 29l4-4 4 4"/>' +
      '</g>',

    peso_muerto:
      '<g class="anim-deadlift">' +
        '<circle class="fig" cx="18" cy="20" r="4"/>' +
        '<path class="fig" d="M22 22l16 6"/>' +
        '<path class="fig" d="M38 28l2 14-4 10"/>' +
        '<path class="fig" d="M28 25l-1 15"/>' +
        '<path class="eq" d="M15 41h24"/>' +
        '<path class="eq" d="M19 35v12M35 35v12"/>' +
      '</g>',

    hip_thrust:
      '<rect class="eq" x="6" y="27" width="16" height="4" rx="2"/>' +
      '<circle class="fig" cx="14" cy="22" r="4"/>' +
      '<g class="anim-hip-thrust">' +
        '<path class="fig" d="M18 27l18 4"/>' +
        '<path class="fig" d="M36 31l9 9v11"/>' +
        '<path class="eq" d="M28 29h16"/>' +
        '<path class="eq" d="M31 25v9M41 25v9"/>' +
      '</g>',

    zancada:
      '<g class="anim-lunge">' +
        '<circle class="fig" cx="28" cy="14" r="4.2"/>' +
        '<path class="fig" d="M28 18.5v14"/>' +
        '<path class="fig" d="M28 32.5l12 4v13"/>' +
        '<path class="fig" d="M28 32.5l-8 10 2 9"/>' +
        '<rect class="eq llena" x="16" y="24" width="6" height="8" rx="2"/>' +
        '<rect class="eq llena" x="36" y="24" width="6" height="8" rx="2"/>' +
      '</g>',

    // ── Core ──────────────────────────────────────────────────────────────────
    plancha:
      '<path class="eq" d="M8 50h48"/>' +
      '<g class="anim-plank">' +
        '<circle class="fig" cx="16" cy="30" r="4"/>' +
        '<path class="fig" d="M20 32l26 10"/>' +
        '<path class="fig" d="M18 34v14h8"/>' +
        '<path class="fig" d="M46 42l5 8"/>' +
      '</g>',

    plancha_lateral:
      '<path class="eq" d="M8 52h48"/>' +
      '<g class="anim-plank">' +
        '<circle class="fig" cx="18" cy="18" r="4"/>' +
        '<path class="fig" d="M21 21l25 27"/>' +
        '<path class="fig" d="M24 26l-4 15-4 9"/>' +
        '<path class="fig" d="M24 26l5-13"/>' +
      '</g>',

    colgado:
      '<path class="eq" d="M10 10h44"/>' +
      '<path class="eq" d="M14 5v5M50 5v5"/>' +
      '<path class="fig" d="M27 10v11M37 10v11"/>' +
      '<circle class="fig" cx="32" cy="25" r="4.2"/>' +
      '<path class="fig" d="M32 29.5v10"/>' +
      '<g class="anim-hanging-legs">' +
        '<path class="fig" d="M32 39.5l12-3 5-8"/>' +
      '</g>',

    rueda:
      '<path class="eq" d="M6 50h52"/>' +
      '<g class="anim-ab-wheel">' +
        '<circle class="eq" cx="48" cy="44" r="6"/>' +
        '<path class="eq" d="M41 44h14"/>' +
        '<circle class="fig" cx="22" cy="30" r="4"/>' +
        '<path class="fig" d="M25 33L14 46h-4"/>' +
        '<path class="fig" d="M26 32l16 10"/>' +
      '</g>',

    crunch:
      '<path class="eq" d="M8 50h48"/>' +
      '<path class="fig" d="M27 32l10 8-6 8"/>' +
      '<path class="fig" d="M37 40l8 8"/>' +
      '<g class="anim-crunch">' +
        '<circle class="fig" cx="24" cy="30" r="4"/>' +
        '<path class="fig" d="M22 34l-8 10"/>' +
      '</g>',

    // ── Pliometría ────────────────────────────────────────────────────────────
    box_jump:
      '<rect class="eq" x="36" y="34" width="22" height="16" rx="2"/>' +
      '<path class="eq" d="M6 50h28"/>' +
      '<path class="eq traza" d="M12 44Q24 16 42 32"/>' +
      '<g class="anim-box-jump">' +
        '<circle class="fig" cx="20" cy="16" r="4.2"/>' +
        '<path class="fig" d="M20 20.5l4 9"/>' +
        '<path class="fig" d="M24 29.5h8M24 29.5l-2 9"/>' +
        '<path class="fig" d="M21 23l-9-5M22 24l8-4"/>' +
      '</g>',

    jump_squat:
      '<path class="eq" d="M10 54h44"/>' +
      '<g class="anim-jump-squat">' +
        '<circle class="fig" cx="32" cy="13" r="4.2"/>' +
        '<path class="fig" d="M32 17.5v11"/>' +
        '<path class="fig" d="M32 28.5l-8 8 2 8M32 28.5l8 8-2 8"/>' +
        '<path class="fig" d="M31 21l-9 5M33 21l9 5"/>' +
      '</g>',

    broad_jump:
      '<path class="eq" d="M6 52h52"/>' +
      '<path class="eq traza" d="M12 46q16-16 32 0"/>' +
      '<g class="anim-broad-jump">' +
        '<circle class="fig" cx="24" cy="16" r="4.2"/>' +
        '<path class="fig" d="M27 19l9 7"/>' +
        '<path class="fig" d="M36 26l-6 8 4 6"/>' +
        '<path class="fig" d="M26 20l-10-2M28 23l-10 3"/>' +
      '</g>',

    lateral_bound:
      '<path class="eq" d="M6 52h52"/>' +
      '<path class="eq traza" d="M14 48h28"/>' +
      '<g class="anim-lateral-bound">' +
        '<circle class="fig" cx="26" cy="16" r="4.2"/>' +
        '<path class="fig" d="M26 20.5v9"/>' +
        '<path class="fig" d="M26 29.5l-8 8M26 29.5l10 6 4 8"/>' +
        '<path class="fig" d="M26 23l9-3M26 23l-9 3"/>' +
      '</g>',

    pogo:
      '<path class="eq" d="M14 52h36"/>' +
      '<g class="anim-pogo">' +
        '<circle class="fig" cx="32" cy="16" r="4.2"/>' +
        '<path class="fig" d="M32 20.5v14"/>' +
        '<path class="fig" d="M32 34.5l-4 11M32 34.5l4 11"/>' +
        '<path class="fig" d="M32 24l-8 6M32 24l8 6"/>' +
      '</g>',

    tuck_jump:
      '<path class="eq" d="M10 54h44"/>' +
      '<g class="anim-tuck-jump">' +
        '<circle class="fig" cx="30" cy="14" r="4.2"/>' +
        '<path class="fig" d="M30 18.5l2 9"/>' +
        '<path class="fig" d="M32 27.5l11-4-4 9M32 27.5l9 8-6 5"/>' +
        '<path class="fig" d="M29 20l-9-3M30 23l-9 4"/>' +
      '</g>',

    // ── Genéricos ─────────────────────────────────────────────────────────────
    mancuerna:
      '<path class="eq" d="M15 32h34"/>' +
      '<rect class="eq llena" x="7" y="24" width="7" height="16" rx="3"/>' +
      '<rect class="eq llena" x="50" y="24" width="7" height="16" rx="3"/>' +
      '<rect class="eq llena" x="16" y="27" width="4" height="10" rx="2"/>' +
      '<rect class="eq llena" x="44" y="27" width="4" height="10" rx="2"/>',
  };

  // Patrones para asociar nombres de ejercicio a la animación correspondiente.
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

  // Metadatos pedagógicos y musculares por animación.
  var METADATOS = {
    banca: {
      musculos: { primarios: ['Pectoral mayor'], secundarios: ['Tríceps', 'Deltoides anterior'] },
      tips: [
        'Retrae las escápulas y apoya firmemente los pies en el suelo.',
        'Baja la barra con control hacia la parte media del esternón (codos a ~45°).',
        'Empuja extendiendo los brazos sin despegar los glúteos del banco.'
      ]
    },
    banca_inclinada: {
      musculos: { primarios: ['Pectoral superior (clavicular)'], secundarios: ['Deltoides anterior', 'Tríceps'] },
      tips: [
        'Banco inclinado a 30°–45° para enfatizar la porción clavicular.',
        'Desciende la barra hacia la parte alta del pecho con trayectoria controlada.',
        'Mantén la tensión continua sin bloquear excesivamente los codos arriba.'
      ]
    },
    press_hombro: {
      musculos: { primarios: ['Deltoides anterior y lateral'], secundarios: ['Tríceps', 'Trapecio superior'] },
      tips: [
        'Empuja la carga verticalmente hacia arriba alineando muñecas y codos.',
        'Evita arquear excesivamente la zona lumbar contrayendo glúteos y core.',
        'Desciende controlando hasta que las manos rocen la altura del mentón.'
      ]
    },
    elevacion_lateral: {
      musculos: { primarios: ['Deltoides lateral (medio)'], secundarios: ['Trapecio'] },
      tips: [
        'Eleva los brazos hacia los costados manteniendo una ligera flexión de codos.',
        'Detén el movimiento a la altura de los hombros (paralelo al suelo).',
        'Baja lentamente en 2-3 segundos resistiendo el peso.'
      ]
    },
    pushdown: {
      musculos: { primarios: ['Tríceps (las tres cabezas)'], secundarios: ['Antebrazos'] },
      tips: [
        'Pega los codos a los costados del torso y no los muevas durante la serie.',
        'Extiende por completo los brazos hacia abajo apretando el tríceps 1 segundo.',
        'Regresa a 90° sin dejar que los hombros se vayan hacia adelante.'
      ]
    },
    fondos: {
      musculos: { primarios: ['Pectoral inferior', 'Tríceps'], secundarios: ['Deltoides anterior'] },
      tips: [
        'Inclina ligeramente el torso para enfatizar pecho, o recto para tríceps.',
        'Desciende hasta formar un ángulo de 90° en los codos.',
        'Empuja con potencia hasta estirar brazos sin dar tirones articulares.'
      ]
    },
    dominada: {
      musculos: { primarios: ['Dorsal ancho'], secundarios: ['Bíceps', 'Braquial', 'Redondo mayor'] },
      tips: [
        'Inicia tirando con las escápulas hacia abajo y hacia atrás.',
        'Tracciona hasta que la barbilla supere cómodamente la barra.',
        'Desciende con control hasta extender casi por completo los brazos.'
      ]
    },
    jalon: {
      musculos: { primarios: ['Dorsal ancho'], secundarios: ['Bíceps', 'Trapecio medio'] },
      tips: [
        'Pecho erguido y mirada al frente. Tracciona la barra hacia la clavícula.',
        'Conduce el movimiento con los codos hacia abajo y hacia tus costillas.',
        'Extiende los brazos controlando el peso sin balancear la espalda.'
      ]
    },
    remo_sentado: {
      musculos: { primarios: ['Dorsal ancho', 'Romboides'], secundarios: ['Bíceps', 'Deltoides posterior'] },
      tips: [
        'Mantén la espalda neutra y erguida durante todo el recorrido.',
        'Tira del agarre hacia el ombligo apretando las escápulas al final.',
        'Extiende los brazos sintiendo el estiramiento dorsal sin encorvarte.'
      ]
    },
    remo_inclinado: {
      musculos: { primarios: ['Dorsal', 'Trapecio', 'Romboides'], secundarios: ['Erectores espinales', 'Bíceps'] },
      tips: [
        'Bisagra de cadera a 45°, espalda recta y core bien compactado.',
        'Lleva la barra o mancuernas hacia la cadera baja o ombligo.',
        'Evita usar impulso de piernas para levantar la carga.'
      ]
    },
    curl_biceps: {
      musculos: { primarios: ['Bíceps braquial'], secundarios: ['Braquial', 'Braquiorradial'] },
      tips: [
        'Codos firmes al lado del torso sin balanceo ni arqueo de espalda.',
        'Flexiona los brazos contrayendo el bíceps en el punto más alto.',
        'Baja la carga de forma suave y controlada.'
      ]
    },
    sentadilla: {
      musculos: { primarios: ['Cuádriceps', 'Glúteo mayor'], secundarios: ['Aductores', 'Erectores lumbares'] },
      tips: [
        'Pies al ancho de hombros con puntas ligeramente hacia afuera.',
        'Inicia flexionando caderas y rodillas simultáneamente como sentándote.',
        'Desciende al menos hasta que la cadera rompa el paralelo y empuja con todo el pie.'
      ]
    },
    sentadilla_goblet: {
      musculos: { primarios: ['Cuádriceps', 'Core'], secundarios: ['Glúteos'] },
      tips: [
        'Sostén la mancuerna o pesa rusa pegada al pecho con ambos brazos.',
        'Mantén el pecho alto y los codos apuntando al suelo entre las rodillas.',
        'Empuja desde los talones y mantén la verticalidad del tronco.'
      ]
    },
    prensa: {
      musculos: { primarios: ['Cuádriceps'], secundarios: ['Glúteos', 'Isquiotibiales'] },
      tips: [
        'Pies en el centro de la plataforma con separación cómoda.',
        'Baja la plataforma hasta que las rodillas formen 90° sin redondear la pelvis.',
        'Empuja con fuerza sin bloquear las rodillas al final del recorrido.'
      ]
    },
    leg_extension: {
      musculos: { primarios: ['Cuádriceps (aislado)'], secundarios: [] },
      tips: [
        'Ajusta el respaldo para que la articulación de la rodilla coincida con el eje.',
        'Extiende las piernas con fuerza y aguanta 1 segundo en la contracción máxima.',
        'Desciende resistiendo el retorno de la máquina.'
      ]
    },
    leg_curl: {
      musculos: { primarios: ['Isquiosurales (femorales)'], secundarios: ['Gemelos'] },
      tips: [
        'Mantén la cadera pegada a la almohadilla sin arquear la zona lumbar.',
        'Flexiona los talones hacia los glúteos de manera fluida y continua.',
        'Extiende la pierna con control para maximizar la fase excéntrica.'
      ]
    },
    pantorrilla: {
      musculos: { primarios: ['Gastrocnemio (gemelos)', 'Sóleo'], secundarios: [] },
      tips: [
        'Empuja sobre la bola del pie elevándote al punto más alto posible.',
        'Haz una pausa de 1 segundo arriba y desciende hasta estirar el talón.',
        'Evita rebotar en la parte inferior para trabajar el músculo y no el tendón.'
      ]
    },
    peso_muerto: {
      musculos: { primarios: ['Isquiosurales', 'Glúteo mayor', 'Erectores'], secundarios: ['Trapecio', 'Dorsal'] },
      tips: [
        'Barra pegada a las espinillas, caderas hacia atrás y espalda recta como una tabla.',
        'Inicia empujando el suelo con los pies y extiende cadera y rodillas al unísono.',
        'Termina erguido apretando glúteos sin hiperextender la espalda hacia atrás.'
      ]
    },
    hip_thrust: {
      musculos: { primarios: ['Glúteo mayor'], secundarios: ['Isquiosurales', 'Cuádriceps'] },
      tips: [
        'Borde inferior de las escápulas apoyado en el banco y barra sobre la pelvis.',
        'Empuja a través de los talones hasta alinear rodillas, caderas y hombros a 180°.',
        'Mantén la barbilla recogida mirando hacia adelante para proteger la zona lumbar.'
      ]
    },
    zancada: {
      musculos: { primarios: ['Cuádriceps', 'Glúteos'], secundarios: ['Isquios', 'Core'] },
      tips: [
        'Da un paso firme hacia adelante y desciende hasta que ambas rodillas formen 90°.',
        'Mantén el torso erguido y el peso equilibrado en el pie delantero.',
        'Empuja con el talón frontal para volver a la posición inicial.'
      ]
    },
    plancha: {
      musculos: { primarios: ['Recto abdominal', 'Transverso'], secundarios: ['Hombros', 'Glúteos'] },
      tips: [
        'Cuerpo en línea recta desde la cabeza hasta los talones.',
        'Aprieta glúteos y contrae el abdomen empujando el suelo con los codos.',
        'Respira con calma manteniendo la tensión isométrica continua.'
      ]
    },
    plancha_lateral: {
      musculos: { primarios: ['Oblicuos'], secundarios: ['Glúteo medio', 'Hombros'] },
      tips: [
        'Codo justo debajo del hombro y cuerpo alineado lateralmente.',
        'Eleva la cadera evitando que caiga hacia el suelo.',
        'Sostén el tiempo objetivo con el core firme.'
      ]
    },
    colgado: {
      musculos: { primarios: ['Abdomen inferior', 'Flexores de cadera'], secundarios: ['Antebrazos (agarre)'] },
      tips: [
        'Cuélgate con agarre firme y hombros activos (no hundidos).',
        'Eleva las rodillas o piernas rectas enrollando la pelvis hacia el ombligo.',
        'Baja sin balancearte ni utilizar la inercia.'
      ]
    },
    rueda: {
      musculos: { primarios: ['Recto abdominal', 'Core profundo'], secundarios: ['Dorsales', 'Hombros'] },
      tips: [
        'Desde rodillas, rueda hacia adelante manteniendo la espalda ligeramente redondeada.',
        'Ve tan lejos como puedas sin que tu espalda lumbar se arquee o duelan.',
        'Tracciona con el abdomen para regresar a la posición de inicio.'
      ]
    },
    crunch: {
      musculos: { primarios: ['Recto abdominal superior'], secundarios: [] },
      tips: [
        'Flexiona el torso acercando las costillas a la pelvis.',
        'No tires de la nuca con las manos: concéntrate en enrollar el tronco.',
        'Expulsa el aire en la subida y baja con control.'
      ]
    },
    box_jump: {
      musculos: { primarios: ['Potencia de cuádriceps y glúteos'], secundarios: ['Gemelos', 'Core'] },
      tips: [
        'Flexiona caderas y rodillas balanceando brazos hacia atrás.',
        'Explota hacia arriba aterrizando suavemente con ambos pies en el cajón.',
        'Bájate dando un paso, no saltando hacia atrás para cuidar tendones.'
      ]
    },
    jump_squat: {
      musculos: { primarios: ['Pliometría de piernas', 'Gemelos'], secundarios: ['Glúteos'] },
      tips: [
        'Baja a media sentadilla y salta verticalmente con máxima potencia.',
        'Aterriza suavemente de metatarso a talón absorbiendo el impacto con las rodillas.'
      ]
    },
    broad_jump: {
      musculos: { primarios: ['Potencia horizontal de piernas'], secundarios: ['Cadena posterior'] },
      tips: [
        'Salta hacia adelante buscando distancia y aterrizaje firme y equilibrado.'
      ]
    },
    lateral_bound: {
      musculos: { primarios: ['Potencia lateral', 'Estabilidad de tobillo y rodilla'], secundarios: ['Glúteo medio'] },
      tips: [
        'Impúlsate lateralmente de un pie al otro estabilizando 1 segundo en el aterrizaje.'
      ]
    },
    pogo: {
      musculos: { primarios: ['Reactividad de tobillo y tendón de Aquiles'], secundarios: ['Sóleo', 'Gemelos'] },
      tips: [
        'Rebotes cortos y rápidos minimizando el tiempo de contacto en el suelo.'
      ]
    },
    tuck_jump: {
      musculos: { primarios: ['Potencia explosiva', 'Flexores de cadera'], secundarios: ['Abdomen'] },
      tips: [
        'Salta verticalmente llevando las rodillas al pecho en el aire y aterriza suave.'
      ]
    },
    mancuerna: {
      musculos: { primarios: ['Fuerza general'], secundarios: ['Estabilidad'] },
      tips: [
        'Realiza cada repetición con rango de movimiento completo y control excéntrico.'
      ]
    }
  };

  // Normalizador de texto para comparaciones sin acentos.
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

  function infoDe(nombre, grupo) {
    var id = idDe(nombre, grupo);
    var data = METADATOS[id] || METADATOS.mancuerna;
    return {
      id: id,
      nombre: nombre,
      grupo: grupo || 'General',
      musculos: data.musculos || { primarios: ['General'], secundarios: [] },
      tips: data.tips || ['Controla el movimiento y mantén buena postura.']
    };
  }

  window.MIGYM_ILUSTRACIONES = {
    idDe: idDe,
    infoDe: infoDe,
    // Devuelve el SVG listo para inyectar como innerHTML, admitiendo clases extra para tamaño y animación.
    svgDe: function (nombre, grupo, extraCls) {
      var id = idDe(nombre, grupo);
      return svg(DIBUJOS[id] || DIBUJOS.mancuerna, extraCls);
    },
    dibujos: DIBUJOS,
    metadatos: METADATOS,
  };
})();
