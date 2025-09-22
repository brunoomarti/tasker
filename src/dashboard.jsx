import { useEffect, useState } from "react";
import { getTasks } from "./utils/db";
import { Link } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";

export function Dashboard() {
    const { currentUser, logout } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [completedTasks, setCompletedTasks] = useState([]);

    useEffect(() => {
        async function fecthTasks() {
            const allTasks = await getTasks();
            setTasks(allTasks);
            const filtered = allTasks.filter((t) => t.done);
            setCompletedTasks(filtered);
        }
        fecthTasks();
    }, []);

    return (
        <div className="d-flex d-column w-100">
            <div className="d-flex d-column gap-10 justify-space-between align-left mb-40 w-100">
                <h2 className="d-flex align-left m-0">Tarefas concluídas</h2>
                <Link to="/">
                    <button type="button" className="btn-access">
                        ← Voltar para Home
                    </button>
                </Link>
            </div>

            {completedTasks.length === 0 ? (
                <p>Nenhuma tarefa concluída.</p>
            ) : (
                <div className="d-flex d-column gap-10 w-100">
                    {completedTasks.map((task) => (
                        <div
                            className="taskItem d-flex d-column justify-space-between gap-5"
                            key={task.id}
                        >
                            <h3 className="align-left">{task.title}</h3>
                            <div className="d-flex d-row gap-10 justify-space-between">
                                <p className="d-flex d-row gap-5 align-left align-items-center">
                                    <span className="material-icons">
                                        schedule
                                    </span>
                                    {task.hora}
                                </p>
                                <p
                                    className={
                                        task.done
                                            ? "status-concluida"
                                            : "status-pendente"
                                    }
                                >
                                    {task.done ? "Concluída" : "Pendente"}
                                </p>
                                <div className="d-flex d-column">
                                    {task.synced ? (
                                        <p className="status-synced">
                                            Sincronizada
                                        </p>
                                    ) : (
                                        <p className="status-not-synced">
                                            Não sincronizada
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
