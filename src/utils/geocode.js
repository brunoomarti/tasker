const mem = new Map();

export async function reverseGeocode({ lat, lng }) {
    if (lat == null || lng == null) return null;

    const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lng),
        "accept-language": "pt-BR",
    });

    const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;

    try {
        const res = await fetch(url, {
            headers: { Accept: "application/json" },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.display_name || null;
    } catch {
        return null;
    }
}

export async function getAddressCached(lat, lng) {
    const key = `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;

    if (mem.has(key)) {
        try {
            return await mem.get(key);
        } catch {
            /* ignora */
        }
    }

    if (!navigator.onLine) return null;

    const p = reverseGeocode({ lat, lng });
    p.then((addr) => {
        if (addr) mem.set(key, Promise.resolve(addr));
    });
    return p;
}
