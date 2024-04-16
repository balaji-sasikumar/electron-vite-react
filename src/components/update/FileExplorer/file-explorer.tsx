import React, { useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
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

const FileExplorer: React.FC<Props> = ({ files }) => {
  const [currentDirectory, setCurrentDirectory] = useState<string>("");
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

  const openFile = async (file: any) => {
    const configuration = localStorage.getItem("configuration");
    if (file.kind === "directory") {
      let directories = localStorage.getItem("directories") || "";
      if (directories) {
        directories += "/";
      }
      directories += file.name;
      setCurrentDirectory(file.name);
      localStorage.setItem("directories", directories);
      await window.ipcRenderer.invoke("get-file", configuration, directories);
      return;
    }

    await window.ipcRenderer.invoke("open-file", file, configuration);
  };
  const deleteFile = async (file: any) => {
    const configuration = localStorage.getItem("configuration");
    let directories = localStorage.getItem("directories") || "";
    await window.ipcRenderer.invoke(
      "delete-file",
      configuration,
      directories,
      file.name
    );
    await window.ipcRenderer.invoke("get-file", configuration, directories);
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
      <div className="top-bar cursor-pointer">
        <span
          className="material-symbols-outlined"
          onClick={() => {
            goBack();
          }}
        >
          chevron_left
        </span>
        <span className="folder">{currentDirectory || "Home"}</span>
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
