import { useAuth } from "./contexts/AuthContext";
import UserDock from "./view/components/userDock.jsx";
import Tasks from "./view/tasks/tasksComponent.jsx";

function Home() {
    const { currentUser, logout } = useAuth();

    async function handleLogout() {
        try {
            await logout();
        } catch (err) {
            console.error("Erro ao fazer logout: " + err);
        }
    }

    return (
        <>
            <UserDock />
            <Tasks />
        </>
    );
}

export default Home;
