import { openDB } from "idb";
import { gaLog } from "./firebase";

const DB_NAME = "tasker-db";
const STORE_NAME = "tasks";
const DB_VERSION = 3;

export async function initDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, tx) {
            let store;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            } else {
                store = tx.objectStore(STORE_NAME);
            }

            if (oldVersion < 2 && !store.indexNames.contains("by_user")) {
                store.createIndex("by_user", "userId", { unique: false });
            }

            if (oldVersion < 3 && !store.indexNames.contains("by_date")) {
                store.createIndex("by_date", "data", { unique: false });
            }

            if (oldVersion < 3 && !store.indexNames.contains("by_user_date")) {
                store.createIndex("by_user_date", ["userId", "data"], {
                    unique: false,
                });
            }
        },
    });
}

export async function addTask(task) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    await tx.store.put(task);
    await tx.done;
}

// PARA SYNC
export async function getTasks() {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const tasks = await tx.store.getAll();
    await tx.done;
    return tasks;
}

export async function getTasksByUser(userId) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.store.index("by_user");
    const tasks = await index.getAll(userId);
    await tx.done;
    return tasks;
}

export async function getTasksByUserAndDate(userId, data) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.store.index("by_user_date");
    const range = IDBKeyRange.only([userId, data]);
    const tasks = await index.getAll(range);
    await tx.done;
    return tasks;
}

export async function updateTaskDone(taskId, done) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const task = await store.get(taskId);
    if (!task) return;
    task.done = done;
    task.lastUpdated = new Date().toISOString();
    task.synced = false;
    await store.put(task);
    await tx.done;
    gaLog("task_marked_done", { done });
}

export async function markTaskDeleted(taskId) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const task = await store.get(taskId);
    if (!task) {
        await tx.done;
        return;
    }
    task._deleted = true;
    task.synced = false;
    task.lastUpdated = new Date().toISOString();
    await store.put(task);
    await tx.done;
    gaLog("task_deleted");
}

export async function hardDeleteTask(taskId) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    await tx.store.delete(taskId);
    await tx.done;
}
