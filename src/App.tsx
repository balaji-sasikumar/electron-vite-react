import { useEffect, useState } from "react";
import "./App.css";
import Modal from "./components/update/Modal";

function App() {
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalBtn, setModalBtn] = useState<{
    cancelText?: string;
    okText?: string;
    onCancel?: () => void;
    onOk?: () => void;
  }>({
    onCancel: () => setModalOpen(false),
    onOk: () => window.ipcRenderer.invoke("start-download"),
  });
  useEffect(() => {
    window.ipcRenderer.on("file-processing", (event, message, date) => {
      console.log("Received message from main process: ", message);
      console.log("Received message from main process: ", date);
      setMessage(message);
      setDate(date);
      setModalOpen(true);
    });

    return () => {
      window.ipcRenderer.off("file-processing", () => {});
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
      <Modal
        open={modalOpen}
        cancelText={modalBtn?.cancelText}
        okText={modalBtn?.okText}
        onCancel={modalBtn?.onCancel}
        onOk={modalBtn?.onOk}
      >
        {message && (
          <div className="container">
            <div className="info-box">
              <h4>{message}</h4>
              <h5 style={{ textAlign: "right" }}>{date}</h5>
            </div>
          </div>
        )}
      </Modal>
      <button onClick={open}>Open Explorer</button>
      <button onClick={convertFile}>Convert File</button>
    </div>
  );
}

export default App;
