// --- ENTORNO DE DESARROLLO ---------------------------------------------------
//
// Hoy: la AUTENTICACION va contra el Firebase real (gym-prandina-app).
//      Firestore NO se usa: no hay reglas desplegadas todavia, asi que sus
//      lecturas se rechazan y la app cae en los datos de ejemplo del codigo.
//      Es exactamente el MVP local que buscabamos.
//
// Volver a trabajar offline con el emulador:
//      Pone `useEmulators.auth: true` y arranca `npm run emulators`.
//      Con el emulador la apiKey no se valida, asi que estos mismos valores
//      sirven igual y no hace falta tocar nada mas.
//
// Guia completa: CONFIGURACION-FIREBASE.md
// -----------------------------------------------------------------------------
export const environment = {
  production: false,

  // Atajo SOLO para desarrollo local: quien entre con uno de estos correos
  // es admin, sin necesidad de Firestore. En produccion va vacio y el rol
  // sale del documento admins/{uid}.
  adminEmails: ['admin@gym.local'],

  useEmulators: {
    // false = habla con el Firebase real. true = con el emulador local.
    auth: false,
    // El de Firestore necesita un JDK 11+ (ver CONFIGURACION-FIREBASE.md).
    firestore: false
  },

  emulatorHosts: {
    auth: 'http://127.0.0.1:9099',
    firestore: { host: '127.0.0.1', port: 8080 }
  },

  // Configuracion del proyecto gym-prandina-app.
  // No son secretos: viajan en el bundle del navegador. La seguridad la dan
  // las reglas de Firestore, no estos valores.
  firebase: {
    apiKey: 'AIzaSyCJaYffHIqqIH-H7bpA4GglhXe3DUNhHfg',
    authDomain: 'gym-prandina-app.firebaseapp.com',
    projectId: 'gym-prandina-app',
    storageBucket: 'gym-prandina-app.firebasestorage.app',
    messagingSenderId: '30543540712',
    appId: '1:30543540712:web:46743c198e41824f50b45d'
  }
};
