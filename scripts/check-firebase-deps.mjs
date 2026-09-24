// Verifica que haya UNA sola copia del SDK de Firebase en el arbol.
//
// @angular/fire@20 declara `firebase: ^11.8.0`, pero el proyecto usa firebase 12.
// Sin el bloque `overrides` de package.json, npm instala una copia anidada en
// node_modules/@angular/fire/node_modules/firebase y quedan DOS SDK cargados:
//
//   - collection(), query() y where() salen de la copia v11 de @angular/fire
//   - collectionData() delega en rxfire, que usa la v12 de la raiz
//
// La consulta nace en una copia y se entrega a una funcion de la otra:
//
//   Expected type 'Query$1', but it was: a custom Query object
//
// Toda lectura de Firestore falla, y como los servicios manejan el error, la
// app parece andar pero no lee nada. Tardamos dias en verlo.
import { existsSync, readFileSync } from 'node:fs';

const ANIDADA = 'node_modules/@angular/fire/node_modules/firebase';
const version = (ruta) => JSON.parse(readFileSync(`${ruta}/package.json`, 'utf8')).version;

if (!existsSync('node_modules/firebase')) {
  console.log('check-firebase-deps: no hay dependencias instaladas, se omite.');
  process.exit(0);
}

const raiz = version('node_modules/firebase');

if (existsSync(ANIDADA)) {
  const duplicada = version(ANIDADA);
  console.error(`
╭──────────────────────────────────────────────────────────────────────╮
│  DOS COPIAS DEL SDK DE FIREBASE                                      │
╰──────────────────────────────────────────────────────────────────────╯

  raiz .............. firebase@${raiz}
  @angular/fire ..... firebase@${duplicada}

  Toda lectura de Firestore va a fallar con:
    Expected type 'Query$1', but it was: a custom Query object

  Como los servicios capturan el error, la app parece andar pero no lee
  nada de Firestore.

  Solucion: package.json tiene que incluir

    "overrides": { "firebase": "$firebase" }

  y despues correr  npm install
`);
  process.exit(1);
}

console.log(`check-firebase-deps: OK, una sola copia (firebase@${raiz}).`);
