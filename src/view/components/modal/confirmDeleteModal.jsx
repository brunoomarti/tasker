import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function ConfirmDeleteModal({
    open,
    taskTitle,
    onCancel,
    onConfirm,
}) {
    const [loading, setLoading] = useState(false);

    async function handleConfirm() {
        try {
            setLoading(true);
            await onConfirm();
        } finally {
            setLoading(false);
        }
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                >
                    <motion.div
                        className="modal-card"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3>Excluir tarefa?</h3>
                        <p>
                            Tem certeza que deseja excluir{" "}
                            <strong>{taskTitle || "esta tarefa"}</strong>?
                        </p>

                        <div className="modal-actions">
                            <button
                                className="outline"
                                onClick={onCancel}
                                disabled={loading}
                            >
                                Cancelar
                            </button>
                            <button
                                className="warnBtn"
                                onClick={handleConfirm}
                                disabled={loading}
                            >
                                {loading ? (
                                    <span
                                        className="spinner"
                                        aria-label="Excluindo..."
                                    />
                                ) : (
                                    "Excluir"
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
