import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = (!firebaseConfig.firestoreDatabaseId || firebaseConfig.firestoreDatabaseId === 'remixed-firestore-database-id')
  ? undefined
  : firebaseConfig.firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Suppress Firestore warnings like "Detected an update time that is in the future"
setLogLevel('error');

enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Firebase offline persistence error:", err.code);
});

export const auth = getAuth(app);
