export async function getUserLocation() {
    if (!navigator.geolocation) return null;
    try {
        return await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) =>
                    resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    }),
                (err) => resolve(null),
                { enableHighAccuracy: true },
            );
        });
    } catch (error) {
        return null;
    }
}

export function exportTask(tasks) {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasks-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function copyTaskToClipboard(
    taskOrTasks,
    { format = "pretty" } = {},
) {
    try {
        const tasks = Array.isArray(taskOrTasks) ? taskOrTasks : [taskOrTasks];

        const toBRDate = (d) => {
            try {
                if (!d) return "—";
                const date =
                    typeof d === "string"
                        ? new Date(d)
                        : d?.toDate
                          ? d.toDate()
                          : d?.seconds
                            ? new Date(d.seconds * 1000)
                            : null;
                return date
                    ? date.toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                      })
                    : "—";
            } catch {
                return "—";
            }
        };

        const prettyBlock = (t) => {
            const loc = t.location
                ? `Localização: ${t.location.lat}, ${t.location.lng}`
                : "Sem localização";
            const created = toBRDate(t.createdAt || t.createdAtServer);
            return [
                `Tarefa: ${t.title ?? ""}`,
                `Descrição: ${t.descricao?.trim() ? t.descricao : "Autodescritiva"}`,
                `Hora: ${t.hora || ""}  Data: ${t.data || ""}`,
                `Concluída: ${t.done ? "Sim" : "Não"}`,
                `Criada em: ${created}`,
                loc,
            ].join("\n");
        };

        const text =
            format === "json"
                ? JSON.stringify(tasks, null, 2)
                : tasks.map(prettyBlock).join("\n\n— — — — —\n\n");

        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }

        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return !!ok;
    } catch (err) {
        console.error("Falha ao copiar:", err);
        return false;
    }
}

export async function listenTaskByVoice(onResult, onError) {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        onError &&
            onError("Reconhecimento de voz não suportado neste navegador.");
        return null;
    }

    try {
        if (navigator.mediaDevices?.getUserMedia) {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        }
    } catch (e) {
        onError && onError("Permissão de microfone negada");
        return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let gotResult = false;
    let stopped = false;

    const clearTimer = () => {
        if (recognition.__timer) {
            clearTimeout(recognition.__timer);
            recognition.__timer = null;
        }
    };

    recognition.__timer = setTimeout(() => {
        if (!gotResult && !stopped) {
            stopped = true;
            try {
                recognition.stop();
            } catch {}
            onError && onError("Tempo esgotado sem captar fala");
        }
    }, 8000);

    recognition.onresult = (event) => {
        gotResult = true;
        clearTimer();
        const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
        if (transcript) onResult && onResult(transcript);
        else onError && onError("Nada foi entendido");
    };

    recognition.onnomatch = () => {
        if (stopped) return;
        clearTimer();
        onError && onError("Nada foi entendido");
    };

    recognition.onerror = (event) => {
        if (stopped) return;
        clearTimer();
        const err = event?.error || "Erro no reconhecimento";
        onError && onError(err);
    };

    recognition.onaudioend = () => {
        // áudio terminou; se não teve resultado, o onend cuidará
    };

    recognition.onspeechend = () => {
        // usuário parou de falar; deixa o onend finalizar
    };

    recognition.onend = () => {
        clearTimer();
        if (!gotResult && !stopped) {
            onError && onError("Finalizou sem reconhecimento");
        }
    };

    try {
        recognition.start();
    } catch (_) {
        onError && onError("Falha ao iniciar reconhecimento");
        return null;
    }

    return recognition;
}

// export async function shareTask(task) {
//     if (!navigator.canShare) {
//         throw new Error("Navegador não suporta Web Share API");
//     } else if (!task) {
//         throw new Error("Tarefa inválida para compartilhamento");
//     } else {
//         const text = `Tarefa: ${task.descricao}\nHora: ${task.hora || ""} Data: ${task.data}\nConcluída: ${task.done ? "Sim" : "Não"}`; //adicionar localização depois
//     }
// }
