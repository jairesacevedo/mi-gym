# Mi Gym

App propia (PWA) para registrar ejercicios en el gimnasio. Reemplaza la exportación
manual de Lyfta: escribe las series directo en una Google Sheet, y desde ahí alimenta
el informe semanal de salud.

**App en vivo:** https://jairesacevedo.github.io/mi-gym/

## Qué hace

- Registrar series por sesión (fuerza, pliometría, isométricos, peso corporal) con
  cronómetro de descanso.
- Funciona **sin señal**: guarda en el celular y sincroniza al volver el internet.
- **Historial** de sesiones, **progreso por ejercicio** (gráficas) y **resumen semanal**
  comparando con la semana anterior.
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
