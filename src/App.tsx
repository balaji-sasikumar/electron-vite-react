import { useEffect, useState } from "react";
import "./App.css";
import SettingsComponent from "./components/update/Settings/settings";
import FileExplorer from "./components/update/FileExplorer/file-explorer";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { InvokeEvent } from "./enums/invoke-event.enum";
import AlertDialog from "./components/update/Dialog/dialog";
const darkTheme = createTheme({
  palette: {
    mode: "dark",
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
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
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
      await window.ipcRenderer.invoke(
        InvokeEvent.GetFile,
        configuration,
        directoryName
      );

      window.ipcRenderer.on(
        InvokeEvent.FileProcessing,
        (event, title, message) => {
          setTitle(title);
          setMessage(message);
          setModalOpen(true);
        }
      );

      window.ipcRenderer.on(InvokeEvent.GetFileResponse, (event, file) => {
        setFiles(file);
      });
    })();

    return () => {
      window.ipcRenderer.off(InvokeEvent.FileProcessing, () => {});
      window.ipcRenderer.off(InvokeEvent.GetFileResponse, () => {});
    };
  }, []);

  return (
    <>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <AlertDialog
          open={modalOpen}
          onClose={modalBtn.onCancel || (() => {})}
          onOk={modalBtn.onOk || (() => {})}
          title={title}
          message={message}
          showCancel={false}
        />
        <FileExplorer files={files} />
      </ThemeProvider>
    </>

    // <SettingsComponent />
  );
}

export default App;
