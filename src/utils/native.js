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

function toBRDateSafe(d) {
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
}

function formatTasksText(
    taskOrTasks,
    { format = "pretty", forShare = false } = {},
) {
    const tasks = Array.isArray(taskOrTasks) ? taskOrTasks : [taskOrTasks];

    const toBRDateSafe = (d) => {
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
        const created = toBRDateSafe(t.createdAt || t.createdAtServer);
        const when = [t.hora, t.data].filter(Boolean).join(" ");

        if (forShare) {
            return [
                `Tarefa: ${t.title ?? ""}${when ? ` — ${when}` : ""}`,
                `Descrição: ${t.descricao?.trim() ? t.descricao : "Autodescritiva"}`,
                `Concluída: ${t.done ? "Sim" : "Não"}`,
                `Criada em: ${created}`,
                loc,
            ].join("\n");
        }

        return [
            `Tarefa: ${t.title ?? ""}`,
            `Descrição: ${t.descricao?.trim() ? t.descricao : "Autodescritiva"}`,
            `Hora: ${t.hora || ""}  Data: ${t.data || ""}`,
            `Concluída: ${t.done ? "Sim" : "Não"}`,
            `Criada em: ${created}`,
            loc,
        ].join("\n");
    };

    if (format === "json") return JSON.stringify(tasks, null, 2);
    return tasks.map(prettyBlock).join("\n\n— — — — —\n\n");
}

export async function copyTaskToClipboard(
    taskOrTasks,
    { format = "pretty" } = {},
) {
    try {
        const text = formatTasksText(taskOrTasks, { format });

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

export async function shareTask(taskOrTasks, { format = "pretty" } = {}) {
    const tasks = Array.isArray(taskOrTasks) ? taskOrTasks : [taskOrTasks];
    if (!tasks.length) throw new Error("Tarefa inválida para compartilhamento");

    const text = formatTasksText(tasks, { format, forShare: true });

    const title =
        tasks.length === 1
            ? (() => {
                  const t = tasks[0];
                  const when = [t.hora, t.data].filter(Boolean).join(" ");
                  return `${t.title || "Tarefa"}${when ? ` — ${when}` : ""}`;
              })()
            : `${tasks.length} tarefas`;

    const shareData = { title, text };

    if (navigator.share) {
        try {
            if (navigator.canShare && !navigator.canShare(shareData)) {
                throw new Error(
                    "Este conteúdo não pode ser compartilhado pelo navegador.",
                );
            }
            await navigator.share(shareData);
            return true;
        } catch (err) {
            if (err?.name === "AbortError") return false;
            console.warn("Falha no share, tentando copiar:", err);
        }
    }

    await copyTaskToClipboard(tasks, { format });
    return false;
}

export async function listenTaskByVoice(onText, onError) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        onError?.("Reconhecimento de voz não suportado neste navegador.");
        return null;
    }

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
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    let committed = "";
    let lastEmit = 0;

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

        const out = `${committed} ${live}`.trim();
        const now = performance.now();
        if (now - lastEmit > 60) {
            onText?.(out);
            lastEmit = now;
        }

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
    };

    try {
        rec.start();
    } catch {
        onError?.("Falha ao iniciar reconhecimento");
        return null;
    }

    return rec;
}
