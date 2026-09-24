// ─── ENTORNO DE DESARROLLO ───────────────────────────────────────────────────
// Apunta al Firebase Emulator Suite local: no necesita credenciales reales ni
// acceso a la consola de Firebase. Los datos viven en tu máquina y se borran
// al apagar el emulador.
//
// El prefijo `demo-` en projectId es una convención de Firebase: los proyectos
// que empiezan así NUNCA contactan servidores reales, aunque te equivoques.
//
// Para conectar el Firebase real, ver CONFIGURACION-FIREBASE.md
// ─────────────────────────────────────────────────────────────────────────────
export const environment = {
  production: false,


  // Atajo SOLO para desarrollo local: quien entre con uno de estos correos
  // es admin, sin necesidad de Firestore. En produccion va vacio y el rol
  // sale del documento admins/{uid}.
  adminEmails: ['admin@gym.local'],

  useEmulators: {
    // El emulador de Auth corre en Node: no requiere Java.
    auth: true,
    // El de Firestore necesita un JDK 11+. Poné esto en `true` cuando lo
    // tengas instalado (ver CONFIGURACION-FIREBASE.md → "Emulador de Firestore").
    firestore: false
  },

  emulatorHosts: {
    auth: 'http://127.0.0.1:9099',
    firestore: { host: '127.0.0.1', port: 8080 }
  },

  // Valores ficticios: con emuladores la apiKey no se valida.
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-gym-prandina.firebaseapp.com',
    projectId: 'demo-gym-prandina',
    storageBucket: 'demo-gym-prandina.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000'
  }
};
