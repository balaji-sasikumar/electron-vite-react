import { useEffect, useState } from "react";
import "./App.css";
import Modal from "./components/update/Modal";
import SettingsComponent from "./components/update/Settings/settings";
import FileExplorer from "./components/update/FileExplorer/file-explorer";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const darkTheme = createTheme({
  palette: {
    mode: "light",
  },
});
interface File {
  kind: string;
  name: string;
  properties: {
    contentLength: number;
  };
}
function App() {
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalBtn, setModalBtn] = useState<{
    cancelText?: string;
    okText?: string;
    onCancel?: () => void;
    onOk?: () => void;
  }>({
    onCancel: () => setModalOpen(false),
    onOk: () => setModalOpen(false),
  });

  useEffect(() => {
    (async () => {
      const configuration = localStorage.getItem("configuration");
      let directoryName = localStorage.getItem("directories");
      await window.ipcRenderer.invoke("get-file", configuration, directoryName);

      window.ipcRenderer.on("file-processing", (event, message, date) => {
        console.log("file processing message", message, date);
        setMessage(message);
        setDate(date);
        setModalOpen(true);
      });

      window.ipcRenderer.on("get-fileshare-data", (event, file) => {
        console.log("fileshare data", file);
        setFiles(file);
      });
    })();

    return () => {
      window.ipcRenderer.off("file-processing", () => {});
      window.ipcRenderer.off("get-fileshare-data", () => {});
    };
  }, []);

  return (
    <>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
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
        <FileExplorer files={files} />
      </ThemeProvider>
    </>

    // <SettingsComponent />
  );
}

export default App;
