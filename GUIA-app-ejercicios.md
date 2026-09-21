# Mi Gym — guía de montaje y despliegue

App propia (PWA) para registrar ejercicios. Reemplaza el CSV de Lyfta: escribe directo
en la pestaña **Ejercicios** del Sheet `registro_salud_completo`, y el informe de salud
del sábado lee de ahí. Funciona **sin señal** en el gym (guarda local y sincroniza luego).

Publicada en: **https://jairesacevedo.github.io/mi-gym/** · Repo: https://github.com/jairesacevedo/mi-gym

```
APP-EJERCICIOS/  (repo mi-gym)
├─ docs/                    ← la PWA (GitHub Pages la sirve desde aquí)
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  ├─ catalogo.js          ← tus ejercicios (edítalo cuando quieras)
│  ├─ ilustraciones.js     ← los dibujos de cada ejercicio (SVG, sin descargas)
│  ├─ config.js            ← pega aquí la URL y el secreto (paso 2)
│  ├─ manifest.webmanifest
│  ├─ sw.js
│  └─ icons/
├─ apps-script/
│  └─ AppEjercicios.gs     ← se pega en el proyecto Apps Script (paso 1)
└─ GUIA-app-ejercicios.md
```

---

## Paso 1 — Backend (Apps Script, ~5 min)

1. Abre el proyecto Apps Script **"Informe Salud Semanal"** (el que tiene `InformeSalud.gs`).
2. **+ → Secuencia de comandos**, nómbralo `AppEjercicios`, y pega el contenido de
   `apps-script/AppEjercicios.gs`. Guarda.
3. Los cambios en `InformeSalud.gs` (usa `leerSesionesFuerza_()` y añade el grupo
   **Pliometría**) y en `RutinaUpperLower.gs` (saltos + notas) **ya están hechos en los
   archivos locales** — vuelve a pegar esos dos archivos en el editor para que la nube
   quede igual. (`RutinaUpperLower.gs` es opcional; solo re-genera el Doc de la rutina si
   corres `crearRutinaUpperLower()` otra vez.)
4. **Configuración del proyecto → Propiedades del script → Agregar propiedad:**
   - Nombre: `APP_SECRETO`
   - Valor: un texto largo y aleatorio (p. ej. 30+ caracteres). **Cópialo**, lo necesitas en el paso 2.
5. **Implementar → Nueva implementación → tipo Aplicación web:**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquiera**
   - Implementar → autoriza → **copia la URL que termina en `/exec`**.
6. Prueba rápida sin la app: pega esa URL `/exec` en el navegador. Debe responder
   `{"ok":true,"servicio":"AppEjercicios",...}`.
7. En el editor, **Ejecutar → `pruebaAppEjercicios`**. Revisa el registro (Ver → Registro):
   debe decir "Filas escritas: 3" y mostrar la última sesión con `sets:[{ej,peso,reps,e1rm}]`.
   En el Sheet aparecerá la pestaña **Ejercicios** con 3 filas `PRUEBA-...` (bórralas al terminar).

> Nota: cada vez que cambies los archivos `docs/` **no** hace falta re-implementar el backend.
> Pero si algún día cambias `AppEjercicios.gs`, usa **Implementar → Gestionar implementaciones
> → editar (lápiz) → Versión: Nueva** para que la URL `/exec` siga siendo la misma.

---

## Paso 2 — Conectar la app con el backend

Abre `docs/config.js` y rellena:

```js
window.MIGYM_CONFIG = {
  EXEC_URL: 'https://script.google.com/macros/s/AKfy..../exec',
  APP_SECRETO: 'el-mismo-secreto-largo-del-paso-1',
};
```

Si lo dejas vacío, la app igual funciona pero **solo guarda en el celular** (no sube al Sheet).

---

## Paso 3 — Publicar en GitHub Pages ✅ YA HECHO

El repo ya está creado y publicado: **https://jairesacevedo.github.io/mi-gym/**
(GitHub Pages sirve la carpeta `docs/` de la rama `main`).

**Para actualizar la app en el futuro** (tras editar cualquier archivo de `docs/`):
```bash
cd "APP-EJERCICIOS"
git add -A
git commit -m "describe el cambio"
git push
```
Espera ~1 minuto y GitHub Pages republica solo. Si cambiaste código, **sube el número de
`CACHE` en `docs/sw.js`** para que el celular tome la versión nueva (ver más abajo).

> Importante: GitHub Pages sirve por **HTTPS**, que es requisito para instalar una PWA y para
> que el service worker funcione. No abras la app por `file://` en el celular.

---

## Paso 4 — Instalar en el celular

1. Abre la URL de Pages en **Chrome (Android)** o **Safari (iPhone)**.
2. Menú **⋮ → Añadir a pantalla de inicio** (Android) o **Compartir → Añadir a inicio** (iPhone).
3. Ábrela desde el ícono: se ve como app, a pantalla completa.

---

## Cómo se usa

1. Elige la sesión del día (Upper A / Lower A / Upper B / Lower B) o **Libre**. La que
   toca según tu rotación viene marcada como **sugerida**.
