import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

export default function AlertDialog({
  open,
  onClose,
  onOk,
  title,
  message,
  showCancel = true,
  okText = "Ok",
  cancelText = "Cancel",
}: {
  open: boolean;
  onClose?: () => void;
  onOk: () => void;
  title: string;
  message: string;
  showCancel?: boolean;
  okText?: string;
  cancelText?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        {showCancel && <Button onClick={onClose}>{cancelText}</Button>}
        <Button onClick={onOk} autoFocus>
          {okText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
