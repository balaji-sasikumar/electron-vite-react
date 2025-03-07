import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Modal from "@mui/material/Modal";
import "./settings.css";
const style = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 600,
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
};

type SettingsComponentProps = {
  open: boolean;
  onClose?: () => void;
  refresh: () => void;
};

const SettingsComponent: React.FC<SettingsComponentProps> = ({
  open,
  onClose,
  refresh,
}) => {
  const [connectionString, setConnectionString] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [accountKey, setAccountKey] = useState<string>("");
  const [shareName, setShareName] = useState<string>("");
  const [readOnly, setReadOnly] = useState<boolean>(false);

  useEffect(() => {
    const configuration = localStorage.getItem("configuration");
    const preConnectionString = localStorage.getItem("connectionString");
    if (configuration && preConnectionString) {
      const config = JSON.parse(configuration);
      setConnectionString(preConnectionString);
      setAccountName(config.accountName);
      setAccountKey(config.accountKey);
      setShareName(config.shareName);
      setReadOnly(true);
    } else {
      setConnectionString("");
      setAccountName("");
      setAccountKey("");
      setShareName("");
      setReadOnly(false);
    }
  }, [open]);
  const handleSave = () => {
    const storageData = {
      accountName,
      accountKey,
      shareName,
    };
    localStorage.setItem("configuration", JSON.stringify(storageData));
    localStorage.setItem("directories", "");
    localStorage.setItem("connectionString", connectionString);
    onClose && onClose();
    refresh();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
      hideBackdrop={true}
      style={{ backdropFilter: "blur(5px)" }}
    >
      <Box sx={style}>
        <div className="flex flex-col gap-3">
          <TextField
            id="outlined-basic"
            label="Enter Connection String"
            variant="outlined"
            value={connectionString}
            onChange={(e) => {
              setConnectionString(e.target.value);
              const regex = /AccountName=(.*?);AccountKey=(.*?);/g;
              const match = regex.exec(e.target.value);
              if (match) {
                setAccountName(match[1]);
                setAccountKey(match[2]);
              } else {
                setAccountName("");
                setAccountKey("");
              }
            }}
            required
            disabled={readOnly}
            type="text"
          />
          <TextField
            id="outlined-basic"
            label="Enter Share Name"
            variant="outlined"
            value={shareName}
            onChange={(e) => setShareName(e.target.value)}
            required
            disabled={readOnly}
            inputProps={{
              maxLength: 200,
            }}
            maxRows={4}
          />
          <div className="flex flex-row gap-3">
            {!readOnly && (
              <Button
                variant="contained"
                className="flex items-center justify-center gap-2 cursor-pointer"
                onClick={handleSave}
                disabled={!accountName || !accountKey || !shareName}
              >
                Save
              </Button>
            )}
            <Button
              variant="outlined"
              className="flex items-center justify-center gap-2 cursor-pointer"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Box>
    </Modal>
  );
};

export default SettingsComponent;
