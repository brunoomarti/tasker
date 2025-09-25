import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "../utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

const AuthContext = createContext(null);

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
                setCurrentUser(user ?? null);
                setLoading(false);
            },
            (err) => {
                console.error("onAuthStateChanged error:", err);
                setCurrentUser(null);
                setLoading(false);
            },
        );
        return unsubscribe;
    }, []);

    async function logout() {
        try {
            await signOut(auth);
        } catch (err) {
            console.error("Erro ao deslogar:", err);
            throw err;
        }
    }

    const value = useMemo(
        () => ({
            currentUser,
            isAuthenticated: !!currentUser,
            logout,
        }),
        [currentUser],
    );

    if (loading) return null;

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}
