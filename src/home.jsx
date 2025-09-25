import { useState } from "react";
import UserDock from "./view/components/userDock.jsx";
import Tasks from "./view/tasks/tasksComponent.jsx";
import MagicTaskInput from "./view/components/magicTaskInput.jsx";

function Home() {
    const [listKey, setListKey] = useState(0);

    return (
        <>
            <UserDock />
            <div className="d-flex flex-column gap-10">
                <MagicTaskInput
                    placeholder="Digite ou fale: 'Levar meu pet amanhã de tarde'"
                    autofocus
                    onCreated={() => setListKey((k) => k + 1)}
                />
                <Tasks key={listKey} />
            </div>
        </>
    );
}

export default Home;
