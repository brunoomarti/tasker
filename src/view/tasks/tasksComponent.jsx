import {
    motion,
    AnimatePresence,
    useMotionValue,
    useTransform,
    animate,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
    getTasksByUser,
    getTasksByUserAndDate,
    updateTaskDone,
    markTaskDeleted,
} from "../../utils/db";
import { syncTasks } from "../../utils/sync";
import { useAuth } from "../../contexts/AuthContext";
import ConfirmDeleteModal from "../components/modal/confirmDeleteModal";
import { getAddressCached } from "../../utils/geocode";

const SWIPE_LOCK_X = 80;
const DRAG_MAX_X = 90;

function TaskRow({
    task,
    isOpen,
    isExpanded,
    flashingId,
    delayId,
    onToggleDone,
    onOpenSwipe,
    onCloseSwipe,
    onAskDelete,
    onToggleExpand,
}) {
    const x = useMotionValue(0);
    const draggingRef = useRef(false);

    useEffect(() => {
        const controls = animate(x, isOpen ? SWIPE_LOCK_X : 0, {
            duration: 0.2,
        });
        return controls.stop;
    }, [isOpen, x]);

    const progress = useTransform(x, [0, SWIPE_LOCK_X], [0, 1]);
    const trashWidth = useTransform(progress, [0, 1], [48, 70]);
    const trashRadius = useTransform(progress, [0, 1], [24, 16]);
    const trashOpacity = useTransform(progress, [0, 1], [0, 1]);
    const trashHeight = useTransform(progress, [0, 1], [90, 98]);

    const opacityMV = useMotionValue(task.done ? 0.7 : 1);

    useEffect(() => {
        if (task.done) {
            const t = setTimeout(() => {
                animate(opacityMV, 0.7, { duration: 0.2 });
            }, 300);
            return () => clearTimeout(t);
        }
        opacityMV.set(1);
    }, [task.done, opacityMV]);

    function onDragStart() {
        draggingRef.current = true;
        onOpenSwipe(null);
    }

    function onDragEnd(_e, info) {
        const current = x.get();
        const v = info.velocity.x || 0;

        const shouldOpen =
            current > SWIPE_LOCK_X * 0.5 ||
            (current > SWIPE_LOCK_X * 0.25 && v > 250);

        const target = shouldOpen ? SWIPE_LOCK_X : 0;

        animate(x, target, { type: "spring", stiffness: 700, damping: 40 });

        if (shouldOpen) onOpenSwipe(task.id);
        else onCloseSwipe();
        setTimeout(() => (draggingRef.current = false), 0);
    }

    function toDate(value) {
        if (!value) return null;
        if (typeof value === "string") return new Date(value);
        if (value?.toDate) return value.toDate();
        if (value?.seconds) return new Date(value.seconds * 1000);
        return null;
    }

    const createdAtDate = toDate(task.createdAt || task.createdAtServer);
    const createdAtStr = createdAtDate
        ? createdAtDate.toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
          })
        : "—";

    const [addr, setAddr] = useState(null);
    const [addrStatus, setAddrStatus] = useState("idle");

    useEffect(() => {
        let active = true;
        async function load() {
            if (!isExpanded || !task?.location?.lat || !task?.location?.lng)
                return;

            if (!navigator.onLine) {
                if (active) setAddrStatus("offline");
                return;
            }

            setAddrStatus("loading");
            const a = await getAddressCached(
                task.location.lat,
                task.location.lng
            );
            if (!active) return;

            if (a) {
                setAddr(a);
                setAddrStatus("done");
            } else {
                setAddrStatus("error");
            }
        }

        load();

        function onOnline() {
            if (isExpanded) load();
        }
        window.addEventListener("online", onOnline);

        return () => {
            active = false;
            window.removeEventListener("online", onOnline);
        };
    }, [isExpanded, task?.location?.lat, task?.location?.lng]);

    return (
        <motion.div
            data-taskid={task.id}
            layout="position"
            initial={false}
            style={{ position: "relative", zIndex: task.done ? 0 : 1 }}
            transition={{ layout: { delay: delayId ? 0.4 : 0 } }}
        >
            <div
                className="trash-layer"
                style={{
                    position: "absolute",
                    inset: 0,
                    display: task.done && !isOpen ? "none" : "flex",
                    alignItems: "center",
                    pointerEvents: isOpen ? "auto" : "none",
                }}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <motion.button
                    className="trash-btn"
                    onClick={() => onAskDelete(task.id)}
                    title="Excluir tarefa"
                    style={{
                        backgroundColor: "#e15e5b",
                        color: "white",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: "0.5rem",
                        fontSize: "1.2rem",
                        height: trashHeight,
                        width: trashWidth,
                        borderRadius: trashRadius,
                        opacity: trashOpacity,
                    }}
                >
                    <span className="material-symbols-outlined">delete</span>
                </motion.button>
            </div>

            <motion.div
                layout
                className={`task-card ${task.done ? "concluida" : ""} ${
                    flashingId === task.id ? "anim-reflexo" : ""
                } d-flex flex-row justify-space-between gap-5`}
                initial={false}
                style={{ x, opacity: opacityMV, overflow: "hidden" }}
                drag="x"
                dragElastic={0}
                dragMomentum={false}
                dragConstraints={{ left: 0, right: DRAG_MAX_X }}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onPointerDown={(e) => e.stopPropagation()}
                whileTap={{ backgroundColor: "#ececec" }}
                transition={{
                    backgroundColor: { duration: 0.12 },
                    scale: { duration: 0.06 },
                }}
            >
                <div className="task-icon-container d-flex">
                    <span className="material-symbols-outlined">
                        assignment
                    </span>
                </div>

                <div className="task-body d-flex flex-row gap-10 overflow-hidden justify-space-between overflow-hidden">
                    <motion.div
                        className="task-left d-flex flex-column gap-5 justify-space-between overflow-hidden"
                        onTap={(e) => {
                            e.stopPropagation();
                            if (draggingRef.current) return;
                            onToggleExpand(task.id);
                        }}
                    >
                        <div className="d-flex flex-column">
                            <div className="d-flex flex-row align-items-center">
                                <div className="d-flex flex-column sync-status">
                                    {task.synced ? (
                                        <span className="material-symbols-outlined">
                                            cloud_done
                                        </span>
                                    ) : (
                                        <span className="material-symbols-outlined">
                                            cloud_off
                                        </span>
                                    )}
                                </div>
                                <h3 className="align-left">{task.title}</h3>
                            </div>
                            <p
                                className="desc one-line"
                                title={task.descricao || "Autodescritiva"}
                            >
                                {task.descricao && task.descricao.trim() ? (
                                    task.descricao
                                ) : (
                                    <em>Autodescritiva</em>
                                )}
                            </p>

                            <AnimatePresence initial={false}>
                                {isExpanded && (
                                    <motion.div
                                        key="extra"
                                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                        animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                        transition={{ duration: 0.2 }}
                                        style={{ overflow: "hidden" }}
                                        className="task-extra"
                                    >
                                        <div className="d-flex flex-column gap-5 meta">
                                            <p className="d-flex flex-row align-items-center">
                                                <span
                                                    className="material-symbols-outlined"
                                                    style={{ marginRight: 4 }}
                                                >
                                                    event
                                                </span>
                                                Criada em: {createdAtStr}
                                            </p>
                                            {task.location ? (
                                                <p className="d-flex flex-row align-items-start overflow-hidden">
                                                    <span
                                                        className="material-symbols-outlined"
                                                        style={{
                                                            marginRight: 4,
                                                            paddingTop: 1,
                                                        }}
                                                    >
                                                        location_on
                                                    </span>
                                                    {addrStatus === "loading" &&
                                                        "Buscando endereço..."}
                                                    {addrStatus === "offline" &&
                                                        "Endereço indisponível (offline)"}
                                                    {addrStatus === "error" &&
                                                        "Endereço não encontrado"}
                                                    {addrStatus === "done" && (
                                                        <span className="address-text">
                                                            {addr}
                                                        </span>
                                                    )}
                                                </p>
                                            ) : (
                                                <p className="d-flex flex-row align-items-center">
                                                    <span
                                                        className="material-symbols-outlined"
                                                        style={{
                                                            marginRight: 4,
                                                        }}
                                                    >
                                                        location_off
                                                    </span>
                                                    Sem localização
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="d-flex flex-row task-type">
                            <p>Tarefa individual</p>
                        </div>
                    </motion.div>

                    <div
                        className="task-right d-flex flex-column justify-space-between overflow-hidden"
                        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    >
                        <p className="d-flex flex-row align-items-center task-deadline justify-end">
                            <span className="material-symbols-outlined">
                                schedule
                            </span>
                            {task.hora}
                        </p>

                        <div
                            className="d-flex status justify-end"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleDone(task.id); }}
                            style={{ cursor: "pointer" }}
                            title={
                                task.done
                                    ? "Marcar como pendente"
                                    : "Marcar como concluída"
                            }
                        >
                            <div
                                className={
                                    task.done
                                        ? "status-concluida"
                                        : "status-pendente"
                                }
                            />
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

function Tasks() {
    const [tasks, setTasks] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [flashingId, setFlashingId] = useState(null);
    const [delayId, setDelayId] = useState(null);
    const flashTimerRef = useRef(null);
    const delayTimerRef = useRef(null);
    const { currentUser } = useAuth();

    const [openSwipeId, setOpenSwipeId] = useState(null);
    const [confirmId, setConfirmId] = useState(null);

    const todayYMD = () => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };

    useEffect(() => {
        fetchTasks();
        if (navigator.onLine) syncAndReload();

        function onOnline() {
            syncAndReload();
        }
        function onOffline() {
            fetchTasks();
        }

        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);

        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
        };
    }, [currentUser?.uid]);

    useEffect(() => {
        if (!openSwipeId) return;

        function handleGlobalPointerDown(e) {
            const el = e.target.closest("[data-taskid]");
            if (el && el.dataset.taskid === openSwipeId) return;
            setOpenSwipeId(null);
        }

        document.addEventListener("pointerdown", handleGlobalPointerDown, {
            capture: true,
        });
        return () =>
            document.removeEventListener(
                "pointerdown",
                handleGlobalPointerDown,
                { capture: true }
            );
    }, [openSwipeId]);

    async function syncAndReload() {
        await syncTasks();
        await fetchTasks();
    }

    async function fetchTasks() {
        const uid = currentUser?.uid;
        if (!uid) return setTasks([]);

        const hoje = todayYMD();
        let todayTasks = [];
        try {
            todayTasks = await getTasksByUserAndDate(uid, hoje);
        } catch (e) {
            console.warn("getTasksByUserAndDate falhou:", e);
        }
        if (!todayTasks || todayTasks.length === 0) {
            try {
                const all = await getTasksByUser(uid);
                todayTasks = all.filter((t) => (t.data ?? hoje) === hoje);
            } catch (e) {
                console.warn("getTasksByUser falhou:", e);
                todayTasks = [];
            }
        }

        const ordered = todayTasks
            .filter((t) => t._deleted !== true)
            .slice()
            .sort((a, b) => {
                if (a.done !== b.done) return a.done - b.done;
                return String(a.hora).localeCompare(String(b.hora));
            });

        setTasks(ordered);
        setOpenSwipeId(null);
    }

    async function toggleDone(taskId) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        const willBeDone = !task.done;
        if (willBeDone) {
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
            setFlashingId(taskId);
            setDelayId(taskId);
        } else {
            setFlashingId(null);
            setDelayId(null);
        }

        await updateTaskDone(taskId, willBeDone);
        await fetchTasks();
        if (navigator.onLine) await syncAndReload();

        if (willBeDone) {
            flashTimerRef.current = setTimeout(() => setFlashingId(null), 600);
            delayTimerRef.current = setTimeout(() => setDelayId(null), 800);
        }
    }

    function askDelete(id) {
        setConfirmId(id);
    }
    function closeModal() {
        setConfirmId(null);
    }

    async function confirmDelete() {
        const id = confirmId;
        if (!id) return;
        try {
            await markTaskDeleted(id);
            if (navigator.onLine) await syncTasks();
        } catch (e) {
            console.error("Erro ao marcar para deleção:", e);
            alert("Não foi possível excluir a tarefa.");
        } finally {
            closeModal();
            setOpenSwipeId(null);
            await fetchTasks();
        }
    }

    return (
        <div className="d-flex flex-column gap-10 align-left">
            {tasks.length === 0 && (
                <p className="desc">Nenhuma tarefa encontrada.</p>
            )}

            <AnimatePresence>
                {tasks.map((task) => (
                    <TaskRow
                        key={task.id}
                        task={task}
                        isOpen={openSwipeId === task.id}
                        isExpanded={expandedId === task.id}
                        flashingId={flashingId}
                        delayId={delayId}
                        onToggleDone={toggleDone}
                        onToggleExpand={(id) =>
                            setExpandedId((prev) => (prev === id ? null : id))
                        }
                        onOpenSwipe={(id) => {
                            if (!id) setOpenSwipeId(null);
                            else setOpenSwipeId(id);
                            setExpandedId(null);
                        }}
                        onCloseSwipe={() => setOpenSwipeId(null)}
                        onAskDelete={(id) => askDelete(id)}
                    />
                ))}
            </AnimatePresence>

            <ConfirmDeleteModal
                open={!!confirmId}
                taskTitle={tasks.find((t) => t.id === confirmId)?.title}
                onCancel={closeModal}
                onConfirm={confirmDelete}
            />
        </div>
    );
}

export default Tasks;
