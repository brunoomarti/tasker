import Navbar from "./view/components/navbar";

export default function Shell({ children, showNavbar = true }) {
    return (
        <div className="app-container">
            <div className="main-content d-flex flex-column">{children}</div>
            {showNavbar && <Navbar />}
        </div>
    );
}
