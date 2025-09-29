import { initializeApp } from "firebase/app";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    signOut,
} from "firebase/auth";
import {
    getFirestore,
    collection,
    setDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    updateDoc,
    serverTimestamp,
    deleteDoc,
} from "firebase/firestore";
import {
    getAnalytics,
    isSupported,
    logEvent,
    setUserId,
    setUserProperties,
} from "firebase/analytics";

const TASKS_COLLECTION = "tasks";
const USERS_COLLECTION = "users";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export const auth = getAuth(app);

let analytics = null;
(async () => {
    try {
        if (typeof window !== "undefined" && firebaseConfig.measurementId) {
            const ok = await isSupported().catch(() => false);
            if (ok) analytics = getAnalytics(app);
        }
    } catch {}
})();

// Helper para logar eventos com segurança
export function gaLog(name, params = {}) {
    try {
        if (analytics) logEvent(analytics, name, params);
    } catch {}
}

// (opcional) vincular user_id quando logar
export function gaSetUser(uid) {
    try {
        if (analytics && uid) setUserId(analytics, uid);
    } catch {}
}
export function gaSetProps(props) {
    try {
        if (analytics && props) setUserProperties(analytics, props);
    } catch {}
}

export function logIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function logOut() {
    return signOut(auth);
}

export async function register(email, password, name) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(
        doc(db, USERS_COLLECTION, cred.user.uid),
        {
            name,
            email: cred.user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        },
        { merge: true },
    );
    return cred.user;
}

export async function addTaskToFirebase(task, userId) {
    const payload = {
        ...task,
        userId: task.userId ?? userId ?? null,
        descricao: task.descricao ?? "",
        data: task.data,
        createdAt: task.createdAt ?? serverTimestamp(),
        createdAtServer: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        synced: true,
    };
    const ref = doc(db, TASKS_COLLECTION, payload.id);
    await setDoc(ref, payload);
}

export async function getTasksFromFirebase(userId) {
    const ref = collection(db, TASKS_COLLECTION);
    const q = query(
        ref,
        where("userId", "==", userId),
        orderBy("data"),
        orderBy("hora"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateTaskDoneInFirebase(taskId, done) {
    const ref = doc(db, TASKS_COLLECTION, taskId);
    await updateDoc(ref, {
        done,
        lastUpdated: serverTimestamp(),
        synced: true,
    });
}

export async function deleteTaskInFirebase(taskId) {
    const ref = doc(db, TASKS_COLLECTION, taskId);
    await deleteDoc(ref);
}
