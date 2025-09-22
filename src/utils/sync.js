import { getTasks, addTask, hardDeleteTask } from "./db";
import {
    addTaskToFirebase,
    updateTaskDoneInFirebase,
    deleteTaskInFirebase,
} from "./firebase";

async function notifySync({ sent = 0, updated = 0, deleted = 0 }) {
    try {
        if (typeof window === "undefined" || !("Notification" in window))
            return;

        const isSecure =
            location.protocol === "https:" ||
            location.hostname === "localhost" ||
            location.hostname === "127.0.0.1";

        if (!isSecure) return;

        const total = sent + updated + deleted;
        if (!total) return; // nada pra avisar

        const parts = [];
        if (sent) parts.push(`${sent} enviada(s)`);
        if (updated) parts.push(`${updated} atualizada(s)`);
        if (deleted) parts.push(`${deleted} excluída(s)`);
        const body = `Sincronização concluída: ${parts.join(" · ")}`;

        if (Notification.permission === "granted") {
            new Notification("Tarefas sincronizadas", {
                body,
                icon: "/icons/tasker-192.png",
            });
            return;
        }
        if (Notification.permission !== "denied") {
            const p = await Notification.requestPermission();
            if (p === "granted") {
                new Notification("Tarefas sincronizadas", {
                    body,
                    icon: "/icons/tasker-192.png",
                });
            }
        }
    } catch (e) {
        console.debug("notifySync falhou:", e);
    }
}

export async function syncTasks() {
    const tasks = await getTasks();

    const toDelete = tasks.filter((t) => t._deleted === true);
    let deleted = 0;
    for (const t of toDelete) {
        try {
            await deleteTaskInFirebase(t.id);
            await hardDeleteTask(t.id);
            deleted++;
        } catch (error) {
            console.error("Erro ao sincronizar deleção:", t, error);
        }
    }

    const unsynced = tasks.filter((t) => !t.synced && t._deleted !== true);
    let sent = 0;
    let updated = 0;

    for (const t of unsynced) {
        try {
            if (t._onlyDoneUpdate) {
                await updateTaskDoneInFirebase(t.id, t.done);
                updated++;
            } else {
                await addTaskToFirebase(t);
                sent++;
            }
            t.synced = true;
            await addTask(t); // persiste flag synced
        } catch (error) {
            console.error("Error syncing task:", t, error);
            continue;
        }
    }

    // notifica só se houve ação
    await notifySync({ sent, updated, deleted });
}
