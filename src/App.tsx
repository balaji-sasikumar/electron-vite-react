import { useEffect, useState } from "react";
import "./App.css";

function App() {
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
    await window.ipcRenderer.invoke("open-dialog");
  };
  const convertFile = async () => {
    await window.ipcRenderer.invoke("convert-file");
  };

  return (
    <div className="App">
      <button onClick={open}>Open Explorer</button>
      <button onClick={convertFile}>Convert File</button>
      <h1>{message}</h1>
    </div>
  );
}

export default App;
