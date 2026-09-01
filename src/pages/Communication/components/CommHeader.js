import React from "react";
import Avatar from "./Avatar";
import { currentUser } from "../data/staticData";

const CommHeader = () => (
  <header className="comm-header">
    <div className="comm-search">
      <i className="ri-search-line search-icon"></i>
      <input type="text" placeholder="Search messages, users, groups..." readOnly />
      <span className="search-shortcut">Ctrl + K</span>
    </div>

    <div className="comm-header-actions">
      <div className="status-badge">
        <span className="dot"></span>
        Online
      </div>
      <button type="button" className="header-icon-btn">
        <i className="ri-message-3-line"></i>
      </button>
      <button type="button" className="header-icon-btn">
        <i className="ri-notification-3-line"></i>
        <span className="notif-badge">12</span>
      </button>
      <div className="user-profile-header">
        <Avatar initials={currentUser.initials} color="#2563eb" size={36} />
        <div className="user-info">
          <div className="name">{currentUser.name}</div>
          <div className="role">{currentUser.role}</div>
        </div>
      </div>
    </div>
  </header>
);

export default CommHeader;
