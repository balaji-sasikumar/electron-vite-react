import { useEffect, useState } from "react";
import "./App.css";
import Modal from "./components/update/Modal";
import SettingsComponent from "./components/update/Settings/settings";
import FileExplorer from "./components/update/FileExplorer/file-explorer";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

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
    onOk: () => window.ipcRenderer.invoke("start-download"),
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
        console.log("file share data", file);
        setFiles(file);
      });
    })();

    return () => {
      window.ipcRenderer.off("file-processing", () => {});
      window.ipcRenderer.off("get-fileshare-data", () => {});
    };
  }, []);

  const open = async () => {
    await window.ipcRenderer.invoke("open-dialog");
  };
  const convertFile = async () => {
    await window.ipcRenderer.invoke("convert-file");
  };

  const getShareFiles = async () => {
    await window.ipcRenderer.invoke("get-file");
  };

  // return (
  //   <div className="App">
  // <Modal
  //   open={modalOpen}
  //   cancelText={modalBtn?.cancelText}
  //   okText={modalBtn?.okText}
  //   onCancel={modalBtn?.onCancel}
  //   onOk={modalBtn?.onOk}
  // >
  //   {message && (
  //     <div className="container">
  //       <div className="info-box">
  //         <h4>{message}</h4>
  //         <h5 style={{ textAlign: "right" }}>{date}</h5>
  //       </div>
  //     </div>
  //   )}
  // </Modal>;
  //     <button onClick={open}>Open Explorer</button>
  //     <button onClick={convertFile}>Convert File</button>
  //     <button onClick={getShareFiles}>get File</button>
  //   </div>
  // );

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