2. Cada ejercicio muestra arriba la **sesión anterior serie por serie** (`1 69 kg × 8`,
   `2 69 kg × 8`, …) con su fecha, el volumen que hiciste y tu mejor marca. Esos mismos
   valores aparecen en gris dentro de las casillas: escribe encima solo lo que cambie, o
   toca **↺ repetir** para copiarlos todos de una vez.
3. Escribe **peso y reps** (o reps + altura de cajón en pliometría, o segundos en
   planchas) y toca el **círculo** para marcar la serie hecha → arranca el
   **cronómetro de descanso**. Si superas tu mejor marca sale un **★ PR**, y si mejoras
   la serie equivalente de la vez pasada la fila se marca en verde.
4. Para ajustar la sesión: `+ serie` / `− serie` al pie de cada ejercicio, la **✕** de cada
   fila quita esa serie, la **✕** del encabezado quita el ejercicio completo, y
   `+ Añadir ejercicio` mete cualquiera del catálogo (o de lo que ya hayas registrado).
5. Los chips **RPE** y **Notas** (arriba de la lista) añaden una casilla de esfuerzo
   percibido por serie y una nota por ejercicio. Se guardan en las columnas `RPE` y `Nota`
   de la pestaña **Ejercicios**. Quedan como los dejes: es una preferencia del celular.
6. **Guardar sesión** al terminar. Si hay internet, sube al Sheet; si no, queda en cola y
   sube sola cuando vuelva la señal (indicador arriba a la derecha: `↑` subiendo, `✓` ok, `!` error).

El punto/indicador de arriba a la derecha te dice el estado. Las sesiones pendientes también
aparecen como botón en la pantalla de inicio.

## Lo que puedes mirar

- **Inicio** — sesiones, volumen, series de la semana, racha de semanas seguidas y el
  volumen de las últimas 8 semanas en miniatura.
- **Historial** — acumulados de siempre y, en cada sesión, el reparto de series por grupo.
  Al abrir una: duración, volumen, reps, series de cada ejercicio y el botón
  **Repetir esta sesión** (la vuelve a armar igual para hoy).
- **Progreso** — eliges ejercicio y métrica (e1RM, peso máximo, volumen, reps… según el
  tipo), y salen la línea de progresión, tus mejores marcas y las últimas 8 sesiones
  serie a serie.
- **Resumen semanal** — esta semana contra la anterior, tendencia de 8 semanas con la
  métrica que quieras, series por grupo y los récords que hiciste en la semana.
- **Récords** — tu mejor marca por ejercicio, filtrable por grupo; tocando uno vas a su
  progreso.

---

## Editar tu catálogo

Todo tu banco de ejercicios está en `docs/catalogo.js`. Cada ejercicio es:

```js
{ nombre: 'Bench Press', grupo: 'Empuje', tipo: 'peso_reps', series: 4, reps: '6-8', descanso: 150 }
```

- `tipo`: `peso_reps` (peso+reps) · `reps` (solo reps) · `tiempo` (segundos) · `pliometria` (reps+altura cm).
- `descanso` en **segundos** (lo usa el cronómetro).
- `img` (opcional): URL de una foto para ese ejercicio. Si no la pones —lo normal— la app
  usa el dibujo vectorial que le toque.
- Añade o cambia lo que quieras. Tras editar, haz `git push` y **sube el número de
  `CACHE` en `docs/sw.js`** (va en `migym-v8`; súbelo a `migym-v9`, etc.) para que el celular
  tome la versión nueva.

### Los dibujos de los ejercicios

Están en `docs/ilustraciones.js`, dibujados a mano en SVG: no se descarga nada, pesan casi
nada y se ven bien en tema claro y oscuro. La app elige el dibujo buscando el nombre del
ejercicio en la lista `PATRONES` (sin acentos ni mayúsculas) y, si no encuentra nada, usa
el del grupo (Empuje, Tirón, Piernas, Core, Pliometría).

Si añades un ejercicio y sale el dibujo genérico, tienes dos opciones: agregar una palabra
suya a un patrón que ya exista (`[/pulldown|jalon/, 'jalon']`) o dibujar uno nuevo en
`DIBUJOS` y registrarlo en `PATRONES`.

Los nombres deben coincidir con los patrones de `CFG.gruposFuerza` en `InformeSalud.gs` para
que el informe los clasifique bien. Si registras un ejercicio nuevo que cae en "Otros", añade
una palabra clave de su nombre al grupo correspondiente.

---

## Cómo se conecta con el informe del sábado

`InformeSalud.gs` ahora llama a `leerSesionesFuerza_()` (en `AppEjercicios.gs`), que lee la
pestaña **Ejercicios** y entrega las sesiones en la **misma forma** que antes daba Lyfta. Por
eso todo lo de después (volumen, PRs, estancamiento, grupos, "Ajustes sugeridos") sigue igual.
Si algún sábado la pestaña estuviera vacía, cae solo al CSV de Lyfta — no se rompe nada.
