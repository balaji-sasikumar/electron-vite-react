import { TableRow, TableCell } from "@mui/material";
import CustomMenu from "../CustomMenu/custom-menu";
import dayjs from "dayjs";

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
function RowComponent(row: any, fileOptionMenuItems: any, openFile: any) {
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
      <TableCell className="cursor-pointer">
        <CustomMenu
          menuItems={fileOptionMenuItems.map((item: any) => ({
            ...item,
            params: [row],
          }))}
          menuButtonIcon="more_horiz"
        />
      </TableCell>
    </TableRow>
  );
}

export default RowComponent;
