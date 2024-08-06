import React, { useEffect, useRef, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import "./file-explorer.css";
import { InvokeEvent } from "@/enums/invoke-event.enum";
import AlertDialog from "../Dialog/dialog";
import { IconButton } from "@mui/material";
import SettingsComponent from "../Settings/settings";
import SideBar from "../Sidebar/sidebar";
import { File } from "../../../../electron/interfaces/file.interface";
import CustomMenu from "../CustomMenu/custom-menu";
import FolderModal from "../FolderModal/folder-modal";
import NoContentsComponent from "./no-contents";
import RowComponent from "./row-component";
import BreadcrumbsComponent from "./breadcrumbs";

interface Props {
  files: File[];
  showSnackBar: (severity: any, message: string) => void;
}

const FileExplorer: React.FC<Props> = ({ files, showSnackBar }) => {
  const [currentDirectory, setCurrentDirectory] = useState<string>(
    (localStorage.getItem("directories") || "").split("/").pop() || ""
  );
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);

  const [createDirModalOpen, setCreateDirModalOpen] = React.useState(false);
  const [folderName, setFolderName] = React.useState("");
  const handleCreateDirModalClose = () => {
    setFolderName("");
    setCreateDirModalOpen(false);
  };

  const [renameModalOpen, setRenameModalOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<File>({} as File);

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

  const [width, setWidth] = useState<number>(250);
  const resizerRef = useRef<HTMLSpanElement | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(width);

  const handleMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    startX.current = event.clientX;
    startWidth.current = width;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseUp = (event: MouseEvent) => {
    event.preventDefault();
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent) => {
    const newWidth = startWidth.current + (event.clientX - startX.current);
    setWidth(Math.max(250, Math.min(400, newWidth)));
  };

  const configureMenuItems = [
    {
      icon: "mop",
      label: "Clear",
      onClick: () => {
        localStorage.clear();
        refresh();
      },
    },
    {
      icon: "settings",
      label: "Configure",
      onClick: () => {
        setSettingsModalOpen(true);
      },
    },
  ];

  const fileOptionMenuItems = [
    {
      icon: "delete",
      label: "Delete",
      onClick: (file: any) => {
        deleteDialog(file);
      },
    },
    {
      icon: "folder_managed",
      label: "Rename",
      onClick: (file: any) => {
        setSelectedRow(file);
        setFolderName(
          file.kind === "directory" ? file.name : file.name.split(".")[0]
        );
        setRenameModalOpen(true);
      },
    },
  ];

  useEffect(() => {
    setShowOptions(navigator.onLine);
    if (localStorage.getItem("showConfig") !== "true") setShowOptions(false);
    setBreadcrumbs(
      (localStorage.getItem("directories") || "").split("/").filter((x) => x)
    );
    window.ipcRenderer.on(InvokeEvent.TryFetch, async () => {
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
    if (folderName === "") {
      return;
    }
    await window.ipcRenderer.invoke(
      InvokeEvent.CreateDirectory,
      configuration,
      directories,
      folderName
    );
    handleCreateDirModalClose();
  };

  const renameFolder = async (file: any, newName: string) => {
    const configuration = getConfigurations();
    let directories = localStorage.getItem("directories") || "";
    await window.ipcRenderer.invoke(
      InvokeEvent.RenameFolder,
      configuration,
      directories == ""
        ? directories + file.name
        : directories + "/" + file.name,
      directories == "" ? directories + newName : directories + "/" + newName
    );
  };

  const renameFile = async (file: any, newName: string) => {
    const configuration = getConfigurations();
    let directories = localStorage.getItem("directories") || "";
    await window.ipcRenderer.invoke(
      InvokeEvent.RenameFile,
      configuration,
      directories,
      file.name,
      directories == "" ? directories + newName : directories + "/" + newName
    );
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
    setTitle(`Delete ${file.kind === "file" ? "File" : "Folder"}`);
    setMessage(
      `Are you sure you want to delete ${
        file.kind === "file" ? "file" : "folder"
      } ${file.name.split(".txt")[0]}?`
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

  const getConfigurations = () => localStorage.getItem("configuration");

  return (
    <div>
      <SettingsComponent
        open={settingsModalOpen}
        onClose={() => {
          setSettingsModalOpen(false);
        }}
        refresh={refresh}
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
      <FolderModal
        open={createDirModalOpen}
        onClose={handleCreateDirModalClose}
        folderName={folderName}
        setFolderName={setFolderName}
        onAction={createFolder}
        actionLabel="Create Folder"
        textFieldLabel="Enter Folder Name"
      />

      <FolderModal
        open={renameModalOpen}
        onClose={() => {
          setRenameModalOpen(false);
          setFolderName("");
        }}
        folderName={folderName}
        setFolderName={setFolderName}
        onAction={() => {
          if (selectedRow.kind === "directory") {
            renameFolder(selectedRow, folderName);
          } else {
            if (folderName.includes(".")) {
              showSnackBar("error", "File name cannot contain a dot");
            } else {
              const extension = selectedRow.name.split(".").slice(1).join(".");
              renameFile(selectedRow, folderName + "." + extension);
            }
          }
          setRenameModalOpen(false);
          setFolderName("");
        }}
        actionLabel={`Rename ${
          selectedRow.kind === "directory" ? "Folder" : "File"
        }`}
        textFieldLabel={`Enter ${
          selectedRow.kind === "directory" ? "Folder" : "File"
        } Name`}
      />

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
          <BreadcrumbsComponent
            breadcrumbs={breadcrumbs}
            refresh={refresh}
            setCurrentDirectory={setCurrentDirectory}
          />
        </div>
        <div className="ml-auto flex justify-end gap-3">
          <Button
            variant="outlined"
            className="new-folder flex items-center justify-center gap-2 cursor-pointer"
            onClick={() => setCreateDirModalOpen(true)}
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
          <CustomMenu
            menuItems={configureMenuItems}
            menuButtonIcon="more_vert"
            disabled={!showOptions}
          />
        </div>
      </div>
      <div className="flex flex-row">
        <SideBar files={files} openFile={openFile} width={width} />
        <span
          role="presentation"
          className="w-[11px] m-0 border-l-[5px] cursor-ew-resize resizer"
          ref={resizerRef}
          onMouseDown={handleMouseDown}
        ></span>
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
                <TableHead className="sticky top-0 z-50">
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Last Modified</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {files.map((row: any) =>
                    RowComponent(row, fileOptionMenuItems, openFile)
                  )}
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
