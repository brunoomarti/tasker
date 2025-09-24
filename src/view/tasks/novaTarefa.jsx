import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { addTask } from "../../utils/db";
import { getUserLocation, listenTaskByVoice } from "../../utils/native";
import { syncTasks } from "../../utils/sync";
import { extractWhenPTBR } from "../../utils/nlp";
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

    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const [voiceHint, setVoiceHint] = useState("");

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
                if (perm === "granted")
                    new Notification("Tarefa criada com sucesso!", { body });
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

    const startVoice = () => {
        if (isListening) return;
        setVoiceHint("Ouvindo... fale o título da tarefa");
        setIsListening(true);

        recognitionRef.current = listenTaskByVoice(
            (transcript) => {
                setIsListening(false);
                const parsed = extractWhenPTBR(transcript, new Date());

                // preenche título/descrição
                if (!title.trim()) setTitle(parsed.title);
                else
                    setDescricao((prev) =>
                        prev?.trim() ? prev + "\n" + parsed.title : parsed.title
                    );

                // preenche data/hora se achou
                if (parsed.dateYMD) setData(parsed.dateYMD);
                if (parsed.timeHHMM) setHora(parsed.timeHHMM);

                setVoiceHint("Transcrito com sucesso");
                recognitionRef.current = null;
                setTimeout(() => setVoiceHint(""), 1500);
            },
            (err) => {
                setIsListening(false);
                setVoiceHint(
                    err === "not-allowed" || /perm/i.test(err)
                        ? "Permissão negada ao microfone"
                        : err || "Falha no reconhecimento de voz"
                );
                recognitionRef.current = null;
                setTimeout(() => setVoiceHint(""), 2000);
            }
        );

        if (!recognitionRef.current) {
            setIsListening(false);
            setVoiceHint("Seu navegador não suporta voz");
            setTimeout(() => setVoiceHint(""), 2000);
        }
    };

    const stopVoice = () => {
        try {
            recognitionRef.current?.stop();
        } catch (_) {}
        recognitionRef.current = null;
        setIsListening(false);
        setVoiceHint("");
    };

    useEffect(() => {
        return () => {
            try {
                recognitionRef.current?.stop();
            } catch (_) {}
            recognitionRef.current = null;
        };
    }, []);

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

                    <button
                        type="button"
                        className="voice-btn"
                        title={
                            isListening ? "Parar gravação" : "Adicionar por voz"
                        }
                        onClick={isListening ? stopVoice : startVoice}
                        disabled={allDisabled}
                        style={{
                            marginLeft: "auto",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            padding: 6,
                        }}
                    >
                        <span
                            className="material-symbols-outlined"
                            style={{
                                fontSize: 26,
                                ...(isListening
                                    ? { animation: "pulse 1s infinite" }
                                    : {}),
                            }}
                        >
                            {isListening ? "mic_off" : "mic"}
                        </span>
                    </button>
                </div>

                {voiceHint && (
                    <small
                        className="secondary-text"
                        style={{ marginTop: -24, marginBottom: 8 }}
                    >
                        {voiceHint}
                    </small>
                )}

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
