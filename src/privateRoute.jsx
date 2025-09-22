import { useAuth } from "./contexts/AuthContext";
import { Navigate } from "react-router-dom";

export function PrivateRoute({ children }) {
    const { currentUser } = useAuth();

    return currentUser ? children : <Navigate to='/login'></Navigate>
}