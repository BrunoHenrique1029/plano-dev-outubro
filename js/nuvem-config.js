/* Ligação com a nuvem (Firebase). É o firebaseConfig do console do Firebase
   (Configurações do projeto > Seus aplicativos > Config).
   Esses dados não são senha: quem protege o mapa são as regras do Firestore.
   Trocando o bloco por null, o site volta a salvar só neste navegador. */
const NUVEM_CONFIG = {
  apiKey: "AIzaSyDMcdsHcux3YBEJ8UgO_xgpAgnEw1O8Bcw",
  authDomain: "plano-dev-outubro.firebaseapp.com",
  projectId: "plano-dev-outubro",
  storageBucket: "plano-dev-outubro.firebasestorage.app",
  messagingSenderId: "409066523044",
  appId: "1:409066523044:web:5849c7e419fb2cb4439931",
};
