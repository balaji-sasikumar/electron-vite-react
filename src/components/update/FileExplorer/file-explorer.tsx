import React, { useState } from "react";
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
  const [currentDirectory, setCurrentDirectory] = useState<string>("");
  const [open, setOpen] = React.useState(false);
  const [folderName, setFolderName] = React.useState("");
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setFolderName("");
    setOpen(false);
  };
  const goBack = async () => {
    const configuration = localStorage.getItem("configuration");
    let directories = localStorage.getItem("directories") || "";
    const dirs = directories.split("/");
    dirs.pop();
    directories = dirs.join("/");
    setCurrentDirectory(dirs[dirs.length - 1]);
    localStorage.setItem("directories", directories);
    await window.ipcRenderer.invoke("get-file", configuration, directories);
  };

  const createFolder = async () => {
    const configuration = localStorage.getItem("configuration");
    let directories = localStorage.getItem("directories") || "";
    await window.ipcRenderer.invoke(
      "create-directory",
      configuration,
      directories,
      folderName
    );
    await window.ipcRenderer.invoke("get-file", configuration, directories);
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
      await window.ipcRenderer.invoke("get-file", configuration, directories);
      return;
    }

    await window.ipcRenderer.invoke(
      "open-file",
      file,
      configuration,
      directories
    );
  };
  const deleteFile = async (file: any) => {
    const configuration = localStorage.getItem("configuration");
    let directories = localStorage.getItem("directories") || "";
    let directoryPath = directories;
    if (directoryPath) {
      directoryPath += "/";
    }
    directoryPath += file.name;
    console.log(file);
    if (file.kind === "directory") {
      await window.ipcRenderer.invoke(
        "delete-directory",
        configuration,
        directoryPath
      );
    } else {
      await window.ipcRenderer.invoke(
        "delete-file",
        configuration,
        directories,
        file.name
      );
    }
    await window.ipcRenderer.invoke("get-file", configuration, directories);
  };

  const uploadFile = async () => {
    const configuration = localStorage.getItem("configuration");
    let directories = localStorage.getItem("directories") || "";
    await window.ipcRenderer.invoke(
      "upload-from-pc",
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
  return (
    <>
      <div>
        <Modal
          open={open}
          onClose={handleClose}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={style}>
            <div className="flex flex-col gap-4">
              <TextField
                id="outlined-basic"
                label="Enter Folder Name"
                variant="outlined"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
              <Button variant="outlined" onClick={createFolder}>
                OK
              </Button>
              <Button variant="outlined" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </Box>
        </Modal>
      </div>
      <div className="top-bar">
        <span
          className="material-symbols-outlined  cursor-pointer"
          onClick={() => {
            goBack();
          }}
        >
          chevron_left
        </span>
        <span className="folder">{currentDirectory || "Home"}</span>
        <div
          className="new-folder flex items-center justify-center gap-2 cursor-pointer"
          onClick={handleOpen}
        >
          <span className="material-symbols-outlined">create_new_folder</span>
          Add Folder
        </div>
        <div
          className="upload-file flex items-center justify-center gap-2 cursor-pointer"
          onClick={uploadFile}
        >
          <span className="material-symbols-outlined">upload_file</span>
          Upload File
        </div>
      </div>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 900 }} stickyHeader aria-label="sticky table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Type</TableCell>
              <TableCell align="right">Size</TableCell>
              <TableCell align="right"></TableCell>
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
                  {row.name}
                </TableCell>
                <TableCell align="right">{row.kind}</TableCell>
                <TableCell align="right">
                  {row.kind === "file" &&
                    convertContentLength(row.properties.contentLength)}
                </TableCell>
                <TableCell
                  align="right"
                  className="cursor-pointer"
                  onClick={() => deleteFile(row)}
                >
                  <span className="material-symbols-outlined">delete</span>
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
