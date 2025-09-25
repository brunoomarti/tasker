import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
    getTasks as _getTasks,
    getTasksByUser as _getTasksByUser,
} from "../utils/db";
import { useNavigate } from "react-router-dom";

export default function UserProfile() {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [taskCount, setTaskCount] = useState(0);
    const [loadingTasks, setLoadingTasks] = useState(true);

    const name =
        (currentUser?.displayName && currentUser.displayName.trim()) ||
        "Usuário";
    const email = currentUser?.email || "—";

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                let tasks = [];
                if (typeof _getTasksByUser === "function" && currentUser?.uid) {
                    tasks = await _getTasksByUser(currentUser.uid);
                } else if (typeof _getTasks === "function") {
                    tasks = await _getTasks();
                }
                if (isMounted)
                    setTaskCount(Array.isArray(tasks) ? tasks.length : 0);
            } catch (e) {
                console.error("Erro ao buscar tarefas:", e);
                if (isMounted) setTaskCount(0);
            } finally {
                if (isMounted) setLoadingTasks(false);
            }
        })();
        return () => {
            isMounted = false;
        };
    }, [currentUser?.uid]);

    async function handleLogout() {
        try {
            await logout();
            navigate("/login", { replace: true });
        } catch (err) {
            console.error("Erro ao fazer logout: " + err);
            navigate("/login", { replace: true });
        }
    }

    return (
        <div
            className="p-20"
            style={{
                display: "flex",
                flexDirection: "column",
                flex: "1 1 auto",
            }}
        >
            <div
                style={{
                    flex: "1 1 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div
                    className="profile-card"
                    style={{
                        width: "min(560px, 92vw)",
                        borderRadius: "20px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                        background: "white",
                        padding: "32px 28px",
                        textAlign: "center",
                    }}
                >
                    <div
                        style={{
                            width: 112,
                            height: 112,
                            margin: "0 auto 16px",
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            background:
                                "radial-gradient(55% 55% at 50% 45%, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 100%)",
                        }}
                    >
                        <span
                            className="material-symbols-outlined"
                            aria-hidden="true"
                            style={{
                                fontSize: 84,
                                lineHeight: 1,
                                color: "#555",
                            }}
                        >
                            account_circle
                        </span>
                    </div>

                    <h2 style={{ margin: "0 0 6px", fontWeight: 700 }}>
                        {name}
                    </h2>
                    <p
                        className="secondary-text"
                        style={{
                            margin: 0,
                            color: "#666",
                            fontSize: 14,
                            wordBreak: "break-all",
                        }}
                    >
                        {email}
                    </p>

                    <div
                        style={{
                            height: 1,
                            background:
                                "linear-gradient(90deg, transparent, rgba(0,0,0,0.08), transparent)",
                            margin: "20px 0",
                        }}
                    />

                    <div
                        className="stats"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 16,
                            flexWrap: "wrap",
                        }}
                    >
                        <div
                            style={{
                                padding: "10px 16px",
                                borderRadius: 12,
                                border: "1px solid rgba(0,0,0,0.08)",
                                minWidth: 160,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "#666",
                                    marginBottom: 4,
                                }}
                            >
                                Tarefas registradas
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700 }}>
                                {loadingTasks ? "—" : taskCount}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 12,
                }}
            >
                <button
                    onClick={handleLogout}
                    className="logout-button warnBtn w-100"
                    aria-label="Sair da conta"
                    style={{
                        appearance: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#fff",
                        fontWeight: 700,
                        padding: "12px 18px",
                        borderRadius: 12,
                        transition:
                            "transform .08s ease, box-shadow .12s ease, filter .12s ease",
                    }}
                    onMouseDown={(e) =>
                        (e.currentTarget.style.transform = "translateY(1px)")
                    }
                    onMouseUp={(e) =>
                        (e.currentTarget.style.transform = "translateY(0)")
                    }
                    onMouseLeave={(e) =>
                        (e.currentTarget.style.transform = "translateY(0)")
                    }
                >
                    Sair
                </button>
            </div>
        </div>
    );
}
