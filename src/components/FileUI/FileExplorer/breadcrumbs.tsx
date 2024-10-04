import { Breadcrumbs, Button } from "@mui/material";

function BreadcrumbsComponent({
  breadcrumbs,
  setCurrentDirectory,
  refresh,
}: {
  breadcrumbs: any[];
  setCurrentDirectory: (directory: string) => void;
  refresh: () => void;
}) {
  const handleClick = (index: number) => {
    let directories = localStorage.getItem("directories") || "";
    const dirs = directories.split("/");
    dirs.splice(index + 1, dirs.length - index - 1);
    directories = dirs.join("/");
    setCurrentDirectory(dirs[dirs.length - 1]);
    localStorage.setItem("directories", directories);
    refresh();
  };

  const breadCrumbStyle = {
    textTransform: "none",
    "&:hover": { textDecoration: "underline", background: "none" },
    padding: 0,
    minWidth: "unset",
    "&:focus": { outline: "none", boxShadow: "none" },
  };

  return (
    <div className="py-4">
      <Breadcrumbs aria-label="breadcrumb">
        <Button
          variant="text"
          onClick={() => {
            localStorage.setItem("directories", "");
            setCurrentDirectory("");
            refresh();
          }}
          key={"home"}
          className={
            "cursor-pointer" + (breadcrumbs.length === 0 ? " !font-bold" : "")
          }
          sx={{
            color: breadcrumbs.length === 0 ? "text.primary" : "inherit",
            ...breadCrumbStyle,
          }}
          disableFocusRipple
          disableRipple
        >
          Home
        </Button>
        {breadcrumbs?.map((dir, index) => {
          return (
            <Button
              variant="text"
              onClick={() => handleClick(index)}
              key={index}
              className={
                "cursor-pointer" +
                (index === breadcrumbs.length - 1 ? " !font-bold" : "")
              }
              sx={{
                color:
                  index === breadcrumbs.length - 1 ? "text.primary" : "inherit",
                ...breadCrumbStyle,
              }}
              disableFocusRipple
              disableRipple
            >
              {dir}
            </Button>
          );
        })}
      </Breadcrumbs>
    </div>
  );
}

export default BreadcrumbsComponent;
