import React from "react";
import CommSidebar from "./CommSidebar";
import CommHeader from "./CommHeader";
import "../styles/communication.scss";

const CommunicationLayout = ({ activeMenu, rightPanel, children, fullWidth = false }) => {
  document.title = "Chat Module | SoftOnCloud";

  return (
    <div className="comm-module">
      <CommSidebar activeMenu={activeMenu} />
      <div className="comm-main-wrapper">
        <CommHeader />
        <div className="comm-body">
          <div className={`comm-content ${fullWidth ? "p-0" : ""}`}>{children}</div>
          {rightPanel && <aside className="comm-right-panel">{rightPanel}</aside>}
        </div>
        <footer className="comm-footer">
          © 2025 SoftOnCloud. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default CommunicationLayout;
