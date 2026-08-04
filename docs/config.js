// config.js — Solo la URL del backend (NO es sensible).
//
// La CLAVE de sincronización (APP_SECRETO) NO va aquí: como este repo es público,
// dejarla acá la expondría a cualquiera. En vez de eso, la app te la pide UNA sola vez
// en el celular y la guarda ahí (localStorage). Así el repo queda sin secretos.
//
// Si algún día usas la app en un repo privado y prefieres fijar la clave, puedes
// rellenar APP_SECRETO y la app la tomará de aquí.

window.MIGYM_CONFIG = {
  EXEC_URL: 'https://script.google.com/macros/s/AKfycbwxIfY8FWJ0EuAjrRMf7934zt-iMJQhoLDiv7DR7NZCItAOLJE1IDsQXLEaRFEWFo7elw/exec',
  APP_SECRETO: '',   // déjalo vacío: la app pide la clave una vez y la guarda en el celular
};
