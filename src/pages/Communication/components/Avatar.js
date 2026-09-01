import React from "react";

const Avatar = ({ initials, color = "#2563eb", size = 36, className = "" }) => (
  <div
    className={`comm-avatar ${className}`}
    style={{
      width: size,
      height: size,
      minWidth: size,
      backgroundColor: color,
      fontSize: size * 0.35,
    }}
  >
    {initials}
  </div>
);

export default Avatar;
