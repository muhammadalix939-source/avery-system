import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with Database ID and ignoreUndefinedProperties (prevents crashes on optional fields)
export const db = (() => {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId);
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
})();

// Initialize Authentication
export const auth = getAuth(app);

// Error Handling Specification matching system requirements
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate Connection to Firestore
 * Only runs remote probe when authenticated or explicitly requested
 */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  if (typeof window === "undefined") {
    return { ok: true, message: "Server-side render (bypassed)" };
  }
  if (!auth.currentUser) {
    return { ok: true, message: "Local mode active (sign in to sync with Cloud DB)" };
  }
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return { ok: true, message: "Connected to Cloud Firestore" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("the client is offline") || msg.includes("token-service-api")) {
      return { ok: false, message: "Cloud connection offline or token service pending" };
    }
    // If permission or not found, it still proves connection reached Firestore server
    return { ok: true, message: "Connection verified" };
  }
}

/**
 * Sign in using Google Provider via popup
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    const msgLower = msg.toLowerCase();
    const currentHost = typeof window !== "undefined" ? window.location.hostname : "";

    if (code === "auth/unauthorized-domain") {
      const errorMsg = `Domain "${currentHost}" is not authorized. Please add "${currentHost}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (code === "auth/missing-initial-state" || msgLower.includes("missing initial state") || msgLower.includes("sessionstorage")) {
      throw new Error(
        "Mobile App WebView blocked Google popup. Please open this app in your device's browser (Chrome / Safari)."
      );
    }
    if (code === "auth/popup-blocked" || msgLower.includes("popup")) {
      throw new Error("Popup blocked. Please open this app in your mobile browser (Chrome/Safari) or enable popups.");
    }
    if (code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in popup was closed before completing.");
    }
    console.error("Sign in with Google error:", err);
    throw err;
  }
}

/**
 * Sign out current user
 */
export async function logOut(): Promise<void> {
  await signOut(auth);
}

/**
 * Push an entity to a Firestore collection
 */
export async function syncDocToFirestore(collectionName: string, id: string, data: Record<string, unknown>) {
  if (!auth.currentUser) return;
  const path = `${collectionName}/${id}`;
  try {
    await setDoc(doc(db, collectionName, id), data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete an entity from a Firestore collection
 */
export async function deleteDocFromFirestore(collectionName: string, id: string) {
  if (!auth.currentUser) return;
  const path = `${collectionName}/${id}`;
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Pull all documents from a Firestore collection
 */
export async function fetchCollectionFromFirestore<T>(collectionName: string): Promise<T[]> {
  const path = collectionName;
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map((d) => d.data() as T);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Recursively cleans undefined and non-serializable fields before sending to Firestore
 */
export function cleanDataForFirestore<T>(data: T): T {
  if (data === undefined || data === null) return data;
  return JSON.parse(JSON.stringify(data));
}

/**
 * Fetch a single document from Firestore
 */
export async function fetchDocFromFirestore<T>(collectionName: string, id: string): Promise<T | null> {
  const path = `${collectionName}/${id}`;
  try {
    const snap = await getDoc(doc(db, collectionName, id));
    if (!snap.exists()) return null;
    return snap.data() as T;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Push full app state to Firestore
 */
export async function pushFullStateToFirestore(state: {
  clients: unknown[];
  bookings: unknown[];
  agents: unknown[];
  suppliers: unknown[];
  entries: unknown[];
  groups: unknown[];
  accounts: unknown[];
  drawers?: unknown[];
  opening: unknown;
  alertSettings: unknown;
}) {
  if (!auth.currentUser) {
    throw new Error("Must be signed in to sync to Cloud Database");
  }

  const collectionsToSync: Array<{ name: string; items: Array<{ id: string }> }> = [
    { name: "clients", items: (state.clients || []) as Array<{ id: string }> },
    { name: "bookings", items: (state.bookings || []) as Array<{ id: string }> },
    { name: "agents", items: (state.agents || []) as Array<{ id: string }> },
    { name: "suppliers", items: (state.suppliers || []) as Array<{ id: string }> },
    { name: "entries", items: (state.entries || []) as Array<{ id: string }> },
    { name: "groups", items: (state.groups || []) as Array<{ id: string }> },
    { name: "accounts", items: (state.accounts || []) as Array<{ id: string }> },
    { name: "drawers", items: (state.drawers || []) as Array<{ id: string }> },
  ];

  for (const { name, items } of collectionsToSync) {
    if (!items || items.length === 0) continue;
    // Chunk writes in batches of 400
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        if (item.id) {
          const cleanItem = cleanDataForFirestore(item);
          batch.set(doc(db, name, String(item.id)), cleanItem, { merge: true });
        }
      }
      await batch.commit();
    }
  }

  // Save settings with clean serialization
  if (state.opening) {
    await setDoc(doc(db, "settings", "opening"), { id: "opening", data: cleanDataForFirestore(state.opening) }, { merge: true });
  }
  if (state.alertSettings) {
    await setDoc(doc(db, "settings", "alertSettings"), { id: "alertSettings", data: cleanDataForFirestore(state.alertSettings) }, { merge: true });
  }
}

export { onAuthStateChanged, type User };
