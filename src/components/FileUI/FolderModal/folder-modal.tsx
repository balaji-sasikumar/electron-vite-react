import React from "react";
import { Modal, Box, TextField, Button } from "@mui/material";

type Props = {
  open: boolean;
  onClose: () => void;
  folderName: string;
  setFolderName: (folderName: string) => void;
  onAction: () => void;
  actionLabel: string;
};

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
const FolderModal: React.FC<Props> = ({
  open,
  onClose,
  folderName,
  setFolderName,
  onAction,
  actionLabel,
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
      hideBackdrop={true}
      style={{ backdropFilter: "blur(5px)" }}
    >
      <Box sx={{ ...style, width: 400 }}>
        <div className="flex flex-col gap-3">
          <TextField
            id="outlined-basic"
            label="Enter Folder Name"
            variant="outlined"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === "Enter") {
                onAction();
              }
            }}
            inputProps={{
              maxLength: 30,
            }}
          />
          <div className="flex flex-row gap-3">
            <Button variant="contained" onClick={onAction} className="flex-1">
              {actionLabel}
            </Button>
            <Button variant="outlined" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Box>
    </Modal>
  );
};

export default FolderModal;
