import { useState } from "react";
import { register } from "./utils/firebase"; 
import { Link } from "react-router-dom";

export function Cadastro() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleRegister(e) {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            setLoading(false);
            return;
        }
        if (password.length < 0) {
            setError("A senha deve ter pelo menos 6 caracteres.");
            setLoading(false);
            return;
        }

        try {
            await register(email, password);
            window.location.href = "/";
        } catch (err) {
            setError("Erro ao criar a conta: " + err.message);
        }
        setLoading(false);
    }

    return (
         <div className="d-flex flex-column align-items-center" style={{flex: '1 1 auto', justifyContent: 'center'}}>
            <h2>Criar conta</h2>
            <form className="d-flex d-column gap-10" onSubmit={handleRegister}>
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
                        autoComplete="new-password"
                        placeholder="Digite sua senha"
                    />
                </div>

                <div className="complete-input">
                    <label htmlFor="confirmPassword">Confirme a senha</label>
                    <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        placeholder="Confirme sua senha"
                    />
                </div>

                {error && <p className="error">{error}</p>}

                <button type="submit" disabled={loading}>
                    {loading ? "Cadastrando..." : "Cadastrar"}
                </button>

                <p>
                    Já tem conta? <Link to="/login">Entrar</Link>
                </p>
            </form>
        </div>
    );
}
