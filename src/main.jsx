import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { PrivateRoute } from "./privateRoute.jsx";
import App from "./App.jsx";
import Home from "./home.jsx";
import { Dashboard } from "./dashboard.jsx";
import { LogIn } from "./logIn.jsx";
import { Cadastro } from "./cadastro.jsx";
import { NotFound } from "./notFound";
import NovaTarefa from "./view/tasks/novaTarefa.jsx";
import Shell from "./Shell";
import UserProfile from "./view/userProfile.jsx";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <PrivateRoute>
                                <App />
                            </PrivateRoute>
                        }
                    >
                        <Route index element={<Home />} />
                        <Route path="dashboard" element={<Dashboard />} />
                    </Route>

                    <Route
                        path="/login"
                        element={
                            <Shell showNavbar={false}>
                                <LogIn />
                            </Shell>
                        }
                    />
                    <Route
                        path="/cadastro"
                        element={
                            <Shell showNavbar={false}>
                                <Cadastro />
                            </Shell>
                        }
                    />
                    <Route
                        path="/nova-tarefa"
                        element={
                            <Shell showNavbar={false}>
                                <NovaTarefa />
                            </Shell>
                        }
                    />
                    <Route
                        path="perfil"
                        element={
                            <Shell showNavbar={false}>
                                <UserProfile />
                            </Shell>
                        }
                    />
                    <Route
                        path="*"
                        element={
                            <Shell showNavbar={false}>
                                <NotFound />
                            </Shell>
                        }
                    />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    </StrictMode>,
);

if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
                const url = new URL(
                    reg.active?.scriptURL ||
                        reg.waiting?.scriptURL ||
                        reg.installing?.scriptURL ||
                        "",
                    location.href,
                );
                if (url.pathname !== "/sw.js") {
                    await reg.unregister();
                }
            }

            const reg = await navigator.serviceWorker.register("/sw.js", {
                scope: "/",
            });
            console.log("Service Worker registrado. Escopo:", reg.scope);

            navigator.serviceWorker.addEventListener("message", (evt) => {
                console.log("Mensagem do SW:", evt.data);
            });
        } catch (err) {
            console.error("Falha ao registrar Service Worker:", err);
        }
    });
}
