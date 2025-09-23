export async function getUserLocation() {
    if (!navigator.geolocation) return null;
    try {
        return await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) =>
                    resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    }),
                (err) => resolve(null),
                { enableHighAccuracy: true },
            );
        });
    } catch (error) {
        return null;
    }
}

export async function shareTask(task) {
    if (!navigator.canShare) {
        throw new Error("Navegador não suporta Web Share API");
    } else if (!task) {
        throw new Error("Tarefa inválida para compartilhamento");
    } else {
        const text = `Tarefa: ${task.descricao}\nHora: ${task.hora || ""} Data: ${task.data}\nConcluída: ${task.done ? "Sim" : "Não"}`; //adicionar localização depois
    }
}
