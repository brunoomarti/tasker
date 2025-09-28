import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { addTask } from "../../utils/db.js";
import { getUserLocation, listenTaskByVoice } from "../../utils/native.js";
import { syncTasks } from "../../utils/sync.js";
import { extractWhenPTBR } from "../../utils/nlp.js";

function getTodayYYYYMMDD() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

const SUGGESTIONS = [
    "Levar meu pet ao veterinário amanhã",
    "Pagar o boleto do condomínio dia 5",
    "Reunião com Ana quinta às 14h",
    "Comprar presente até sexta",
    "Ir à academia às 07:30",
    "Enviar relatório hoje às 18h",
    "Marcar dentista para terça de manhã",
    "Fazer mercado sábado de tarde",
    "Ligar para o banco às 10h",
    "Pegar roupas na lavanderia amanhã às 17h",
    "Revisar orçamento dia 15/10 às 9h",
    "Comprar passagens até quarta",
    "Atualizar currículo hoje à noite",
    "Cortar o cabelo sexta às 19:30",
    "Agendar revisão do carro para segunda",
    "Buscar encomenda às 12:00 (meio-dia)",
    "Estudar inglês 1h amanhã cedo",
    "Pagar cartão até dia 02",
    "Levar notebook para conserto às 16h",
    "Reunião do projeto na próxima terça às 11h",
    "Visitar meus pais domingo à tarde",
    "Agendar exame para dia 25/09 às 08:00",
    "Fazer backup dos arquivos hoje",
    "Renovar CNH até mês que vem",
    "Entrega do cliente amanhã às 09:15",
    "Comprar gás hoje no fim da tarde",
    "Marcar aula de natação para quinta às 18h30",
    "Passear com o cachorro às 20h",
    "Organizar documentos em 3 dias",
    "Pagar internet dia 10 às 13h",
];

const CURSOR_CHAR = "▏";
const BLINK_MS = 250;

