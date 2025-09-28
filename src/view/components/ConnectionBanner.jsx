// view/components/ConnectionBanner.jsx
import React from "react";
import useConnectivityBanner from "../../utils/useConnectivityBanner";

export default function ConnectionBanner() {
    const { type, message, visible, hide } = useConnectivityBanner(3000);
    const isOnline = type === "online";

    const bg = isOnline ? "#10b981" : "#ef4444";
    const icon = isOnline ? "wifi" : "wifi_off";
    const label = isOnline ? "Online" : "Offline";

    return (
        <div
            role="status"
            aria-live="polite"
            // FICA NO FLUXO (empurra o conteúdo). Usamos maxHeight + padding animados.
            style={{
                position: "sticky",
                top: 0,
                width: "100%",
                zIndex: 5, // abaixo do seu modal/navbar se quiser
                overflow: "hidden",
                background: bg,
                color: "#fff",
                boxShadow: visible ? "0 2px 12px rgba(0,0,0,.12)" : "none",

                // animação de abrir/fechar sem overlay
                maxHeight: visible ? 56 : 0,
                paddingTop: visible
                    ? "calc(env(safe-area-inset-top, 0px) + 6px)"
                    : 0,
                paddingBottom: visible ? 6 : 0,
                transition:
                    "max-height 180ms ease, padding 180ms ease, box-shadow 180ms ease",
            }}
        >
            <div
                // NÃO use classe .container aqui pra evitar regras globais
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0 12px",
                    fontSize: 14,
                    lineHeight: 1.25,
                }}
            >
                <span className="material-symbols-outlined" aria-hidden="true">
                    {icon}
                </span>

                <strong style={{ fontWeight: 600 }}>{label}</strong>
                <span style={{ opacity: 0.95 }}>{message}</span>

                <button
                    onClick={hide}
                    aria-label="Fechar aviso de conexão"
                    style={{
                        marginLeft: "auto",
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        padding: 4,
                        borderRadius: 6,
                    }}
                >
                    <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                    >
                        close
                    </span>
                </button>
            </div>
        </div>
    );
}
