import { Outlet } from "react-router-dom";
import Shell from "./Shell";
import "./App.css";
import "./css/index.css";
import "./css/task.css";
import "./css/inputs.css";
import "./css/login.css";
import "./css/navbar.css";
import "./css/buttons.css";
import "./css/modal.css";
import "./css/magicInput.css";

export default function Layout() {
    return (
        <Shell showNavbar>
            <Outlet />
        </Shell>
    );
}
