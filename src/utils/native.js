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

export async function listenTaskByVoice(onText, onError) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        onError?.("Reconhecimento de voz não suportado neste navegador.");
        return null;
    }

    // Solicita permissão de microfone (necessário em alguns browsers/fluxos)
    try {
        if (navigator.mediaDevices?.getUserMedia) {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        }
    } catch {
        onError?.("Permissão de microfone negada");
        return null;
    }

    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true; // ✅ parciais ao vivo
    rec.continuous = true; // ✅ continua ouvindo
    rec.maxAlternatives = 1;

    let committed = ""; // trechos já finalizados
    let lastEmit = 0;

    // (Opcional) timeout de segurança caso nada seja dito
    let watchdog = setTimeout(() => {
        try {
            rec.stop();
        } catch {}
        onError?.("Tempo esgotado sem captar fala");
    }, 15000);

    const clearWatchdog = () => {
        clearTimeout(watchdog);
        watchdog = null;
    };

    rec.onresult = (e) => {
        clearWatchdog();
        let live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            const txt = r[0]?.transcript || "";
            if (r.isFinal) {
                committed +=
                    (committed && !committed.endsWith(" ") ? " " : "") + txt;
            } else {
                live += txt;
            }
        }

        // Emite “final + parcial” (tempo real)
        const out = `${committed} ${live}`.trim();
        const now = performance.now();
        if (now - lastEmit > 60) {
            onText?.(out);
            lastEmit = now;
        }

        // Reinicia watchdog a cada atividade
        watchdog = setTimeout(() => {
            try {
                rec.stop();
            } catch {}
            onError?.("Tempo esgotado sem captar fala");
        }, 15000);
    };

    rec.onerror = (ev) => {
        clearWatchdog();
        onError?.(ev?.error || "Erro no reconhecimento");
    };

    rec.onend = () => {
        clearWatchdog();
        // não chama onError aqui; o componente decide o que fazer ao parar
    };

    try {
        rec.start();
    } catch {
        onError?.("Falha ao iniciar reconhecimento");
        return null;
    }

    return rec; // o seu componente já guarda em recognitionRef e chama .stop()
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
