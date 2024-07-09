import { useEffect, useState } from "react";
import "./App.css";
import FileExplorer from "./components/FileUI/FileExplorer/file-explorer";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { InvokeEvent } from "./enums/invoke-event.enum";
import Snackbar from "@mui/material/Snackbar";
import { Alert, Box, CircularProgress, Slide, SlideProps } from "@mui/material";
const lightTheme = createTheme({
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
  fileId: string;
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
  const [loading, setLoading] = useState<boolean>(false);
  const sendOnlineStatus = () => {
    window.electron.sendOnlineStatus();
  };
  useEffect(() => {
    sendOnlineStatus();
    const handleOffline = () => {
      setSeverity("error");
      setMessage("You are offline. Please check your internet connection.");
      setSnackBarOpen(true);
      setFiles([]);
      sendOnlineStatus();
    };
    const handleOnline = () => {
      sendOnlineStatus();
      window.location.reload();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    (async () => {
      if (!navigator.onLine) {
        handleOffline();
        return;
      }

      if (localStorage.getItem("directories") === null)
        localStorage.setItem("directories", "");
      const configuration = localStorage.getItem("configuration");
      if (configuration === null) {
        setSeverity("info");
        setMessage("Please configure the application before using it.");
        setSnackBarOpen(true);
      } else {
        let directoryName = localStorage.getItem("directories");
        await window.ipcRenderer.invoke(
          InvokeEvent.GetFiles,
          configuration,
          directoryName
        );
      }

      window.ipcRenderer.on(
        InvokeEvent.FileProcessing,
        (event, title, message) => {
          setSeverity(title as any);
          setMessage(message);
          setSnackBarOpen(true);
        }
      );
      window.ipcRenderer.on(InvokeEvent.Loading, (event, loading) => {
        setLoading(loading);
      });

      window.ipcRenderer.on(InvokeEvent.GetFileResponse, (event, file) => {
        setFiles(file);
      });
    })();

    return () => {
      window.ipcRenderer.off(InvokeEvent.FileProcessing, () => {});
      window.ipcRenderer.off(InvokeEvent.GetFileResponse, () => {});
      window.ipcRenderer.off(InvokeEvent.Loading, () => {});
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <>
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        {loading && (
          <Box className="flex justify-center items-center w-full h-full fixed backdrop-blur-sm">
            <CircularProgress />
          </Box>
        )}
        <Snackbar
          open={snackBarOpen}
          onClose={() => setSnackBarOpen(false)}
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
