import { useEffect, useState } from "react";
import "./App.css";
import FileExplorer from "./components/FileUI/FileExplorer/file-explorer";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { InvokeEvent } from "./enums/invoke-event.enum";
import Snackbar from "@mui/material/Snackbar";
import PassCodeComponent from "./components/FileUI/PassCode/pass-code";
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
  const [showPassCode, setShowPassCode] = useState<boolean>(true);
  const sendOnlineStatus = () => {
    window.electron.sendOnlineStatus();
  };

  const showSnackBar = (severity: any, message: string) => {
    if (showPassCode && severity != "error") return;
    setSeverity(severity);
    setMessage(message);
    setSnackBarOpen(true);
  };

  let timeoutValue: NodeJS.Timeout;
  useEffect(() => {
    sendOnlineStatus();
    const handleOffline = () => {
      showSnackBar(
        "error",
        "You are offline. Please check your internet connection."
      );
      setFiles([]);
      sendOnlineStatus();
    };
    const handleOnline = () => {
      sendOnlineStatus();
      fetchData();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    const fetchData = async () => {
      if (!navigator.onLine) {
        handleOffline();
        return;
      }

      if (localStorage.getItem("directories") === null)
        localStorage.setItem("directories", "");
      const configuration = localStorage.getItem("configuration");
      if (configuration === null) {
        setFiles([]);
        showSnackBar(
          "info",
          "Please configure the application before using it."
        );
      } else {
        let directoryName = localStorage.getItem("directories");
        await window.ipcRenderer.invoke(
          InvokeEvent.GetFiles,
          configuration,
          directoryName
        );
      }

      window.ipcRenderer.on(
        InvokeEvent.FileProcessingMessage,
        (event, title, message) => {
          showSnackBar(title as any, message);
        }
      );
      window.ipcRenderer.on(InvokeEvent.Loading, (event, loading) => {
        setLoading(loading);
      });

      window.ipcRenderer.on(InvokeEvent.GetFileResponse, (event, file) => {
        setFiles(file);
      });
    };

    fetchData();

    window.ipcRenderer.on("app-state-changed", (event, message) => {
      clearTimeout(timeoutValue);
      if (message === "blur") {
        timeoutValue = setTimeout(() => {
          setShowPassCode(true);
        }, 10000);
      }
    });

    return () => {
      window.ipcRenderer.off(InvokeEvent.FileProcessingMessage, () => {});
      window.ipcRenderer.off(InvokeEvent.GetFileResponse, () => {});
      window.ipcRenderer.off(InvokeEvent.Loading, () => {});
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [showPassCode]);

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
        {showPassCode ? (
          <PassCodeComponent
            setShowPassCode={setShowPassCode}
            showSnackBar={showSnackBar}
          />
        ) : (
          <FileExplorer files={files} />
        )}
      </ThemeProvider>
    </>
  );
}

export default App;
