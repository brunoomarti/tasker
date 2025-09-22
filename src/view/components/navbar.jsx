import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
    const { pathname } = useLocation();
    return (
        <nav className="navbar-bottom">
            <Link to="/" className={pathname === "/" ? "active" : ""}>
                <span className="material-symbols-outlined">home</span>
            </Link>
            <Link
                to="/dashboard"
                className={pathname === "/dashboard" ? "active" : ""}
            >
                <span className="material-symbols-outlined">dashboard</span>
            </Link>
        </nav>
    );
}
