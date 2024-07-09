import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { TreeViewBaseItem, TreeViewItemId } from "@mui/x-tree-view/models";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import { List, ListItem } from "@mui/material";

interface File {
  kind: string;
  name: string;
  properties: any;
  fileId: string;
}

interface Props {
  files: File[];
  openFile: (file: File) => void;
}

// const Sidebar: React.FC<Props> = ({ files, openFile }) => {
//   const [directories, setDirectories] = useState<File[]>([]);
//   useEffect(() => {
//     const directories = files.filter((file) => file.kind === "directory");
//     setDirectories(directories);
//   }, [files]);

//   const list = () => (
//     <div className="p-2">
//       <Box sx={{ minHeight: 352, minWidth: 250 }}>
//         <SimpleTreeView>
//           {directories.map((directory, index) => (
//             <List key={index}>
//               <ListItem
//                 className="flex items-center content-center gap-2 text-sm"
//                 onClick={() => openFile(directory)}
//               >
//                 <span className="material-symbols-outlined material-symbols-fill text-yellow-400 max-w-6 max-h-6">
//                   folder_open
//                 </span>
//                 {directory.name}
//               </ListItem>
//             </List>
//           ))}
//         </SimpleTreeView>
//       </Box>
//     </div>
//   );

//   return <div className="w-64">{list()}</div>;
// };

// export default Sidebar;

const Sidebar: React.FC<Props> = ({ files, openFile }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [directoryTree, setDirectoryTree] = useState<TreeViewBaseItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  useEffect(() => {
    const directories = localStorage.getItem("directories");
    if (!directories) {
      const newTree = convertToDirectoryTree(files);
      console.log(newTree, "Converted to directory tree");
      setDirectoryTree(newTree);
    } else {
      const updatedTree = appendToDirectoryTree(selected, directoryTree, files);
      console.log(updatedTree, "Appended to directory tree");
      setDirectoryTree(updatedTree);
    }
  }, [files]);

  useEffect(() => {
    console.log(directoryTree, "directoryTree useeffect");
  }, [directoryTree]);

  const convertToDirectoryTree = (files: File[]) => {
    const directories = files.filter((file) => file.kind === "directory");
    const directoryTree = directories.map((directory) => ({
      id: directory.fileId,
      label: directory.name,
      children: [],
    }));
    return directoryTree;
  };

  const appendToDirectoryTree = (
    selected: string | null,
    directoryTree: TreeViewBaseItem[],
    files: File[]
  ) => {
    const childDirectories = files.filter((file) => file.kind === "directory");

    const appendChildren = (tree: TreeViewBaseItem[]): TreeViewBaseItem[] => {
      return tree.map((directory) => {
        if (directory.id === selected) {
          return {
            ...directory,
            children: [
              ...(directory.children || []),
              ...childDirectories.map((dir) => ({
                id: dir.fileId,
                label: dir.name,
                children: [],
              })),
            ],
          };
        } else if (directory.children && directory.children.length > 0) {
          return {
            ...directory,
            children: appendChildren(directory.children),
          };
        } else {
          return { ...directory, children: directory.children || [] };
        }
      });
    };

    return appendChildren(directoryTree);
  };

  const folderIcon = () => (
    <span className="material-symbols-outlined material-symbols-fill text-yellow-400 max-w-6 max-h-6">
      folder_open
    </span>
  );

  return (
    <Box sx={{ minHeight: 352, minWidth: 250 }}>
      <RichTreeView
        items={directoryTree}
        expandedItems={expandedItems}
        slots={{
          expandIcon: folderIcon,
          endIcon: folderIcon,
          collapseIcon: folderIcon,
        }}
        onSelectedItemsChange={(event, selectedItems) => {
          setSelected(selectedItems);
          setExpandedItems([...expandedItems, selectedItems]);
          const directory: any = files.find(
            (file) => file.fileId === selectedItems
          );
          openFile({
            kind: "directory",
            name: directory.name,
            properties: {},
            fileId: directory.fileId,
          });
        }}
      />
      {/* <SimpleTreeView
        slots={{
          expandIcon: folderIcon,
          endIcon: folderIcon,
        }}
        expandedItems={expandedItems}
      >
        {directoryTree.map((directory, index) => (
          <TreeItem
            key={index}
            label={directory.label}
            itemId={directory.id}
            onClick={() => {
              setSelected(directory.id);
              setExpandedItems([...expandedItems, directory.id]);
              openFile({
                kind: "directory",
                name: directory.label,
                properties: {},
                fileId: directory.id,
              });
            }}
          ></TreeItem>
        ))}
      </SimpleTreeView> */}
    </Box>
  );
};

export default Sidebar;
