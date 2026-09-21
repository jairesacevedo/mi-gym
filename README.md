# Mi Gym

App propia (PWA) para registrar ejercicios en el gimnasio. Reemplaza la exportación
manual de Lyfta: escribe las series directo en una Google Sheet, y desde ahí alimenta
el informe semanal de salud.

**App en vivo:** https://jairesacevedo.github.io/mi-gym/

## Qué hace

- Registrar series por sesión (fuerza, pliometría, isométricos, peso corporal) con
  cronómetro de descanso.
- **La sesión anterior, serie por serie**: en cada ejercicio ves el peso y las reps de
  cada serie de la última vez, como pista dentro de las casillas, y con un toque las
  copias para arrancar desde ahí.
- **Armar la sesión sobre la marcha**: añadir o quitar ejercicios, y subir o bajar series.
- **Dibujo de cada ejercicio** (vectorial, funciona sin señal).
- Marcadores en vivo de la sesión, **RPE** y **notas** opcionales por ejercicio.
- **Historial** con detalle de cada sesión, **progreso por ejercicio** (varias métricas y
  gráficas), **resumen semanal** con tendencia de 8 semanas y **récords personales**.
- Funciona **sin señal**: guarda en el celular y sincroniza al volver el internet.
- Instalable en la pantalla de inicio (PWA).

## Estructura

```
docs/           La PWA (esto es lo que publica GitHub Pages)
apps-script/    Backend: AppEjercicios.gs (se pega en el proyecto Apps Script)
GUIA-app-ejercicios.md   Guía completa de montaje y despliegue
```

## Puesta en marcha

El frontend ya queda publicado por GitHub Pages. Para conectar el guardado en la Sheet,
sigue [`GUIA-app-ejercicios.md`](GUIA-app-ejercicios.md): desplegar el backend en Apps
Script y pegar la URL `/exec` + el secreto en `docs/config.js`.
