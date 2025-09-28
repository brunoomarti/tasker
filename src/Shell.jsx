import Navbar from "./view/components/navbar";
import ConnectionBanner from "./view/components/ConnectionBanner";

export default function Shell({ children, showNavbar = true }) {
    return (
        <div className="app-container">
            <ConnectionBanner />

            <div className="main-content d-flex flex-column">{children}</div>
            {showNavbar && <Navbar />}
        </div>
    );
}
