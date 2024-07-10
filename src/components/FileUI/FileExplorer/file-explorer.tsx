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
import { Card, CardContent, IconButton, Typography } from "@mui/material";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import SettingsComponent from "../Settings/settings";
import dayjs from "dayjs";
import SideBar from "../Sidebar/sidebar";
import { File } from "../../../../electron/interfaces/file.interface";

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
  boxShadow: 24,
  p: 4,
};
const FileExplorer: React.FC<Props> = ({ files }) => {
  const [currentDirectory, setCurrentDirectory] = useState<string>(
    (localStorage.getItem("directories") || "").split("/").pop() || ""
  );
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const [directoryModalOpen, setDirectoryModalOpen] = React.useState(false);
  const [folderName, setFolderName] = React.useState("");

  const [settingsModalOpen, setSettingsModalOpen] = React.useState(false);
  const [showOptions, setShowOptions] = useState<boolean>(navigator.onLine);

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
  const handleOpen = () => setDirectoryModalOpen(true);
  const handleClose = () => {
    setFolderName("");
    setDirectoryModalOpen(false);
  };
  useEffect(() => {
    setShowOptions(navigator.onLine);
    setBreadcrumbs(
      (localStorage.getItem("directories") || "").split("/").filter((x) => x)
    );
    window.ipcRenderer.on(InvokeEvent.TryFetch, async (event) => {
      refresh();
    });
    return () => {
      window.ipcRenderer.off(InvokeEvent.TryFetch, () => {});
    };
  }, [files]);

  const refresh = async () => {
    const configuration = getConfigurations();
    let directories = localStorage.getItem("directories") || "";
    await window.ipcRenderer.invoke(
      InvokeEvent.GetFiles,
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
    const configuration = getConfigurations();
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
    const configuration = getConfigurations();
    let directories = localStorage.getItem("directories") || "";

    if (file.kind === "directory") {
      if (directories) {
        directories += "/";
      }
      directories += file.name;
      setCurrentDirectory(file.name);
      localStorage.setItem("directories", directories);
      await window.ipcRenderer.invoke(
        InvokeEvent.GetFiles,
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
    const configuration = getConfigurations();
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
    const configuration = getConfigurations();
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

  function formatDate(date: string): string {
    return dayjs(date).format("DD/MM/YY hh:mm:ss A");
  }

  const getConfigurations = () => localStorage.getItem("configuration");

  function BreadcrumbsComponent({ breadcrumbs }: { breadcrumbs: string[] }) {
    return (
      <div role="presentation">
        <Breadcrumbs aria-label="breadcrumb">
          <Link
            underline="hover"
            color={breadcrumbs.length === 0 ? "textPrimary" : "inherit"}
            onClick={() => {
              localStorage.setItem("directories", "");
              setCurrentDirectory("");
              refresh();
            }}
            key={"home"}
          >
            Home
          </Link>
          {breadcrumbs?.map((dir, index) => {
            return (
              <Link
                underline="hover"
                color={
                  index === breadcrumbs.length - 1 ? "textPrimary" : "inherit"
                }
                onClick={() => {
                  let directories = localStorage.getItem("directories") || "";
                  const dirs = directories.split("/");
                  dirs.splice(index + 1, dirs.length - index - 1);
                  directories = dirs.join("/");
                  setCurrentDirectory(dirs[dirs.length - 1]);
                  localStorage.setItem("directories", directories);
                  refresh();
                }}
              >
                {dir}
              </Link>
            );
          })}
        </Breadcrumbs>
      </div>
    );
  }

  function CreateFolderModal() {
    return (
      <Modal
        open={directoryModalOpen}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
        hideBackdrop={true}
        style={{ backdropFilter: "blur(5px)" }}
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
              inputProps={{
                maxLength: 30,
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

  function NoContentsComponent() {
    return (
      <Card
        variant="outlined"
        className="my-4 flex items-center justify-center"
      >
        <CardContent>
          <Typography
            variant="h5"
            component="h2"
            color="textSecondary"
            gutterBottom
          >
            No files or folders found in this directory.
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Please add some files or folders.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  function RowComponent(row: any, isRestricted: boolean = true) {
    return (
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
          <div className="flex items-center gap-4">
            {row.kind === "directory" ? (
              <span className="material-symbols-outlined material-symbols-fill text-yellow-400 max-w-6 max-h-6">
                folder_open
              </span>
            ) : (
              <span
                className={`${row.name
                  .split(".")?.[1]
                  .toLowerCase()} max-w-6 max-h-6`}
              ></span>
            )}
            {row.kind === "file" ? row.name.split(".txt")?.[0] : row.name}
          </div>
        </TableCell>
        <TableCell>
          {row.kind.charAt(0).toUpperCase() + row.kind.slice(1)}
        </TableCell>
        <TableCell>
          {row.kind === "file" &&
            convertContentLength(row.properties.contentLength)}
        </TableCell>
        <TableCell>
          {formatDate(row.properties.lastModified || row.properties.createdOn)}
        </TableCell>
        <TableCell className="cursor-pointer" onClick={() => deleteDialog(row)}>
          <span className="material-symbols-outlined font-extralight">
            delete
          </span>
        </TableCell>
      </TableRow>
    );
  }
  return (
    <div>
      <SettingsComponent
        open={settingsModalOpen}
        onClose={() => {
          setSettingsModalOpen(false);
        }}
      />
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
      <div className="flex my-3 sticky top-0 px-2 py-4 bg-white z-10 shadow-md">
        <div className="flex items-center justify-center">
          {currentDirectory && (
            <IconButton
              className="material-symbols-outlined  cursor-pointer"
              onClick={() => {
                goBack();
              }}
              disabled={!showOptions}
            >
              chevron_left
            </IconButton>
          )}
          <BreadcrumbsComponent breadcrumbs={breadcrumbs} />
        </div>
        <div className="ml-auto flex justify-end gap-3">
          <Button
            variant="outlined"
            className="new-folder flex items-center justify-center gap-2 cursor-pointer"
            onClick={handleOpen}
            disabled={!showOptions}
          >
            <span className="material-symbols-outlined">create_new_folder</span>
            Add Folder
          </Button>
          <Button
            variant="contained"
            className="flex items-center justify-center gap-2 cursor-pointer"
            onClick={uploadFile}
            disabled={!showOptions}
          >
            <span className="material-symbols-outlined">upload_file</span>
            Upload File
          </Button>
          <IconButton
            onClick={handleMenuClick}
            className="flex-1"
            disabled={!showOptions}
            aria-label="more"
            id="long-button"
            aria-controls={open ? "long-menu" : undefined}
            aria-expanded={open ? "true" : undefined}
            aria-haspopup="true"
          >
            <span className="material-symbols-outlined">more_vert</span>
          </IconButton>
          <Menu
            id="long-menu"
            MenuListProps={{
              "aria-labelledby": "long-button",
            }}
            anchorEl={anchorEl}
            open={open}
            onClose={() => {
              setAnchorEl(null);
            }}
          >
            <MenuItem
              onClick={() => {
                localStorage.clear();
                window.location.reload();
                setAnchorEl(null);
              }}
              className="flex items-center gap-2"
            >
              <span className="material-symbols-outlined">mop</span>
              Clear
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSettingsModalOpen(true);
                setAnchorEl(null);
              }}
              className="flex items-center gap-2"
            >
              <span className="material-symbols-outlined">settings</span>
              Configure
            </MenuItem>
          </Menu>
        </div>
      </div>
      <div className="flex flex-row">
        <SideBar files={files} openFile={openFile} />
        <div className="grow pl-3">
          {files.length == 0 ? (
            NoContentsComponent()
          ) : (
            <TableContainer
              component={Paper}
              sx={{ maxHeight: "calc(100vh - 7rem)" }}
              className="scrollbar-hide"
            >
              <Table stickyHeader aria-label="sticky table">
                <TableHead className="sticky top-0">
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Last Modified</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {files.map((row: any) => RowComponent(row))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;
