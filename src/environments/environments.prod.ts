// ─── ENTORNO DE PRODUCCIÓN ───────────────────────────────────────────────────
// angular.json reemplaza environments.ts por este archivo en el build de
// producción (`ng build`). Nunca usa emuladores.
//
// ⚠️  REEMPLAZAR el bloque `firebase` por la configuración del proyecto real.
//     Está en: consola de Firebase → ⚙ Configuración del proyecto → Tus apps
//     → SDK setup and configuration → Config.
//
//     Estos valores NO son secretos (van en el bundle del navegador y
//     cualquiera puede leerlos). La seguridad la dan firestore.rules, no ellos.
//
// Pasos completos en CONFIGURACION-FIREBASE.md
// ─────────────────────────────────────────────────────────────────────────────
export const environment = {
  production: true,


  // Vacio a proposito: en produccion el rol sale solo de admins/{uid}.
  adminEmails: [] as string[],

  useEmulators: {
    auth: false,
    firestore: false
  },

  emulatorHosts: {
    auth: 'http://127.0.0.1:9099',
    firestore: { host: '127.0.0.1', port: 8080 }
  },

  // ⚠️ Configuración del proyecto `gym-prandina-app`, tal como estaba en el
  // repo. Si vas a usar otro proyecto de Firebase, reemplazá todo este bloque.
  firebase: {
    apiKey: 'AIzaSyCJaYffHIqqIH-H7bpA4GglhXe3DUNhHfg',
    authDomain: 'gym-prandina-app.firebaseapp.com',
    projectId: 'gym-prandina-app',
    storageBucket: 'gym-prandina-app.firebasestorage.app',
    messagingSenderId: '30543540712',
    appId: '1:30543540712:web:46743c198e41824f50b45d'
  }
};
