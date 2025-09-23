import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

function UserDock() {
    const { currentUser } = useAuth();

    const name =
        (currentUser?.displayName && currentUser.displayName.trim());

    return (
        <div className="d-flex flex-row gap-10 justify-space-between align-center relative mb-40">
            <div className="d-flex user-photo absolute horizontal-center-absolute left-0">
                <span className="material-symbols-outlined">
                    account_circle
                </span>
            </div>

            <div
                className="d-flex flex-column justify-center"
                style={{ flex: "1 1 auto" }}
            >
                <p className="weight-600">{name}</p>
                <p className="secondary-text" style={{ margin: 0 }}>
                    {new Date().toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "long",
                    })}
                </p>
            </div>

            <Link
                to="/nova-tarefa"
                className="d-flex add-task absolute horizontal-center-absolute right-0"
            >
                <span className="material-symbols-outlined">add_circle</span>
            </Link>
        </div>
    );
}

export default UserDock;
