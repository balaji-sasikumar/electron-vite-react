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
  const [accountName, setAccountName] = useState<string>("");
  const [accountKey, setAccountKey] = useState<string>("");
  const [shareName, setShareName] = useState<string>("");
  const [privateKey, setPrivateKey] = useState<string>("");
  const [tempPath, setTempPath] = useState<string>("D:/");
  const [readOnly, setReadOnly] = useState<boolean>(false);
  useEffect(() => {
    const configuration = localStorage.getItem("configuration");
    if (configuration) {
      const config = JSON.parse(configuration);
      setAccountName(config.accountName);
      setAccountKey(config.accountKey);
      setShareName(config.shareName);
      setPrivateKey(config.privateKey);
      setTempPath(config.tempPath);
      setReadOnly(true);
    } else {
      setAccountName("");
      setAccountKey("");
      setShareName("");
      setPrivateKey("");
      setTempPath("D:/");
    }
  }, [open]);
  const handleSave = () => {
    const storageData = {
      accountName,
      accountKey,
      shareName,
      privateKey,
      tempPath,
    };
    localStorage.setItem("configuration", JSON.stringify(storageData));
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
            label="Enter Account Name"
            variant="outlined"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
            disabled={readOnly}
            inputProps={{
              maxLength: 60,
            }}
          />
          <TextField
            id="outlined-basic"
            label="Enter Account Key"
            variant="outlined"
            value={accountKey}
            onChange={(e) => setAccountKey(e.target.value)}
            required
            disabled={readOnly}
            type="password"
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
              maxLength: 60,
            }}
          />
          <TextField
            id="outlined-basic"
            label="Enter Private Key"
            variant="outlined"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            required
            disabled={readOnly}
            type="password"
            inputProps={{
              maxLength: 60,
            }}
          />
          <TextField
            id="outlined-basic"
            label="Enter Temp Path"
            variant="outlined"
            value={tempPath}
            onChange={(e) => setTempPath(e.target.value)}
            required
            disabled={readOnly}
          />
          <div className="flex flex-row gap-3">
            {!readOnly && (
              <Button
                variant="contained"
                className="flex items-center justify-center gap-2 cursor-pointer"
                onClick={handleSave}
                disabled={
                  !accountName ||
                  !accountKey ||
                  !shareName ||
                  !privateKey ||
                  !tempPath
                }
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
