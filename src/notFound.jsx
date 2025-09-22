import { Link } from "react-router-dom";

export function NotFound() {
    return (
        <div className="d-flex d-column align-items-center justify-content-center height-100vh">

            <div className="backgroundDecoration">:(</div>

            <h1>404</h1>
            <h2 className="m-0">Página não encontrada</h2>
            <p className="mb-40">A rota que você tentou acessar não existe.</p>
            <Link to="/" className="btn-voltar">Voltar para Home</Link>
        </div>
    );
}