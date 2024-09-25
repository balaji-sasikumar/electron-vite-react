import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { TreeViewBaseItem } from "@mui/x-tree-view/models";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { InvokeEvent } from "@/enums/invoke-event.enum";
import { File } from "../../../../electron/interfaces/file.interface";
import "./sidebar.css";
import { TreeItem2, TreeItem2Props } from "@mui/x-tree-view";
interface Props {
  files: File[];
  openFile: (file: File) => void;
  width: number;
}

const Sidebar: React.FC<Props> = ({ files, openFile, width }) => {
  const [directoryTree, setDirectoryTree] = useState<TreeViewBaseItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const findExpandedItems = (items: any[]): string[] => {
    let expanded: string[] = [];

    for (const item of items) {
      if (item.children.length > 0) {
        expanded.push(item.id);
        expanded = [...expanded, ...findExpandedItems(item.children)];
      }
    }
    return expanded;
  };

  const findLastSelectedItem = (items: any[]): string => {
    let directories = localStorage.getItem("directories") || "";
    const dirs = directories.split("/");
    let currentDir = dirs[dirs.length - 1];
    let selected: string = "";
    for (const item of items) {
      if (item.label === currentDir) {
        selected = item.id;
        break;
      }

      if (item.children.length > 0) {
        selected = findLastSelectedItem(item.children);
        if (selected !== "") {
          break;
        }
      }
    }
    return selected;
  };

  const getSelectedDirectory = (id: string, items: any[]): any => {
    for (const item of items) {
      if (item.id === id) {
        return item;
      }

      if (item.children.length > 0) {
        const selectedDirectory = getSelectedDirectory(id, item.children);
        if (selectedDirectory) {
          return selectedDirectory;
        }
      }
    }
  };
  useEffect(() => {
    const configuration = localStorage.getItem("configuration");
    if (configuration === null) {
      setDirectoryTree([]);
      return;
    }
    const directories = localStorage.getItem("directories");
    (async () => {
      await window.ipcRenderer.invoke(
        InvokeEvent.GetDirectoryTree,
        localStorage.getItem("configuration"),
        directories
      );
    })();

    window.ipcRenderer.on(
      InvokeEvent.GetDirectoryTreeResponse,
      (event, tree) => {
        setDirectoryTree(tree);
      }
    );
    return () => {
      window.ipcRenderer.off(InvokeEvent.GetDirectoryTreeResponse, () => {});
    };
  }, [files]);

  useEffect(() => {
    setSelectedItem(findLastSelectedItem(directoryTree));
    setExpandedItems(findExpandedItems(directoryTree));
  }, [directoryTree]);

  const folderIcon = () => (
    <div className="flex items-center justify-center mr-8">
      <span className="material-symbols-outlined">keyboard_arrow_right</span>
      <span className="material-symbols-outlined material-symbols-fill text-[#3795F2]">
        folder
      </span>
    </div>
  );

  const folderOpenIcon = () => (
    <div className="flex items-center justify-center mr-8">
      <span className="material-symbols-outlined">keyboard_arrow_down</span>
      <span className="material-symbols-outlined material-symbols-fill text-[#3795F2]">
        folder_open
      </span>
    </div>
  );
  const CustomTreeItem = React.forwardRef(
    (props: TreeItem2Props, ref: React.Ref<HTMLLIElement>) => (
      <TreeItem2
        title={props.label as string}
        ref={ref}
        {...props}
        slotProps={{
          label: {
            id: `${props.itemId}-label`,
          },
        }}
      />
    )
  );
  return (
    <Box
      sx={{ height: "calc(100vh - 7rem)", width: width }}
      className="py-4 overflow-y-scroll shadow-md scrollbar-thin custom-tree bg-[#E8F6FF] px-4 pl-[1.5rem]"
    >
      <RichTreeView
        items={directoryTree}
        expandedItems={expandedItems}
        slots={{
          endIcon: folderIcon,
          collapseIcon: folderOpenIcon,
          item: CustomTreeItem,
        }}
        className="py-2 "
        onSelectedItemsChange={(event, selectedItems) => {
          if (selectedItems !== null && selectedItems.length > 0) {
            setExpandedItems([...expandedItems, selectedItems]);
            const directory: any = getSelectedDirectory(
              selectedItems as string,
              directoryTree
            );
            let directories = localStorage.getItem("directories") || "";
            const dirs = directories.split("/");
            dirs.splice(directory.level, dirs.length);
            directories = dirs.join("/");
            localStorage.setItem("directories", directories);
            openFile({
              kind: "directory",
              name: directory.label,
              properties: {},
              fileId: directory.id,
            });
          }
        }}
        selectedItems={selectedItem}
        itemChildrenIndentation={24}
      />
    </Box>
  );
};

export default Sidebar;
