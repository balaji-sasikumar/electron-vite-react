import React, { useState } from "react";
import { IconButton, Menu, MenuItem } from "@mui/material";

type MenuItemType = {
  icon: string;
  label: string;
  onClick: (...args: any[]) => void;
  params?: any[];
};

type Props = {
  menuItems: MenuItemType[];
  disabled?: boolean;
  menuButtonIcon: string;
};

const CustomMenu: React.FC<Props> = ({
  menuItems,
  disabled,
  menuButtonIcon,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <div>
      <IconButton
        onClick={handleClick}
        className="flex-1"
        disabled={disabled}
        aria-label="more"
        id="long-button"
        aria-controls={open ? "long-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="true"
      >
        <span className="material-symbols-outlined">{menuButtonIcon}</span>
      </IconButton>
      <Menu
        id="long-menu"
        MenuListProps={{
          "aria-labelledby": "long-button",
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        {menuItems.map((item, index) => (
          <MenuItem
            key={index}
            onClick={() => {
              item.onClick(...(item.params || []));
              handleClose();
            }}
            className="flex items-center gap-2"
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
};

export default CustomMenu;