export default function MagicTaskInput({
    placeholder = "Digite ou fale o que você quer fazer…",
    onCreated,
    autofocus = false,
}) {
    const { currentUser } = useAuth();
    const [value, setValue] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // NEW
    const [hint, setHint] = useState("");

    const [ph, setPh] = useState("");
    const [typedLen, setTypedLen] = useState(0);
    const [deleting, setDeleting] = useState(false);
    const [cursorOn, setCursorOn] = useState(true);

    const recognitionRef = useRef(null);
    const liveBufferRef = useRef("");
    const inputRef = useRef(null);
    const typingTimerRef = useRef(null);
    const cursorTimerRef = useRef(null);

    const queueRef = useRef(shuffle(SUGGESTIONS));
    const [, forceTick] = useState(0);

    useEffect(() => {
        if (autofocus) inputRef.current?.focus();
        return () => {
            try {
                recognitionRef.current?.stop();
            } catch {}
            recognitionRef.current = null;
            clearTimeout(typingTimerRef.current);
            clearInterval(cursorTimerRef.current);
        };
    }, [autofocus]);

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function capFirst(str = "") {
        return String(str).replace(/^\s*([\p{L}])/u, (_, ch) =>
            ch.toUpperCase(),
        );
    }

    /** Placeholder – efeito de digitação */
    useEffect(() => {
        clearInterval(cursorTimerRef.current);
        if (!value && !isListening && !isSubmitting) {
            cursorTimerRef.current = setInterval(
                () => setCursorOn((v) => !v),
                BLINK_MS,
            );
        }
        if (value || isListening || isSubmitting) {
            setPh("");
            return;
        }

        if (!queueRef.current.length) {
            queueRef.current = shuffle(SUGGESTIONS);
        }
        const phrase = queueRef.current[0];

        const TYPE = 50;
        const DELETE = 30;
        const HOLD_END = 1500;
        const HOLD_START = 350;

        const step = () => {
            if (isSubmitting) return; // pausa animação durante envio
            if (!deleting) {
                if (typedLen < phrase.length) {
                    setTypedLen(typedLen + 1);
                    setPh(phrase.slice(0, typedLen + 1));
                    typingTimerRef.current = setTimeout(step, TYPE);
                } else {
                    typingTimerRef.current = setTimeout(() => {
                        setDeleting(true);
                        typingTimerRef.current = setTimeout(step, DELETE);
                    }, HOLD_END);
                }
            } else {
                if (typedLen > 0) {
                    setTypedLen(typedLen - 1);
                    setPh(phrase.slice(0, typedLen - 1));
                    typingTimerRef.current = setTimeout(step, DELETE);
                } else {
                    queueRef.current.shift();
                    if (!queueRef.current.length) {
                        queueRef.current = shuffle(SUGGESTIONS);
                    }
                    setDeleting(false);
                    setTypedLen(0);
                    typingTimerRef.current = setTimeout(() => {
                        forceTick((t) => t + 1);
                        step();
                    }, HOLD_START);
                }
            }
        };

        typingTimerRef.current = setTimeout(step, deleting ? DELETE : TYPE);
        return () => clearTimeout(typingTimerRef.current);
    }, [value, isListening, isSubmitting, typedLen, deleting]);

    const computedPlaceholder =
        value || isListening || isSubmitting
            ? placeholder
            : `${ph}${cursorOn ? CURSOR_CHAR : "\u2009"}`;

    async function buildTaskFromText(text) {
        const parsed = extractWhenPTBR(text, new Date());
        const rawTitle = (parsed.title || text || "").trim();
        const title = capFirst(rawTitle);
        const data = parsed.dateYMD || getTodayYYYYMMDD();
        const hora = parsed.timeHHMM || "";
        const location = await getUserLocation();
        const uid = currentUser?.uid ?? null;

        return {
            id: uuidv4(),
            title,
            descricao: "",
            data,
            hora,
            done: false,
            userId: uid,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            synced: false,
            location,
        };
    }

    async function createTaskFromText(text) {
        if (isSubmitting) return; // trava reentrância
        if (!text.trim()) return;
        setIsSubmitting(true);
        try {
            const task = await buildTaskFromText(text);
            await addTask(task);
            if (navigator.onLine) await syncTasks();

            const isToday = task.data === getTodayYYYYMMDD();
            if (isToday) onCreated?.(task);
            if (isToday)
                window.dispatchEvent(
                    new CustomEvent("task:created", { detail: task }),
                );

            setValue("");
            setHint("Tarefa criada ✅");
            setTimeout(() => setHint(""), 1200);
        } catch (e) {
            console.error("Falha ao criar tarefa:", e);
            setHint("Falha ao criar tarefa");
            setTimeout(() => setHint(""), 1500);
        } finally {
            setIsSubmitting(false);
        }
    }

    // ---- Voz ----
    function startVoice() {
        if (isListening || isSubmitting) return; // não começa se estiver enviando
        setIsListening(true);
        setHint("Gravando… clique em enviar para finalizar");
        liveBufferRef.current = "";

        recognitionRef.current = listenTaskByVoice(
            (transcript) => {
                liveBufferRef.current = transcript || "";
                setValue(liveBufferRef.current);
            },
            (err) => {
                setIsListening(false);
                recognitionRef.current = null;
                setHint(
                    err === "not-allowed" || /perm/i.test(err)
                        ? "Permissão negada ao microfone"
                        : err || "Falha no reconhecimento de voz",
                );
                setTimeout(() => setHint(""), 1800);
            },
        );

        if (!recognitionRef.current) {
            setIsListening(false);
            setHint("Seu navegador não suporta voz");
            setTimeout(() => setHint(""), 1800);
        }
    }

    async function stopVoiceAndSubmit() {
        if (isSubmitting) return; // já enviando
        try {
            recognitionRef.current?.stop();
        } catch {}
        recognitionRef.current = null;
        setIsListening(false);

        const finalTranscript = (liveBufferRef.current || value || "").trim();
        if (!finalTranscript) {
            setHint("Nada foi captado");
            setTimeout(() => setHint(""), 1200);
            return;
        }
        await createTaskFromText(finalTranscript);
    }

    const showSend = (isListening || value.trim()) && !isSubmitting;

    return (
        <div style={{ width: "100%" }}>
            <div
                className={`magic-input ${isListening ? "magic-input--listening" : ""}`}
                data-listening={isListening ? "true" : "false"}
                aria-busy={isSubmitting ? "true" : "false"} // acessibilidade
            >
                <span
                    className="material-symbols-outlined magic-input__ia"
                    aria-hidden
                >
                    auto_awesome
                </span>

                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (
                            e.key === "Enter" &&
                            value.trim() &&
                            !isListening &&
                            !isSubmitting
                        ) {
                            e.preventDefault();
                            createTaskFromText(value);
                        }
                    }}
                    placeholder={computedPlaceholder}
                    className="magic-input__field"
                    disabled={isSubmitting} // NEW
                />

                <button
                    className="magic-input__action"
                    onClick={
                        isSubmitting
                            ? undefined
                            : showSend
                              ? isListening
                                  ? stopVoiceAndSubmit
                                  : () => createTaskFromText(value)
                              : startVoice
                    }
                    aria-label={
                        isSubmitting
                            ? "Enviando…"
                            : showSend
                              ? "Enviar"
                              : "Falar tarefa"
                    }
                    title={
                        isSubmitting
                            ? "Enviando…"
                            : showSend
                              ? "Enviar"
                              : "Falar tarefa"
                    }
                    disabled={isSubmitting} // NEW
                >
                    {isSubmitting ? (
                        <span className="spinner" aria-hidden />
                    ) : (
                        <span className="magic-swap">
                            <span
                                className={
                                    "material-symbols-outlined magic-swap__icon " +
                                    (!showSend ? "is-active" : "")
                                }
                                aria-hidden={showSend ? "true" : "false"}
                            >
                                mic
                            </span>
                            <span
                                className={
                                    "material-symbols-outlined magic-swap__icon " +
                                    (showSend ? "is-active" : "")
                                }
                                aria-hidden={showSend ? "false" : "true"}
                            >
                                send
                            </span>
                        </span>
                    )}
                </button>
            </div>

            {hint && (
                <small
                    className="secondary-text"
                    style={{ display: "block", marginTop: 8 }}
                >
                    {hint}
                </small>
            )}
        </div>
    );
}
