// catalogo.js — El catálogo propio de ejercicios, sembrado desde tu rutina
// Upper/Lower (RutinaUpperLower.gs) + los nuevos de pliometría.
//
// tipo controla qué campos pide el formulario de cada serie:
//   'peso_reps'   → Peso (kg) + Reps        (fuerza clásica)
//   'reps'        → solo Reps               (peso corporal: colgado, rueda)
//   'tiempo'      → Segundos                (isométricos: planchas)
//   'pliometria'  → Reps + Altura cajón cm  (saltos)
//
// descanso está en SEGUNDOS (lo usa el cronómetro). series/reps es texto guía.
// Puedes editar este archivo libremente: añade, quita o renombra ejercicios.

window.MIGYM_CATALOGO = {
  // Cada sesión de la semana tipo. "libre" queda al final para registrar cualquier cosa.
  sesiones: [
    {
      id: 'upper_a',
      nombre: 'Upper A — empuje',
      ejercicios: [
        { nombre: 'Bench Press',                 grupo: 'Empuje', tipo: 'peso_reps', series: 4, reps: '6-8',   descanso: 150 },
        { nombre: 'Lever Seated Shoulder Press',  grupo: 'Empuje', tipo: 'peso_reps', series: 3, reps: '8-10',  descanso: 120 },
        { nombre: 'Incline Bench Press',          grupo: 'Empuje', tipo: 'peso_reps', series: 3, reps: '8-10',  descanso: 90 },
        { nombre: 'Lateral Raise',                grupo: 'Empuje', tipo: 'peso_reps', series: 3, reps: '12-15', descanso: 60 },
        { nombre: 'Triceps Pushdown',             grupo: 'Empuje', tipo: 'peso_reps', series: 3, reps: '10-12', descanso: 60 },
        { nombre: 'Plancha',                      grupo: 'Core',   tipo: 'tiempo',    series: 3, reps: '30-60s', descanso: 60 },
      ],
    },
    {
      id: 'lower_a',
      nombre: 'Lower A — cuádriceps',
      ejercicios: [
        { nombre: 'Box Jump',                     grupo: 'Pliometría', tipo: 'pliometria', series: 4, reps: '3-5', descanso: 120, nuevo: true },
        { nombre: 'Sled 45° Leg Press',           grupo: 'Piernas', tipo: 'peso_reps', series: 4, reps: '8-10',  descanso: 150 },
        { nombre: 'Dumbbell Goblet Squat',        grupo: 'Piernas', tipo: 'peso_reps', series: 3, reps: '8-10',  descanso: 120 },
        { nombre: 'Lever Leg Extension',          grupo: 'Piernas', tipo: 'peso_reps', series: 3, reps: '10-12', descanso: 90 },
        { nombre: 'Sled Calf Press On Leg Press', grupo: 'Piernas', tipo: 'peso_reps', series: 4, reps: '12-15', descanso: 60 },
        { nombre: 'Elevación de piernas colgado', grupo: 'Core',    tipo: 'reps',      series: 3, reps: '8-12',  descanso: 90 },
      ],
    },
    {
      id: 'upper_b',
      nombre: 'Upper B — tirón',
      ejercicios: [
        { nombre: 'Assisted Pull-up',             grupo: 'Tirón',  tipo: 'peso_reps', series: 4, reps: '6-8',   descanso: 150 },
        { nombre: 'One Arm Bent-over Row',        grupo: 'Tirón',  tipo: 'peso_reps', series: 3, reps: '8-10',  descanso: 90 },
        { nombre: 'Bar Lateral Pulldown',         grupo: 'Tirón',  tipo: 'peso_reps', series: 3, reps: '10-12', descanso: 90 },
        { nombre: 'Low Seated Row',               grupo: 'Tirón',  tipo: 'peso_reps', series: 3, reps: '10-12', descanso: 90 },
        { nombre: 'Preacher Curl',                grupo: 'Tirón',  tipo: 'peso_reps', series: 3, reps: '10-12', descanso: 60 },
        { nombre: 'Rueda abdominal desde rodillas', grupo: 'Core', tipo: 'reps',      series: 3, reps: '5-10',  descanso: 90 },
      ],
    },
    {
      id: 'lower_b',
      nombre: 'Lower B — cadena posterior',
      ejercicios: [
        { nombre: 'Jump Squat',                   grupo: 'Pliometría', tipo: 'pliometria', series: 3, reps: '5', descanso: 120, nuevo: true },
        { nombre: 'Broad Jump',                   grupo: 'Pliometría', tipo: 'pliometria', series: 3, reps: '3', descanso: 120, nuevo: true },
        { nombre: 'Straight Leg Deadlift',        grupo: 'Piernas', tipo: 'peso_reps', series: 4, reps: '6-8',   descanso: 150 },
        { nombre: 'Hip Thrust',                   grupo: 'Piernas', tipo: 'peso_reps', series: 4, reps: '8-10',  descanso: 120 },
        { nombre: 'Lever Lying Leg Curl',         grupo: 'Piernas', tipo: 'peso_reps', series: 3, reps: '10-12', descanso: 90 },
        { nombre: 'Sled Calf Press',              grupo: 'Piernas', tipo: 'peso_reps', series: 3, reps: '15-20', descanso: 60 },
        { nombre: 'Plancha lateral',              grupo: 'Core',    tipo: 'tiempo',    series: 3, reps: '20-40s', descanso: 60 },
        { nombre: 'Elevación de piernas colgado', grupo: 'Core',    tipo: 'reps',      series: 3, reps: '8-12',  descanso: 90 },
      ],
    },
    {
      id: 'libre',
      nombre: 'Libre / otro',
      ejercicios: [], // se elige ejercicio a mano desde el catálogo completo
    },
  ],

  // Banco extra de pliometría para cuando quieras variar (aparecen en "Libre").
  extras: [
    { nombre: 'Lateral Bound',   grupo: 'Pliometría', tipo: 'pliometria', series: 3, reps: '4', descanso: 90 },
    { nombre: 'Pogo Hops',       grupo: 'Pliometría', tipo: 'pliometria', series: 3, reps: '10', descanso: 90 },
    { nombre: 'Tuck Jump',       grupo: 'Pliometría', tipo: 'pliometria', series: 3, reps: '5', descanso: 90 },
  ],
};
