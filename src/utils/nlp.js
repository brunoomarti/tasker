// utils/nlp.js

/** Helpers básicos **/
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
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
function roundToNext5Min(date = new Date()) {
    const d = new Date(date);
    const mins = d.getMinutes();
    const add = (5 - (mins % 5)) % 5;
    d.setMinutes(mins + add, 0, 0);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function capFirst(s = "") {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Normalização agressiva para PT-BR vindo do ASR */
function normPT(text) {
    return (
        text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            // correções comuns do ASR
            .replace(/\bman\b/g, "manha")
            .replace(/\bamanh?a?\b/g, (m) =>
                m.startsWith("aman") ? "amanha" : m,
            )
            .replace(/\bterca\b/g, "terca")
            .replace(/\bsabado\b/g, "sabado")
            // variações que confundem o ASR
            .replace(/\bmeio\s+dia\b/g, "meio dia")
            .replace(/\bmeia\s+noite\b/g, "meia noite")
            .replace(/\bp\/\b/g, "para")
            .replace(/\bpro?\b/g, "para")
            // pontuação redundante -> espaço
            .replace(/[.,;]+/g, " ")
    );
}

/** Constantes (em forma normalizada) */
const WEEKDAYS = {
    domingo: 0,
    segunda: 1,
    "segunda-feira": 1,
    terca: 2,
    "terca-feira": 2,
    quarta: 3,
    "quarta-feira": 3,
    quinta: 4,
    "quinta-feira": 4,
    sexta: 5,
    "sexta-feira": 5,
    sabado: 6,
};

const MONTHS = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
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
    zero: 0,
    uma: 1,
    um: 1,
    duas: 2,
    dois: 2,
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

const TENS = {
    dez: 10,
    vinte: 20,
    trinta: 30,
    quarenta: 40,
    cinquenta: 50,
};

/** Converte números por extenso simples (até 59) */
function parsePTNumberUpTo59(chunk) {
    const raw = normPT(String(chunk)).trim();
    if (!raw) return null;

    if (/^\d{1,2}$/.test(raw)) return parseInt(raw, 10);
    if (raw === "meia") return 30;
    if (raw === "quinze" || raw === "um quarto" || raw === "um quarto de hora")
        return 15;

    const parts = raw.split(/\s+e\s+|\s+/).filter(Boolean);
    let val = 0;
    for (const p of parts) {
        if (p in TENS) val += TENS[p];
        else if (p in TEXT_NUM) val += TEXT_NUM[p];
        else if (/^\d+$/.test(p)) val += parseInt(p, 10);
        else return null;
    }
    if (val >= 0 && val <= 59) return val;
    return null;
}

/** Próxima ocorrência de DOW */
function nextWeekday(from, targetDow) {
    const d = new Date(from);
    const cur = d.getDay();
    let delta = (targetDow - cur + 7) % 7;
    if (delta === 0) delta = 7;
    return addDays(d, delta);
}

/** Datas explícitas */
function parseExplicitDate(text, now) {
    const low = normPT(text);

    // dd/mm(/yyyy)
    let m = low.match(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
    if (m) {
        let dd = parseInt(m[1], 10);
        let mm = parseInt(m[2], 10);
        let yyyy = m[3] ? parseInt(m[3], 10) : now.getFullYear();
        if (yyyy < 100) yyyy += 2000;
        const d = new Date(yyyy, mm - 1, dd);
        if (!isNaN(d) && d.getMonth() === mm - 1)
            return { date: d, match: m[0] };
    }

    // "dia 5 de novembro"
    m = low.match(
        /(?:\bdia\s+)?(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/i,
    );
    if (m) {
        let dd = parseInt(m[1], 10);
        let mesNome = m[2];
        let mm = MONTHS[mesNome];
        let yyyy = m[3] ? parseInt(m[3], 10) : now.getFullYear();
        if (mm) {
            const d = new Date(yyyy, mm - 1, dd);
            if (!isNaN(d) && d.getMonth() === mm - 1)
                return { date: d, match: m[0] };
        }
    }

    return null;
}

/** Datas relativas */
function parseRelativeDate(text, now) {
    const low = normPT(text);

    if (/\bhoje\b/.test(low)) return { date: new Date(now), match: "hoje" };
    if (/\bamanha\b/.test(low))
        return { date: addDays(now, 1), match: "amanha" };
    if (/depois\s+de\s+amanha/.test(low))
        return { date: addDays(now, 2), match: "depois de amanha" };

    let m = low.match(
        /\b(?:daqui\s+a|em)\s+(\d+)\s+(dia|dias|semana|semanas)\b/,
    );
    if (m) {
        const n = parseInt(m[1], 10);
        const unit = m[2];
        const days = /semana/.test(unit) ? n * 7 : n;
        return { date: addDays(now, days), match: m[0] };
    }

    m = low.match(
        /\b(proxima|proximo)?\s*(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado)\b/,
    );
    if (m) {
        const wdKey = m[2].replace("-feira", "");
        const wd = WEEKDAYS[wdKey] ?? WEEKDAYS[m[2]];
        if (wd !== undefined)
            return { date: nextWeekday(now, wd), match: m[0] };
    }

    return null;
}

/** Inferência de horário por contexto quando não há hora explícita */
function inferTimeByContext(text, now = new Date()) {
    const low = normPT(text);
    let m;

    if ((m = /(final|fim)\s+do\s+dia/.exec(low)))
        return { time: "23:59", match: m[0] };
    if ((m = /(final|fim)\s+da?\s+tarde/.exec(low)))
        return { time: "17:30", match: m[0] };
    if ((m = /\bnoite\b|de\s+noite|a\s+noite/.exec(low)))
        return { time: "23:59", match: m[0] };
    if ((m = /\btarde\b/.exec(low))) return { time: "15:00", match: m[0] };
    if ((m = /\b(inicio|comeco)\s+da?\s+tarde\b/.exec(low)))
        return { time: "13:30", match: m[0] };
    if ((m = /\bfinal\s+da?\s+manha\b/.exec(low)))
        return { time: "11:30", match: m[0] };
    if ((m = /\bmanha\b|de\s+manha|pela\s+manha/.exec(low)))
        return { time: "09:00", match: m[0] };
    if ((m = /\b(bem\s+cedo|cedo|primeira\s+hora)\b/.exec(low)))
        return { time: "08:00", match: m[0] };
    if ((m = /\b(almoco|hora\s+do\s+almoco)\b/.exec(low)))
        return { time: "12:00", match: m[0] };
    if ((m = /\bmadrugada\b/.exec(low))) return { time: "02:00", match: m[0] };
    if ((m = /\bagora\b/.exec(low)))
        return { time: roundToNext5Min(now), match: m[0] };

    return null;
}

/** Horas: prioriza "X horas"/"Xh" antes de "hh:mm" */
function parseTime(text) {
    const low = normPT(text);

    // meia-noite / meio-dia
    if (/meia[-\s]?noite/.test(low))
        return { time: "00:00", match: "meia-noite" };
    if (/meio[-\s]?dia/.test(low)) return { time: "12:00", match: "meio-dia" };

    // 1) "às 9 horas [e ...]" | "9h"
    let m = low.match(
        /(?:\b(as|a)\s*)?(\d{1,2})\s*(?:h|hs|horas?)\s*(?:e\s*([a-z0-9\s]+))?/i,
    );
    if (m) {
        let hh = parseInt(m[2], 10);
        let mm = 0;
        if (m[3]) {
            const minsRaw = m[3].trim();
            let parsedMin = null;
            const minNum = minsRaw.match(/(\d{1,2})\s*minutos?/);
            if (minNum) parsedMin = clamp(parseInt(minNum[1], 10), 0, 59);
            if (parsedMin == null) parsedMin = parsePTNumberUpTo59(minsRaw);
            if (parsedMin != null) mm = parsedMin;
        }

        const isManha = /\bmanha\b/.test(low);
        const isTarde = /\btarde\b/.test(low);
        const isNoite = /\bnoite\b/.test(low);
        const isPM = /\bpm\b/.test(low);
        const isAM = /\bam\b/.test(low);

        if (hh <= 12) {
            if (isTarde || isNoite || isPM) {
                if (hh !== 12) hh += 12;
            } else if (isManha || isAM) {
                if (hh === 12) hh = 0;
            }
        }

        hh = clamp(hh, 0, 23);
        mm = clamp(mm, 0, 59);
        return { time: `${pad2(hh)}:${pad2(mm)}`, match: m[0] };
    }

    // 2) "às 9", "9", "9h30", "09:30"
    m = low.match(/(?:\b(as|a)\s*)?(\d{1,2})(?:[:h](\d{2}))?/i);
    if (m) {
        let hh = parseInt(m[2], 10);
        let mm = m[3] ? parseInt(m[3], 10) : null;

        if (mm == null) {
            const after = low.slice(m.index + m[0].length);
            const w = after.match(/^\s*e\s*([a-z0-9\s]+)/);
            if (w) {
                const parsedMin = parsePTNumberUpTo59(w[1]);
                if (parsedMin != null) mm = parsedMin;
            }
        }

        const isManha = /\bmanha\b/.test(low);
        const isTarde = /\btarde\b/.test(low);
        const isNoite = /\bnoite\b/.test(low);
        const isPM = /\bpm\b/.test(low);
        const isAM = /\bam\b/.test(low);

        if (hh <= 12) {
            if (isTarde || isNoite || isPM) {
                if (hh !== 12) hh += 12;
            } else if (isManha || isAM) {
                if (hh === 12) hh = 0;
            }
        }

        if (mm == null) mm = 0;
        hh = clamp(hh, 0, 23);
        mm = clamp(mm, 0, 59);
        return { time: `${pad2(hh)}:${pad2(mm)}`, match: m[0] };
    }

    return null;
}

/** Palavras temporais (para a limpeza do título) */
function isTemporalWord(w) {
    return /^(hoje|amanha|depois|agora|cedo|tarde|noite|manha|madrugada|almoco)$/.test(
        w,
    );
}

/** Limpador de título semântico */
/** Limpador de título semântico (versão robusta) */
function cleanTitlePT(
    raw,
    { hasTime = false, hasDate = false, titleCase = false } = {},
) {
    // garante string
    raw = (raw ?? "").toString();

    const norm = normPT(raw);
    let tokens = norm.split(/\s+/).filter(Boolean);

    const KEEP_CONNECTORS = new Set([
        "de",
        "do",
        "da",
        "dos",
        "das",
        "com",
        "para",
        "pro",
        "pra",
        "no",
        "na",
        "nos",
        "nas",
        "du",
        "duma",
        "dum",
        "num",
        "numa",
    ]);

    // só considera “palavra de conteúdo” se for string válida
    const CONTENTY = (t) =>
        typeof t === "string" &&
        /^[a-z0-9]+$/.test(t) &&
        t.length >= 2 &&
        !isTemporalWord(t);

    // remove temporais se já extraímos quando/dia
    if (hasTime || hasDate) {
        tokens = tokens.filter((t) => !isTemporalWord(t));
    }

    // mantém conectores apenas entre palavras de conteúdo
    const kept = [];
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (typeof t !== "string") continue;

        if (KEEP_CONNECTORS.has(t)) {
            const prev = tokens[i - 1];
            const next = tokens[i + 1];
            if (CONTENTY(prev) && CONTENTY(next)) {
                kept.push(t);
            }
            // se não estiver entre conteúdo, descarta o conector
            continue;
        }

        kept.push(t);
    }

    let out = kept.join(" ");

    // polimentos
    out = out
        .replace(/\b(da|de|do)\s+(a|o)\b/g, (_, p1, p2) =>
            p1 === "de" && p2 === "a"
                ? "da"
                : p1 === "de" && p2 === "o"
                  ? "do"
                  : `${p1} ${p2}`,
        )
        .replace(/\s+/g, " ")
        .trim();

    if (titleCase && out) {
        out = out.charAt(0).toUpperCase() + out.slice(1);
    }
    return out;
}

function smartTitleRepairPT(raw = "") {
    if (!raw) return "";

    let t = String(raw)
        // espaço único + tira lixos iniciais/finais
        .replace(/\s+/g, " ")
        .trim();

    // Muletas/ruídos comuns no começo/fim
    const FILLERS_BEG =
        /^(tipo|assim|entao|então|olha|veja|bom|ah|eh|é|aham|ai|aí|cara|mano|meu|sei la|sei lá)\b[\s,]*/i;
    const FILLERS_END = /[\s,]*(tipo|assim|né|tá|tá bom|tá bom\?)\s*$/i;
    t = t.replace(FILLERS_BEG, "").replace(FILLERS_END, "");

    // Normalizações simples
    t = t
        .replace(/\bp\/\b/gi, "para")
        .replace(/\bpra\b/gi, "para")
        .replace(/\bpro\b/gi, "para o")
        .replace(/\bpra\b/gi, "para")
        .replace(/\bnuma?\b/gi, (m) =>
            m.toLowerCase() === "numa" ? "em uma" : "em um",
        )
        .replace(/\bq\b/gi, "que")
        .replace(/\bvc\b/gi, "você")
        .replace(/\btd\b/gi, "tudo")
        .replace(/\bblz\b/gi, "beleza");

    // --- Intenção falada no INÍCIO da frase (podar) -----------------------
    // exemplos: "eu preciso", "preciso", "tenho que/de", "devo", "vou",
    // "queria", "quero", "gostaria de", "é pra", "era pra", "tá pra", "tem que/de", "precisava", "precisava de"
    t = t.replace(
        /^(?:eu\s+)?(?:preciso|precisava|precisarei|tenho\s+(?:que|de)|tem\s+(?:que|de)|devo|vou|queria|quero|gostaria\s+de|era\s+pra|é\s+pra|t[áa]\s+pra)\b[\s,]*/i,
        "",
    );

    // Se depois da intenção vier só um verbo genérico, remove-o também.
    // "fazer/ver/olhar/checar/arrumar/resolver/anotar/marcar/ligar" etc.
    // (apenas quando vêm imediatamente após o começo, p/ não cortar verbos importantes no meio)
    t = t.replace(
        /^(?:fazer|ver|olhar|checar|arrumar|resolver|anotar|marcar|ligar|pegar|comprar|pagar|buscar)\b[\s,:-]*/i,
        "",
    );

    // --- Casca de comando: "crie uma tarefa/lembrete ..." --------------------
    t = t.replace(
        /^(?:cria(?:r)?|crie|adiciona(?:r)?|adicione|coloca(?:r)?|coloque|bota(?:r)?|bote|anota(?:r)?|anote|marca(?:r)?|marque|registra(?:r)?|registre|define|defina|configura(?:r)?|configure)\s+(?:uma?\s+)?(?:tarefa|lembrete|anotacao|anotação|nota|evento)\s*(?:para|pra|p\/)?\s*/i,
        "",
    );

    // --- “(para|pra|p/) me lembrar de …”, “me lembrar de …”, “lembrar de …” ---
    t = t
        // início da frase (mais comum)
        .replace(/^(?:para|pra|p\/)?\s*me\s+lembrar\s+de\s+/i, "")
        .replace(/^(?:para|pra|p\/)?\s*lembrar\s+de\s+/i, "")
        // em seguida de conectivos
        .replace(/\b(?:para|pra|p\/)?\s*me\s+lembrar\s+de\s+/i, " ")
        .replace(/\b(?:para|pra|p\/)?\s*lembrar\s+de\s+/i, " ");

    // --- “que eu …” logo após a casca (ex.: "crie ... que eu vá ao mercado") --
    t = t.replace(/^(?:que\s+eu|que\s+vou|que\s+iria|que\s+devo)\s+/i, "");

    // também cobre "me lembrar de", "te lembrar de", "nos lembrar de", etc.
    t = t.replace(
        /\b(?:para|pra|p\/)?\s*(?:me|te|nos|vos|lhe|lhes)?\s*lembrar\s+de\s+/i,
        " ",
    );

    // Limpezas de espaços novamente
    t = t.replace(/\s+/g, " ").trim();

    // "ora" x "hora": se houver número/“às/a”/“da”/“de” perto, é horário
    // ex.: "às 9 ora", "9 ora", "da ora", "de ora", ou "ora 10"
    t = t
        // número seguido de "ora(s)"
        .replace(/(\b\d{1,2})\s+oras?\b/gi, "$1 horas")
        // "às|a|da|de" + número + "ora(s)" (cobre "às 9 ora", "a 8 oras")
        .replace(/\b(as|às|a|da|de)\s+(\d{1,2})\s+oras?\b/gi, "$1 $2 horas")
        // número + "ora(s)" sem preposição
        .replace(/\b(\d{1,2})\s+ora(s?)\b/gi, "$1 hora$2")
        // "ora(s)" isolado com pista temporal no entorno → "hora(s)"
        .replace(
            /\bora(s?)\b(?=.*\b(\d{1,2}|manha|tarde|noite|am|pm)\b)/gi,
            "hora$1",
        )
        .replace(/(?<=\b(as|às|a|da|de)\s)\bora(s?)\b/gi, "hora$1");

    // Consolida "meio dia" / "meia noite" (exibição mais natural no título)
    t = t
        .replace(/\bmeio\s+dia\b/gi, "meio-dia")
        .replace(/\bmeia\s+noite\b/gi, "meia-noite");

    // “de o” / “de a” → contração (isso já existe em cleanTitle, mas reforçamos aqui no título final)
    t = t
        .replace(/\bde\s+o\b/gi, "do")
        .replace(/\bde\s+a\b/gi, "da")
        .replace(/\bem\s+o\b/gi, "no")
        .replace(/\bem\s+a\b/gi, "na");

    // Remove duplicatas seguidas de conectores: "de de", "para para", etc.
    t = t.replace(/\b(\p{L}{2,})\b\s+\1\b/giu, "$1");

    // Espaços finais
    t = t.replace(/\s+/g, " ").trim();

    return t;
}

/**
 * Pós-processo robusto para recuperar o núcleo da frase
 * em casos como: "E que eu lembre de ir ao supermercado"
 */
function finalizeTitlePT(raw = "") {
    let t = String(raw).replace(/\s+/g, " ").trim();

    // tira aspas/pontuação nas bordas
    t = t
        .replace(/^["'“”„«»]+/, "")
        .replace(/["'“”„«»]+$/, "")
        .trim();

    // conectivos/pronomes iniciais muito comuns quando o ASR confunde
    t = t
        .replace(
            /^(?:e\s+)?(?:que\s+(?:eu|a gente|vou|iria|devo)\s+|que\s+)/i,
            "",
        )
        .trim();

    // ainda pode ficar um "E " sozinho no começo
    t = t.replace(/^e\s+/i, "").trim();

    // se começa com alguma flexão de "lembrar", preserve o que vem depois de "de ..."
    // cobre: "lembre/lembrar/lembra/lembrando/me lembrar/de lembrar..."
    const mLembrar = t.match(/^(?:me\s+)?lembra\w*\s+(?:de\s+)(.+)$/i);
    if (mLembrar && mLembrar[1]) {
        t = mLembrar[1].trim();
    }

    // variação: "... que eu lembre de ...", se sobrou algo assim
    const mQueEu = t.match(
        /^(?:que\s+(?:eu|a gente)\s+)?lembra\w*\s+de\s+(.+)$/i,
    );
    if (mQueEu && mQueEu[1]) {
        t = mQueEu[1].trim();
    }

    // se ainda contém "lembrar de X" no meio, troque por "X"
    t = t.replace(/\b(?:me\s+)?lembrar\w*\s+de\s+/gi, "");

    // remove conectivos soltos no fim (às vezes sobram depois do strip temporal)
    t = t.replace(/\b(?:de|da|do|para|pra|p\/)\s*$/i, "").trim();

    // limpa espaços + capitaliza
    t = t.replace(/\s+/g, " ").trim();
    return capFirst(t);
}

// Remove sobras de expressões temporais (ex.: "horas", "às 10", "10h30")
// depois que já extraímos date/time.
function stripTemporalResidualPT(s) {
    if (!s) return s;
    let t = " " + s + " "; // bordas para facilitar regex com \b

    // 1) "às|as|a 10[:30] [horas|h|hs]"
    t = t.replace(
        /\b(?:às|as|a)\s*\d{1,2}(?:[:h]\d{2})?(?:\s*(?:horas?|h|hs))?\b/gi,
        " ",
    );

    // 2) "10[:30] [horas|h|hs]"
    t = t.replace(/\b\d{1,2}(?:[:h]\d{2})?\s*(?:horas?|h|hs)\b/gi, " ");

    // 3) "horas|hora" isolado (quando a parte numérica já saiu)
    t = t.replace(/\bhoras?\b/gi, " ");

    // 4) ruído comum de ASR: "ora(s)" sozinho → remove
    t = t.replace(/\boras?\b/gi, " ");

    // 5) sobras de conectores temporais soltos antes/depois de números removidos
    //    (ex.: "às", "as", "a" sobrando)
    t = t.replace(/\b(?:às|as|a)\b/gi, " ");

    // normaliza espaços
    t = t.replace(/\s+/g, " ").trim();
    return t;
}

/**
 * Extrai data (YYYY-MM-DD), hora (HH:mm) e um título limpo do transcript.
 * Se não houver hora explícita, tenta inferir por contexto (noite/tarde/…).
 */
export function extractWhenPTBR(transcript, now = new Date()) {
    const original = transcript.trim();
    let text = original;
    let date = null,
        time = null;
    let matches = [];

    // data explícita > relativa
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

    // hora explícita
    const tim = parseTime(text);
    if (tim) {
        time = tim.time;
        matches.push(tim.match);
    }

    // se NÃO tem hora, tenta inferir pelo contexto textual
    let inferred = null;
    if (!time) {
        inferred = inferTimeByContext(text, now);
        if (inferred) {
            time = inferred.time;
            matches.push(inferred.match);
        }
    }

    let titleSource = normPT(text);
    matches.forEach((m) => {
        if (!m) return;
        titleSource = titleSource.replace(normPT(m), " ");
    });
    titleSource = titleSource.replace(/\s+/g, " ").trim();

    titleSource = stripTemporalResidualPT(titleSource);

    const cleaned = cleanTitlePT(titleSource, {
        hasTime: Boolean(time),
        hasDate: Boolean(date),
        titleCase: false,
    });

    let finalTitle = finalizeTitlePT(smartTitleRepairPT(cleaned || original));

    return {
        title: finalTitle,
        dateYMD: date ? toYMD(date) : null,
        timeHHMM: time || null,
    };
}
