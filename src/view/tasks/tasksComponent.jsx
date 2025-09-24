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
import { exportTask, copyTaskToClipboard } from "../../utils/native";
import { createPortal } from "react-dom";

const SWIPE_LOCK_X = 80;
const DRAG_MAX_X = 90;
const SWIPE_LOCK_LEFT = -80;

function TaskRow({
    task,
    isOpen,
    openDir,
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
    const [menuOpen, setMenuOpen] = useState(false);
    const moreBtnRef = useRef(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const menuRef = useRef(null);

    useEffect(() => {
        const target = isOpen
            ? openDir === "left"
                ? SWIPE_LOCK_LEFT
                : SWIPE_LOCK_X
            : 0;
        const controls = animate(x, target, { duration: 0.2 });
        return controls.stop;
    }, [isOpen, openDir, x]);

    const progressRight = useTransform(x, [0, SWIPE_LOCK_X], [0, 1]);
    const trashWidth = useTransform(progressRight, [0, 1], [48, 70]);
    const trashRadius = useTransform(progressRight, [0, 1], [24, 16]);
    const trashOpacity = useTransform(progressRight, [0, 1], [0, 1]);
    const trashHeight = useTransform(progressRight, [0, 1], [90, 98]);

    const progressLeft = useTransform(x, [0, -SWIPE_LOCK_X], [0, 1]);
    const moreWidth = useTransform(progressLeft, [0, 1], [48, 70]);
    const moreRadius = useTransform(progressLeft, [0, 1], [24, 16]);
    const moreOpacity = useTransform(progressLeft, [0, 1], [0, 1]);
    const moreHeight = useTransform(progressLeft, [0, 1], [90, 98]);

    const opacityMV = useMotionValue(task.done ? 0.7 : 1);

    const dragStartOpenDirRef = useRef(null);

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
        dragStartOpenDirRef.current = isOpen ? openDir : null;
        setMenuOpen(false);
        onOpenSwipe(null);
    }

    function onDragEnd(_e, info) {
        const current = x.get();
        const v = info.velocity.x || 0;

        let openRight =
            current > SWIPE_LOCK_X * 0.5 ||
            (current > SWIPE_LOCK_X * 0.25 && v > 250);

        let openLeft =
            current < SWIPE_LOCK_LEFT * 0.5 ||
            (current < SWIPE_LOCK_LEFT * 0.25 && v < -250);

        const startedDir = dragStartOpenDirRef.current;
        if (startedDir === "right") openLeft = false;
        if (startedDir === "left") openRight = false;

        let target = 0;
        if (openRight) target = SWIPE_LOCK_X;
        else if (openLeft) target = SWIPE_LOCK_LEFT;

        animate(x, target, { type: "spring", stiffness: 700, damping: 40 });

        if (openRight) onOpenSwipe(task.id, "right");
        else if (openLeft) onOpenSwipe(task.id, "left");
        else onCloseSwipe();

        setTimeout(() => {
            draggingRef.current = false;
            dragStartOpenDirRef.current = null;
        }, 0);
    }

    useEffect(() => {
        if (!isOpen || openDir !== "left") setMenuOpen(false);
    }, [isOpen, openDir]);

    function updateMenuPos() {
        const btn = moreBtnRef.current;
        if (!btn) return;

        const r = btn.getBoundingClientRect();
        const pad = 24;
        const gap = 8;
        const menuH = menuRef.current?.offsetHeight || 0;

        let top = r.bottom + gap;

        if (top + menuH > window.innerHeight - pad) {
            top = Math.max(pad, r.top - gap - menuH);
        }

        setMenuPos({ top, right: pad });
    }

    useEffect(() => {
        if (menuOpen) requestAnimationFrame(updateMenuPos);
    }, [menuOpen]);

    useEffect(() => {
        if (!menuOpen) return;
        function onReflow() {
            updateMenuPos();
        }
        window.addEventListener("resize", onReflow);
        window.addEventListener("scroll", onReflow, true);
        return () => {
            window.removeEventListener("resize", onReflow);
            window.removeEventListener("scroll", onReflow, true);
        };
    }, [menuOpen]);

    useEffect(() => {
        if (!menuOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [menuOpen]);

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
                task.location.lng,
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

    const handleExport = async (e) => {
        e.stopPropagation();
        try {
            await exportTask([task]);
        } catch (err) {
            try {
                await navigator.clipboard.writeText(
                    JSON.stringify(task, null, 2),
                );
            } catch (err2) {
                alert("Não foi possível exportar a tarefa.");
                console.error("Export falhou:", err, "Clipboard falhou:", err2);
            }
        } finally {
            setMenuOpen(false);
        }
    };

    const handleCopyToClipboard = async (e) => {
        e.stopPropagation();
        try {
            const ok = await copyTaskToClipboard([task]);
            if (!ok) {
                alert("Não foi possível copiar a tarefa.");
            } else {
                console.log("Copiado para a área de transferência");
            }
        } catch (err) {
            alert("Não foi possível copiar a tarefa.");
            console.error("Copiar falhou:", err);
        } finally {
            setMenuOpen(false);
        }
    };

    return (
        <motion.div
            data-taskid={task.id}
            layout="position"
            initial={false}
            style={{
                position: "relative",
                zIndex: menuOpen ? 10001 : task.done ? 0 : 1,
            }}
            transition={{ layout: { delay: delayId ? 0.4 : 0 } }}
        >
            <div
                className="trash-layer"
                style={{
                    position: "absolute",
                    inset: 0,
                    display: task.done && !isOpen ? "none" : "flex",
                    alignItems: "center",
                    pointerEvents:
                        isOpen && openDir === "right" ? "auto" : "none",
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

            <div
                className="options-layer"
                style={{
                    position: "absolute",
                    inset: 0,
                    display: task.done && !isOpen ? "none" : "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    pointerEvents:
                        isOpen && openDir === "left" ? "auto" : "none",
                }}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div style={{ position: "relative" }}>
                    <motion.button
                        ref={moreBtnRef}
                        className="more-btn"
                        title="Mais opções"
                        aria-haspopup="menu"
                        aria-expanded={undefined}
                        style={{
                            backgroundColor: "#F7F7F7",
                            color: "#333",
                            border: "1px solid white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            padding: "0.5rem",
                            fontSize: "1.2rem",
                            height: moreHeight,
                            width: moreWidth,
                            borderRadius: moreRadius,
                            opacity: moreOpacity,
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!menuOpen) updateMenuPos();
                            setMenuOpen((s) => !s);
                        }}
                    >
                        <span className="material-symbols-outlined">
                            more_vert
                        </span>
                    </motion.button>
                </div>
            </div>

            {menuOpen &&
                createPortal(
                    <>
                        {/* Backdrop fecha o menu */}
                        <div
                            onClick={() => setMenuOpen(false)}
                            style={{
                                position: "fixed",
                                inset: 0,
                                background: "rgba(0,0,0,0.25)",
                                backdropFilter: "blur(1px)",
                                zIndex: 9000,
                            }}
                        />

                        <AnimatePresence>
                            <motion.div
                                key="more-menu-portal"
                                ref={menuRef}
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.12 }}
                                role="menu"
                                data-menu-root="1"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: "fixed",
                                    top: menuPos.top,
                                    right: menuPos.right,
                                    minWidth: 180,
                                    background: "#f7f7f7",
                                    border: "1px solid white",
                                    borderRadius: 8,
                                    padding: 8,
                                    boxShadow: "0 6px 20px rgba(0,0,0,0.10)",
                                    zIndex: 10000,
                                    transformOrigin: "top right",
                                }}
                            >
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="menu-item"
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "8px 10px",
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                        borderRadius: 6,
                                        color: "var(--primary-text-color)",
                                        fontSize: 14,
                                    }}
                                    onClick={handleExport}
                                >
                                    <span className="material-symbols-outlined">
                                        file_export
                                    </span>
                                    Exportar tarefa
                                </button>

                                <button
                                    type="button"
                                    role="menuitem"
                                    className="menu-item"
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "8px 10px",
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                        borderRadius: 6,
                                        color: "var(--primary-text-color)",
                                        fontSize: 14,
                                    }}
                                    onClick={handleCopyToClipboard}
                                >
                                    <span className="material-symbols-outlined">
                                        content_copy
                                    </span>
                                    Copiar informações
                                </button>
                            </motion.div>
                        </AnimatePresence>
                    </>,
                    document.body,
                )}

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
                dragConstraints={{ left: -DRAG_MAX_X, right: DRAG_MAX_X }}
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
                                        initial={{
                                            height: 0,
                                            opacity: 0,
                                            marginTop: 0,
                                        }}
                                        animate={{
                                            height: "auto",
                                            opacity: 1,
                                            marginTop: 12,
                                        }}
                                        exit={{
                                            height: 0,
                                            opacity: 0,
                                            marginTop: 0,
                                        }}
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
                        onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <p className="d-flex flex-row align-items-center task-deadline justify-end">
                            <span className="material-symbols-outlined">
                                schedule
                            </span>
                            {task.hora}
                        </p>

                        <div
                            className="d-flex status justify-end"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onToggleDone(task.id);
                            }}
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
    const [openSwipeDir, setOpenSwipeDir] = useState(null);
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
            if (
                e.target.closest("[data-menu-root='1']") ||
                e.target.closest(".more-btn")
            ) {
                return;
            }

            const el = e.target.closest("[data-taskid]");
            if (el && el.dataset.taskid === openSwipeId) return;

            setOpenSwipeId(null);
            setOpenSwipeDir(null);
        }

        document.addEventListener("pointerdown", handleGlobalPointerDown, {
            capture: true,
        });
        return () =>
            document.removeEventListener(
                "pointerdown",
                handleGlobalPointerDown,
                { capture: true },
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
                        openDir={openSwipeDir}
                        isExpanded={expandedId === task.id}
                        flashingId={flashingId}
                        delayId={delayId}
                        onToggleDone={toggleDone}
                        onToggleExpand={(id) =>
                            setExpandedId((prev) => (prev === id ? null : id))
                        }
                        onOpenSwipe={(id, dir) => {
                            if (!id) {
                                setOpenSwipeId(null);
                                setOpenSwipeDir(null);
                            } else {
                                setOpenSwipeId(id);
                                setOpenSwipeDir(dir || "right");
                            }
                            setExpandedId(null);
                        }}
                        onCloseSwipe={() => {
                            setOpenSwipeId(null);
                            setOpenSwipeDir(null);
                        }}
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
