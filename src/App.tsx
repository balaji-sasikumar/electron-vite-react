import { lazy, useEffect, useState } from "react";
import "./App.css";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { InvokeEvent } from "./enums/invoke-event.enum";
import Snackbar from "@mui/material/Snackbar";
import { Alert, Box, CircularProgress, Slide, SlideProps } from "@mui/material";
const FileExplorer = lazy(
  () => import("./components/FileUI/FileExplorer/file-explorer")
);
import PassCodeComponent from "./components/FileUI/PassCode/pass-code";
import { File } from "../electron/interfaces/file.interface";

const lightTheme = createTheme({
  palette: {
    mode: "light",
  },
});
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
  const [snackBarHold, setSnackBarHold] = useState<boolean>(false);
  const sendOnlineStatus = () => {
    window.electron.sendOnlineStatus();
  };

  const showSnackBar = (
    severity: any,
    message: string,
    hold: boolean = false
  ) => {
    if (showPassCode && severity != "error") return;
    setSeverity(severity);
    setMessage(message);
    setSnackBarOpen(true);
    setSnackBarHold(hold);
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
    let tempPath = JSON.parse(
      localStorage.getItem("configuration") || "{}"
    ).tempPath;
    window.ipcRenderer.invoke(InvokeEvent.SendTempPath, tempPath);
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
        (event, title, message, hold?) => {
          showSnackBar(title as any, message, hold);
        }
      );
      window.ipcRenderer.on(InvokeEvent.Loading, (event, loading) => {
        setLoading(loading);
      });

      window.ipcRenderer.on(InvokeEvent.GetFileResponse, (event, file) => {
        setFiles(file);
      });
      window.ipcRenderer.on(
        InvokeEvent.SetCurrentDirectory,
        (event, currentDirectoryId) => {
          localStorage.setItem("currentDirectory", currentDirectoryId);
        }
      );
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
      window.ipcRenderer.off(InvokeEvent.SetCurrentDirectory, () => {});
      window.ipcRenderer.off("app-state-changed", () => {});
      window.ipcRenderer.off(InvokeEvent.SendTempPath, () => {});
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
          autoHideDuration={snackBarHold ? null : 5000}
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
        {false ? (
          <PassCodeComponent
            setShowPassCode={setShowPassCode}
            showSnackBar={showSnackBar}
          />
        ) : (
          <FileExplorer files={files} showSnackBar={showSnackBar} />
        )}
      </ThemeProvider>
    </>
  );
}

export default App;
