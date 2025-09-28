export function getGoogleCalendar(task, opts = {}) {
    const tz =
        opts.tz ||
        Intl.DateTimeFormat?.().resolvedOptions?.().timeZone ||
        "America/Sao_Paulo";

    const pad2 = (n) => String(n).padStart(2, "0");

    function buildStart(dStr, hStr) {
        const now = new Date();
        let y = now.getFullYear(),
            m = now.getMonth(),
            d = now.getDate();
        if (dStr) {
            const [yy, mm, dd] = String(dStr)
                .split("-")
                .map((x) => parseInt(x, 10));
            if (!Number.isNaN(yy) && !Number.isNaN(mm) && !Number.isNaN(dd)) {
                y = yy;
                m = mm - 1;
                d = dd;
            }
        }
        let hh = 9,
            mi = 0;
        if (hStr) {
            const [H, M] = String(hStr).split(":");
            hh = parseInt(H ?? "9", 10);
            mi = parseInt(M ?? "0", 10);
            if (Number.isNaN(hh)) hh = 9;
            if (Number.isNaN(mi)) mi = 0;
        }
        return new Date(y, m, d, hh, mi, 0, 0);
    }

    const start = buildStart(task?.data, task?.hora);
    const durationMin = Number(task?.durationMin) || 60;
    const end = new Date(start.getTime() + durationMin * 60 * 1000);

    const fmt = (d) =>
        `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(
            d.getHours(),
        )}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;

    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: task?.title || "Tarefa",
        details:
            `Tarefa: ${task?.title || ""}\n` +
            `Descrição: ${task?.descricao?.trim() || "Autodescritiva"}\n` +
            (task?.hora || task?.data
                ? `Quando: ${task?.hora || ""} ${task?.data || ""}\n`
                : "") +
            (task?.done ? "Concluída: Sim\n" : "Concluída: Não\n"),
        dates: `${fmt(start)}/${fmt(end)}`,
        ctz: tz,
    });

    if (task?.location?.lat && task?.location?.lng) {
        params.set("location", `${task.location.lat}, ${task.location.lng}`);
    }

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
