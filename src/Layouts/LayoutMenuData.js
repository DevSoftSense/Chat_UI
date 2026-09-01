import React from "react";
import { buildCommunicationMenu } from "./CommunicationMenuData";

const Navdata = () => {
  const menuItems = buildCommunicationMenu();
  return <React.Fragment>{menuItems}</React.Fragment>;
};

export default Navdata;
