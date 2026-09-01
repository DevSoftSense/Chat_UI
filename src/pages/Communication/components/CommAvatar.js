import React from "react";
import avatar1 from "../../../assets/images/users/avatar-1.jpg";
import avatar2 from "../../../assets/images/users/avatar-2.jpg";
import avatar3 from "../../../assets/images/users/avatar-3.jpg";
import avatar4 from "../../../assets/images/users/avatar-4.jpg";
import avatar5 from "../../../assets/images/users/avatar-5.jpg";
import avatar6 from "../../../assets/images/users/avatar-6.jpg";
import avatar7 from "../../../assets/images/users/avatar-7.jpg";
import avatar8 from "../../../assets/images/users/avatar-8.jpg";

const avatarMap = {
  1: avatar2,
  2: avatar3,
  3: avatar4,
  4: avatar5,
  5: avatar6,
  6: avatar7,
  7: avatar8,
  default: avatar1,
};

const CommAvatar = ({ id, src, size = "xs", className = "" }) => {
  const img = src || avatarMap[id] || avatarMap.default;
  return (
    <div className={`flex-shrink-0 avatar-${size} ${className}`}>
      <img src={img} alt="" className="img-fluid rounded-circle" />
    </div>
  );
};

export default CommAvatar;
