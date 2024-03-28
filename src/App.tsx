import { useEffect, useState } from "react";
import UpdateElectron from "@/components/update";
import logoVite from "./assets/logo-vite.svg";
import logoElectron from "./assets/logo-electron.svg";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    window.ipcRenderer.on("main-process-message", (event, message) => {
      console.log("Received message from main process: ", message);
      setMessage(message);
    });

    return () => {
      window.ipcRenderer.off("main-process-message", () => {});
    };
  }, []);

  const open = async () => {
    let res = await window.ipcRenderer.invoke("open-dialog");
    console.log(res);
  };

  return (
    <div className="App">
      <button onClick={open}>open electron</button>
      <h1>{message}</h1>
      {/* <UpdateElectron /> */}
    </div>
  );
}

export default App;
