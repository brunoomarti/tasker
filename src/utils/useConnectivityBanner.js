// utils/useConnectivityBanner.js
import { useEffect, useRef, useState } from "react";

/**
 * Mostra a faixa quando ficar offline.
 * Quando voltar online: mostra verde e some após `autoHideMs` (padrão 3000ms).
 */
export default function useConnectivityBanner(autoHideMs = 3000) {
    const [visible, setVisible] = useState(false);
    const [type, setType] = useState(navigator.onLine ? "online" : "offline");
    const [message, setMessage] = useState("");

    const timerRef = useRef(null);

    function clearTimer() {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }

    function hide() {
        clearTimer();
        setVisible(false);
    }

    useEffect(() => {
        // estado inicial: se estiver offline ao abrir, já mostra a faixa vermelha
        if (!navigator.onLine) {
            setType("offline");
            setMessage("Sem conexão (offline)");
            setVisible(true);
        }

        function handleOffline() {
            clearTimer();
            setType("offline");
            setMessage("Sem conexão (offline)");
            setVisible(true); // fica visível até voltar online
        }

        function handleOnline() {
            clearTimer();
            setType("online");
            setMessage("Conexão restabelecida");
            setVisible(true);
            // auto-esconde depois de alguns segundos
            timerRef.current = setTimeout(() => {
                setVisible(false);
            }, autoHideMs);
        }

        window.addEventListener("offline", handleOffline);
        window.addEventListener("online", handleOnline);

        return () => {
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("online", handleOnline);
            clearTimer();
        };
    }, [autoHideMs]);

    return { type, message, visible, hide };
}
