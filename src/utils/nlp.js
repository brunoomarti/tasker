// utils/nlp.js (ou junto do componente)

function pad2(n) {
    return String(n).padStart(2, "0");
}
function toYMD(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

const WEEKDAYS = {
    domingo: 0,
    segunda: 1,
    "segunda-feira": 1,
    terca: 2,
    terça: 2,
    "terça-feira": 2,
    quarta: 3,
    "quarta-feira": 3,
    quinta: 4,
    "quinta-feira": 4,
    sexta: 5,
    "sexta-feira": 5,
    sabado: 6,
    sábado: 6,
};

const MONTHS = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    março: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
};

const TEXT_NUM = {
    uma: 1,
    um: 1,
    duas: 2,
    dois: 2,
    três: 3,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
    onze: 11,
    doze: 12,
};

function nextWeekday(from, targetDow) {
    const d = new Date(from);
    const cur = d.getDay();
    let delta = (targetDow - cur + 7) % 7;
    if (delta === 0) delta = 7; // próxima ocorrência
    return addDays(d, delta);
}

function parseExplicitDate(text, now) {
    // 1) dd/mm(/yyyy)
    let m = text.match(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
    if (m) {
        let dd = parseInt(m[1], 10),
            mm = parseInt(m[2], 10),
            yyyy = m[3] ? parseInt(m[3], 10) : now.getFullYear();
        if (yyyy < 100) yyyy += 2000;
        const d = new Date(yyyy, mm - 1, dd);
        if (!isNaN(d)) return { date: d, match: m[0] };
    }

    // 2) "dia 5 de novembro" / "5 de novembro"
    m = text.match(
        /(?:dia\s+)?(\d{1,2})\s+de\s+([a-zçãé]+)(?:\s+de\s+(\d{4}))?/i,
    );
    if (m) {
        let dd = parseInt(m[1], 10);
        let mesNome = m[2].toLowerCase();
        let mm = MONTHS[mesNome];
        let yyyy = m[3] ? parseInt(m[3], 10) : now.getFullYear();
        if (mm) {
            const d = new Date(yyyy, mm - 1, dd);
            if (!isNaN(d)) return { date: d, match: m[0] };
        }
    }
    return null;
}

function parseRelativeDate(text, now) {
    // hoje/amanhã/depois de amanhã
    if (/\bhoje\b/i.test(text)) return { date: new Date(now), match: "hoje" };
    if (/\bamanh[ãa]\b/i.test(text))
        return { date: addDays(now, 1), match: "amanhã" };
    if (/depois\s+de\s+amanh[ãa]/i.test(text))
        return { date: addDays(now, 2), match: "depois de amanhã" };

    // daqui a X dias|semanas / em X dias|semanas
    let m = text.match(
        /\b(?:daqui\s+a|em)\s+(\d+)\s+(dia|dias|semana|semanas)\b/i,
    );
    if (m) {
        const n = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        const days = /semana/.test(unit) ? n * 7 : n;
        return { date: addDays(now, days), match: m[0] };
    }

    // próxima segunda/terça/etc.
    m = text.match(
        /\b(pr[óo]xima|pr[óo]ximo)?\s*(domingo|segunda(?:-feira)?|ter[çc]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[áa]bado)\b/i,
    );
    if (m) {
        const wd = WEEKDAYS[m[2].toLowerCase()];
        if (wd !== undefined) {
            return { date: nextWeekday(now, wd), match: m[0] };
        }
    }

    return null;
}

function parseTime(text) {
    const low = text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    // meia-noite / meio-dia
    if (/meia[-\s]?noite/.test(low))
        return { time: "00:00", match: "meia-noite" };
    if (/meio[-\s]?dia/.test(low)) return { time: "12:00", match: "meio-dia" };

    // hh:mm ou hh[h]mm ou hh[h]
    let m = low.match(/(?:\b(as|às|a)\s+)?(\d{1,2})(?:[:h](\d{2}))?/i);
    // também tenta por extenso: "duas", "onze", etc.
    let texth = null;
    const textNumMatch = low.match(
        /\b(uma|um|duas|dois|tres|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\b/,
    );
    if (!m && textNumMatch) {
        texth =
            TEXT_NUM[
                textNumMatch[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            ];
        m = [textNumMatch[0], null, String(texth)]; // simula
    }
    if (m) {
        let hh = parseInt(m[2], 10);
        let mm = m[3] ? parseInt(m[3], 10) : null;

        // "e meia" / "e quinze" / "e quarto"
        if (/e\s+meia\b/.test(low)) mm = mm ?? 30;
        if (/(e\s+quinze|e\s+quarto)\b/.test(low)) mm = mm ?? 15;

        // período do dia
        const isManha = /\bmanha\b/.test(low);
        const isTarde = /\btarde\b/.test(low);
        const isNoite = /\bnoite\b/.test(low);
        const isPM = /\bpm\b/.test(low);
        const isAM = /\bam\b/.test(low);

        if (hh <= 12) {
            if (isTarde || isNoite || isPM) {
                if (hh !== 12) hh += 12; // 1..11 -> 13..23
            } else if (isManha || isAM) {
                if (hh === 12) hh = 0; // 12am -> 00
            }
        }

        if (mm == null) mm = 0;
        hh = Math.max(0, Math.min(23, hh));
        mm = Math.max(0, Math.min(59, mm));
        return { time: `${pad2(hh)}:${pad2(mm)}`, match: m[0] };
    }

    return null;
}

/**
 * Extrai data (YYYY-MM-DD), hora (HH:mm) e um título limpo do transcript.
 * Remove os pedaços reconhecidos do texto para virar título.
 */
export function extractWhenPTBR(transcript, now = new Date()) {
    let text = transcript.trim();
    let date = null,
        time = null;
    let matches = [];

    // ordem: data explícita > relativa > dia da semana (parseRelativeDate já cobre)
    const exp = parseExplicitDate(text, now);
    if (exp) {
        date = exp.date;
        matches.push(exp.match);
    }

    if (!date) {
        const rel = parseRelativeDate(text, now);
        if (rel) {
            date = rel.date;
            matches.push(rel.match);
        }
    }

    const tim = parseTime(text);
    if (tim) {
        time = tim.time;
        matches.push(tim.match);
    }

    // limpa os trechos encontrados do título
    let title = text;
    matches.forEach((m) => {
        title = title.replace(m, " ");
    });
    title = title
        .replace(
            /\b(para|pra|as|às|a|no|na|de|do|da|em|hoje|amanh[ãa])\b/gi,
            " ",
        )
        .replace(/\s+/g, " ")
        .trim();

    return {
        title: title || transcript.trim(),
        dateYMD: date ? toYMD(date) : null,
        timeHHMM: time || null,
    };
}
