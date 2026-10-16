/* Só as partes do Firebase que o site usa. `npm run vendor` junta tudo em js/vendor/firebase.js
   (um script comum, que deixa a variável global FB). */
export { initializeApp } from "firebase/app";
export {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  onAuthStateChanged,
  signOut,
  connectAuthEmulator,
} from "firebase/auth";
export {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  connectFirestoreEmulator,
  collection,
  doc,
  setDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  writeBatch,
  query,
  limit,
  Bytes,
} from "firebase/firestore";
