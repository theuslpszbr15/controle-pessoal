// Conexão com o Firebase: login (Authentication) e dados sincronizados (Firestore com cache offline).
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import {
  EmailAuthProvider,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from '../vendor/firebase/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
} from '../vendor/firebase/firebase-firestore.js';

// Configuração pública do app web (a proteção dos dados fica nas regras do Firestore).
const firebaseConfig = {
  apiKey: 'AIzaSyDjcOK9ExEX5mzkl8QITtXo1bBDW2tZ1LU',
  authDomain: 'controle-pessoal-babc1.firebaseapp.com',
  projectId: 'controle-pessoal-babc1',
  storageBucket: 'controle-pessoal-babc1.firebasestorage.app',
  messagingSenderId: '197101766748',
  appId: '1:197101766748:web:f15c4eb6deb6fcabc8fe99',
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

// O Firebase pede e-mail; o app usa só "usuário", então criamos um e-mail interno.
const DOMINIO = 'controle-pessoal.app';
export const emailDe = (usuario) => `${usuario}@${DOMINIO}`;
export const usuarioDe = (email = '') => email.split('@')[0];

export function sessaoAtual() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
}

export async function entrarNaNuvem(usuario, senha, manter) {
  await setPersistence(auth, manter ? indexedDBLocalPersistence : browserSessionPersistence);
  return (await signInWithEmailAndPassword(auth, emailDe(usuario), senha)).user;
}

export async function cadastrarNaNuvem(usuario, senha, nome, manter) {
  await setPersistence(auth, manter ? indexedDBLocalPersistence : browserSessionPersistence);
  const { user } = await createUserWithEmailAndPassword(auth, emailDe(usuario), senha);
  await updateProfile(user, { displayName: nome });
  return user;
}

export const sairDaNuvem = () => signOut(auth);

export async function trocarSenhaNuvem(atual, nova) {
  const user = auth.currentUser;
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, atual));
  await updatePassword(user, nova);
}

export const atualizarNomeNuvem = (nome) => auth.currentUser && updateProfile(auth.currentUser, { displayName: nome });

// Dados do usuário: users/{uid}/dados/{chave} -> { v: JSON, t: timestamp }
export const colecaoDados = (uid) => collection(db, 'users', uid, 'dados');
export const salvarChave = (uid, key, value) => setDoc(doc(db, 'users', uid, 'dados', key), { v: JSON.stringify(value), t: Date.now() });
export const apagarChave = (uid, key) => deleteDoc(doc(db, 'users', uid, 'dados', key));
export { onSnapshot };
