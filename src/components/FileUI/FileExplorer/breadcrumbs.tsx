import { Breadcrumbs, Link } from "@mui/material";

function BreadcrumbsComponent({
  breadcrumbs,
  setCurrentDirectory,
  refresh,
}: {
  breadcrumbs: any[];
  setCurrentDirectory: (directory: string) => void;
  refresh: () => void;
}) {
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
          className="cursor-pointer"
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
              key={index}
              className="cursor-pointer"
            >
              {dir}
            </Link>
          );
        })}
      </Breadcrumbs>
    </div>
  );
}

export default BreadcrumbsComponent;
