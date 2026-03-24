import * as React from "react";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import StoreInventory from "../components/inventory/StoreInventory";
import CanteenInventory from "../components/inventory/CanteenInventory";

function CustomTabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
      sx={{ width: "100%" }}
    >
      {value === index && (
        <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, width: "100%" }}>{children}</Box>
      )}
    </Box>
  );
}

CustomTabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return { id: `simple-tab-${index}`, "aria-controls": `simple-tabpanel-${index}` };
}

export default function BasicTabs() {
  const [value, setValue] = React.useState(0);

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={value}
          onChange={(e, nv) => setValue(nv)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="inventory tabs"
        >
          <Tab className="text-primary! font-bold!" label="Store Inventory" {...a11yProps(0)} />
          <Tab className="text-primary! font-bold!" label="Canteen Inventory" {...a11yProps(1)} />
        </Tabs>
      </Box>

      <CustomTabPanel value={value} index={0}>
        <StoreInventory />
      </CustomTabPanel>

      <CustomTabPanel value={value} index={1}>
        <CanteenInventory />
      </CustomTabPanel>
    </Box>
  );
}
