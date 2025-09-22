import { useState } from "react";
import { logIn } from "./utils/firebase";
import { Link } from "react-router-dom";

export function LogIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function handleSignIn(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await logIn(email, password);
            window.location.href = "/";
        } catch (err) {
            setError("Erro ao fazer login: " + err.message);
        }

        setLoading(false);
    }

    return (
        <div className="d-flex flex-column align-items-center" style={{flex: '1 1 auto', justifyContent: 'center'}}>
            <h2>Entrar</h2>
            <form className="d-flex flex-column gap-10" onSubmit={handleSignIn}>
                <div className="complete-input">
                    <label htmlFor="email">E-mail</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="username"
                        placeholder="Digite seu e-mail"
                    />
                </div>

                <div className="complete-input">
                    <label htmlFor="password">Senha</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        placeholder="Digite sua senha"
                    />
                </div>

                {error && <p className="error">{error}</p>}

                <button type="submit" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                </button>

                <p>
                    Não tem conta? <Link to="/cadastro">Cadastre-se</Link>
                </p>
            </form>
        </div>
    );
}
