export async function shareTask(task) {
    if(!navigator.canShare) {
        throw new Error("Navegador não suporta Web Share API");
    } else if(!task) {
        throw new Error("Tarefa inválida para compartilhamento");
    } else {
        const text = `Tarefa: ${task.descricao}\nHora: ${task.hora || ''} Data: ${task.data}\nConcluída: ${task.done ? "Sim" : "Não"}`; //adicionar localização depois
    }
}