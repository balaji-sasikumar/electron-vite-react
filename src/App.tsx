import { useEffect, useState } from "react";
import "./App.css";
import FileExplorer from "./components/update/FileExplorer/file-explorer";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { InvokeEvent } from "./enums/invoke-event.enum";
import Snackbar from "@mui/material/Snackbar";
import { Alert, Slide, SlideProps } from "@mui/material";
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
function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}
function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<
    "success" | "info" | "warning" | "error" | undefined
  >("info");
  const [snackBarOpen, setSnackBarOpen] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const configuration = localStorage.getItem("configuration");
      if (configuration === null) {
        setSeverity("info");
        setMessage("Please configure the application before using it.");
        setSnackBarOpen(true);
        return;
      }
      let directoryName = localStorage.getItem("directories");
      await window.ipcRenderer.invoke(
        InvokeEvent.GetFile,
        configuration,
        directoryName
      );

      window.ipcRenderer.on(
        InvokeEvent.FileProcessing,
        (event, title, message) => {
          setSeverity(title as any);
          setMessage(message);
          setSnackBarOpen(true);
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
        <Snackbar
          open={snackBarOpen}
          onClose={() => setSnackBarOpen(false)}
          autoHideDuration={5000}
          TransitionComponent={SlideTransition}
        >
          <Alert
            onClose={() => setSnackBarOpen(false)}
            severity={severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {message}
          </Alert>
        </Snackbar>
        <FileExplorer files={files} />
      </ThemeProvider>
    </>
  );
}

export default App;
