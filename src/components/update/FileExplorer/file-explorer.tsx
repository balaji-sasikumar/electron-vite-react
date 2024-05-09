import React, { useEffect, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Modal from "@mui/material/Modal";
import "./file-explorer.css";
import { InvokeEvent } from "@/enums/invoke-event.enum";
import AlertDialog from "../Dialog/dialog";
interface File {
  kind: string;
  name: string;
  properties: {
    contentLength: number;
  };
}

interface Props {
  files: File[];
}
const style = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};
const FileExplorer: React.FC<Props> = ({ files }) => {
  const [currentDirectory, setCurrentDirectory] = useState<string>(
    (localStorage.getItem("directories") || "").split("/").pop() || ""
  );
  const [open, setOpen] = React.useState(false);
  const [folderName, setFolderName] = React.useState("");

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
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setFolderName("");
    setOpen(false);
  };
  useEffect(() => {
    window.ipcRenderer.on(InvokeEvent.TryFetch, async (event) => {
      refresh();
    });

    return () => {
      window.ipcRenderer.off(InvokeEvent.TryFetch, () => {});
    };
  }, []);

  const refresh = async () => {
    const configuration = localStorage.getItem("configuration");
    let directories = localStorage.getItem("directories") || "";
    await window.ipcRenderer.invoke(
      InvokeEvent.GetFile,
      configuration,
      directories
    );
  };

  const goBack = async () => {
    let directories = localStorage.getItem("directories") || "";
    const dirs = directories.split("/");
    dirs.pop();
    directories = dirs.join("/");
    setCurrentDirectory(dirs[dirs.length - 1]);
    localStorage.setItem("directories", directories);
    refresh();
  };

  const createFolder = async () => {
    const configuration = localStorage.getItem("configuration");
    let directories = localStorage.getItem("directories") || "";
    await window.ipcRenderer.invoke(
      InvokeEvent.CreateDirectory,
      configuration,
      directories,
      folderName
    );
    handleClose();
  };

  const openFile = async (file: any) => {
    const configuration = localStorage.getItem("configuration");
    let directories = localStorage.getItem("directories") || "";

    if (file.kind === "directory") {
      if (directories) {
        directories += "/";
      }
      directories += file.name;
      setCurrentDirectory(file.name);
      localStorage.setItem("directories", directories);
      await window.ipcRenderer.invoke(
        InvokeEvent.GetFile,
        configuration,
        directories
      );
      return;
    }

    await window.ipcRenderer.invoke(
      InvokeEvent.OpenFile,
      file,
      configuration,
      directories
    );
  };

  const deleteDialog = async (file: any) => {
    setModalOpen(true);
    setTitle("Delete File");
    setMessage(
      `Are you sure you want to delete ${
        file.kind === "file" ? "file" : "folder"
      } ${file.name}?`
    );
    setModalBtn({
      onOk: async () => {
        await deleteFile(file);
        setModalOpen(false);
      },
      onCancel: () => {
        setModalOpen(false);
      },
    });
  };

  const deleteFile = async (file: any) => {
    const configuration = localStorage.getItem("configuration");
    let directories = localStorage.getItem("directories") || "";
    let directoryPath = directories;
    if (directoryPath) {
      directoryPath += "/";
    }
    directoryPath += file.name;
    if (file.kind === "directory") {
      await window.ipcRenderer.invoke(
        InvokeEvent.DeleteDirectory,
        configuration,
        directoryPath
      );
    } else {
      await window.ipcRenderer.invoke(
        InvokeEvent.DeleteFile,
        configuration,
        directories,
        file.name
      );
    }
  };

  const uploadFile = async () => {
    const configuration = localStorage.getItem("configuration");
    let directories = localStorage.getItem("directories") || "";
    await window.ipcRenderer.invoke(
      InvokeEvent.UploadFromPC,
      configuration,
      directories
    );
  };

  function convertContentLength(contentLength: number): string {
    if (contentLength < 1024) {
      return contentLength + " B";
    } else if (contentLength < 1024 * 1024) {
      return (contentLength / 1024).toFixed(2) + " KB";
    } else {
      return (contentLength / (1024 * 1024)).toFixed(2) + " MB";
    }
  }
  function CreateFolderModal() {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <div className="flex flex-col gap-3">
            <TextField
              id="outlined-basic"
              label="Enter Folder Name"
              variant="outlined"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  createFolder();
                }
              }}
            />
            <div className="flex flex-row gap-3">
              <Button
                variant="contained"
                onClick={createFolder}
                className="flex-1"
              >
                Create Folder
              </Button>
              <Button
                variant="outlined"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Box>
      </Modal>
    );
  }
  return (
    <>
      <AlertDialog
        open={modalOpen}
        onClose={modalBtn.onCancel || (() => {})}
        onOk={modalBtn.onOk || (() => {})}
        title={title}
        message={message}
        showCancel={true}
        okText="Delete"
      />
      {CreateFolderModal()}
      <div className="flex my-3">
        {currentDirectory && (
          <span
            className="material-symbols-outlined  cursor-pointer"
            onClick={() => {
              goBack();
            }}
          >
            chevron_left
          </span>
        )}
        <span className="folder">{currentDirectory || "Home"}</span>
        <div className="ml-auto flex justify-end gap-3">
          <Button
            variant="outlined"
            className="new-folder flex items-center justify-center gap-2 cursor-pointer"
            onClick={handleOpen}
          >
            <span className="material-symbols-outlined">create_new_folder</span>
            Add Folder
          </Button>
          <Button
            variant="contained"
            className="upload-file flex items-center justify-center gap-2 cursor-pointer"
            onClick={uploadFile}
          >
            <span className="material-symbols-outlined">upload_file</span>
            Upload File
          </Button>
        </div>
      </div>
      <TableContainer component={Paper}>
        <Table stickyHeader aria-label="sticky table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Size</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {files.map((row: any) => (
              <TableRow
                key={row.name}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell
                  component="th"
                  scope="row"
                  onClick={() => {
                    openFile(row);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {row.kind === "directory" ? (
                      <span className="material-symbols-outlined material-symbols-fill text-yellow-600">
                        folder_open
                      </span>
                    ) : (
                      <span className="material-symbols-outlined material-symbols-fill text-blue-500">
                        description
                      </span>
                    )}
                    {row.kind === "file" ? row.name.split(".txt")[0] : row.name}
                  </div>
                </TableCell>
                <TableCell>
                  {row.kind.charAt(0).toUpperCase() + row.kind.slice(1)}
                </TableCell>
                <TableCell>
                  {row.kind === "file" &&
                    convertContentLength(row.properties.contentLength)}
                </TableCell>
                <TableCell
                  className="cursor-pointer"
                  onClick={() => deleteDialog(row)}
                >
                  <span className="material-symbols-outlined font-extralight">
                    delete_forever
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default FileExplorer;
