import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { addTask } from "../../utils/db";
import { getUserLocation } from "../../utils/native";
import { syncTasks } from "../../utils/sync";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

function getTodayYYYYMMDD() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function NovaTarefa() {
    const [title, setTitle] = useState("");
    const [descricao, setDescricao] = useState("");
    const [data, setData] = useState(getTodayYYYYMMDD());
    const [hora, setHora] = useState("");
    const [done, setDone] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittingBtn, setSubmittingBtn] = useState(null);

    const navigate = useNavigate();
    const { currentUser } = useAuth();

    async function buildTask() {
        const uid = currentUser?.uid ?? null;
        const location = await getUserLocation();
        return {
            id: uuidv4(),
            title,
            descricao,
            data,
            hora,
            done,
            userId: uid,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            synced: false,
            location: location,
        };
    }

    async function notifyNewTask(titulo, horaStr) {
        try {
            const isSecure =
                location.protocol === "https:" ||
                location.hostname === "localhost";
            if (!isSecure || !("Notification" in window)) return;

            const body = `${titulo || "Sem título"}${
                horaStr ? ` - ${horaStr}` : ""
            }`;

            if (Notification.permission === "granted") {
                new Notification("Tarefa criada com sucesso!", { body });
                return;
            }

            if (Notification.permission !== "denied") {
                const perm = await Notification.requestPermission();
                if (perm === "granted") {
                    new Notification("Tarefa criada com sucesso!", { body });
                }
            }
        } catch (e) {
            console.debug("Web Notification falhou:", e);
        }
    }

    function resetForm() {
        setTitle("");
        setDescricao("");
        setData(getTodayYYYYMMDD());
        setHora("");
        setDone(false);
    }

    async function addCommon(titulo, horaStr) {
        if (!titulo || !data || !horaStr) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return false;
        }
        try {
            setIsSubmitting(true);

            const task = await buildTask();
            await addTask(task);

            if (navigator.onLine) await syncTasks();
            await notifyNewTask(titulo, horaStr);
            return true;
        } catch (err) {
            console.error("Erro ao registrar tarefa:", err);
            alert("Não foi possível registrar a tarefa. Tente novamente.");
            return false;
        } finally {
            setIsSubmitting(false);
            setSubmittingBtn(null);
        }
    }

    async function handleAddAndStay() {
        setSubmittingBtn("stay");
        const ok = await addCommon(title, hora);
        if (ok) resetForm();
    }

    async function handleAddAndBack() {
        setSubmittingBtn("back");
        const ok = await addCommon(title, hora);
        if (ok) navigate("/");
    }

    const allDisabled = isSubmitting;

    return (
        <div
            className="d-flex flex-column gap-10 justify-space-between"
            style={{ flex: "1 1 auto" }}
        >
            <div aria-disabled={allDisabled}>
                <div className="d-flex flex-row align-items-center mb-40 w-100 relative">
                    <Link
                        to="/"
                        onClick={(e) => allDisabled && e.preventDefault()}
                    >
                        <button
                            type="button"
                            disabled={allDisabled}
                            className="d-flex flex-row gap-5 btn-access align-items-center absolute horizontal-center-absolute"
                        >
                            <span className="material-symbols-outlined">
                                arrow_back
                            </span>
                        </button>
                    </Link>
                    <h2
                        className="d-flex m-0 flex-column justify-center primary-text"
                        style={{ flex: "1 1 auto" }}
                    >
                        Nova tarefa
                    </h2>
                </div>

                <div className="d-flex flex-column gap-15">
                    <div className="complete-input">
                        <label htmlFor="title">Título</label>
                        <input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="O que você precisa fazer?"
                            disabled={allDisabled}
                        />
                    </div>

                    <div className="complete-input">
                        <label htmlFor="descricao">Descrição (opcional)</label>
                        <textarea
                            id="descricao"
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Precisa especificar mais detalhes?"
                            rows={3}
                            disabled={allDisabled}
                        />
                    </div>

                    <div className="d-flex flex-row gap-10">
                        <div
                            className="complete-input"
                            style={{ flex: "1 1 0" }}
                        >
                            <label htmlFor="data">Data</label>
                            <input
                                id="data"
                                type="date"
                                value={data}
                                onChange={(e) => setData(e.target.value)}
                                disabled={allDisabled}
                            />
                        </div>

                        <div
                            className="complete-input"
                            style={{ flex: "1 1 0" }}
                        >
                            <label htmlFor="hora">Hora</label>
                            <input
                                id="hora"
                                type="time"
                                value={hora}
                                onChange={(e) => setHora(e.target.value)}
                                disabled={allDisabled}
                            />
                        </div>
                    </div>

                    <label className="d-flex flex-row align-items-center">
                        <input
                            type="checkbox"
                            checked={done}
                            onChange={(e) => setDone(e.target.checked)}
                            disabled={allDisabled}
                        />
                        Feita
                    </label>
                </div>
            </div>

            <div className="d-flex flex-row gap-10 mt-auto">
                <button
                    onClick={handleAddAndStay}
                    className="flex-1 d-flex justify-center outline"
                    disabled={allDisabled}
                >
                    {submittingBtn === "stay" ? (
                        <span className="spinner" />
                    ) : (
                        "Adicionar e criar outra"
                    )}
                </button>

                <button
                    onClick={handleAddAndBack}
                    className="flex-1 d-flex justify-center"
                    disabled={allDisabled}
                >
                    {submittingBtn === "back" ? (
                        <span className="spinner" />
                    ) : (
                        "Adicionar"
                    )}
                </button>
            </div>
        </div>
    );
}

export default NovaTarefa;
