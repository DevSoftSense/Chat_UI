import React from "react";
import { Link, useLocation } from "react-router-dom";
import { navItems } from "../data/staticData";

const CommSidebar = ({ activeMenu }) => {
  const location = useLocation();

  const isActive = (item) => {
    if (activeMenu) return item.id === activeMenu;
    return location.pathname === item.path;
  };

  return (
    <aside className="comm-sidebar">
      <div className="comm-brand">
        <Link to="/communication/dashboard" className="brand-logo">
          <i className="ri-cloud-line"></i>
          SoftOnCloud
        </Link>
        <div className="brand-sub">Chat Module</div>
      </div>

      <nav className="comm-nav">
        {navItems.filter((n) => !["search", "starred", "archive", "management"].includes(n.id) || ["search", "starred", "archive"].includes(n.id)).slice(0, 10).map((item) => (
          <Link
            key={item.id}
            to={item.path}
            className={`nav-link-item ${isActive(item) ? "active" : ""}`}
          >
            <i className={item.icon}></i>
            <span>{item.label}</span>
            {item.badge && (
              <span className={`badge-count badge bg-${item.badgeColor || "primary"}`}>
                {item.badge}
              </span>
            )}
          </Link>
        ))}
        <Link
          to="/communication/management"
          className={`nav-link-item ${isActive({ id: "management", path: "/communication/management" }) ? "active" : ""}`}
        >
          <i className="ri-bar-chart-box-line"></i>
          <span>Analytics</span>
        </Link>
        <Link
          to="/communication/settings"
          className={`nav-link-item ${isActive({ id: "settings", path: "/communication/settings" }) ? "active" : ""}`}
        >
          <i className="ri-settings-3-line"></i>
          <span>Settings</span>
        </Link>
      </nav>

      <div className="comm-quick-actions">
        <h6>Quick Actions</h6>
        <Link to="/communication/compose" className="btn btn-new-msg">
          <i className="ri-add-line me-1"></i> New Message
        </Link>
        <Link to="/communication/groups" className="btn btn-outline-comm">
          <i className="ri-group-line me-1"></i> Create Group
        </Link>
        <Link to="/communication/announcements" className="btn btn-outline-comm">
          <i className="ri-megaphone-line me-1"></i> New Announcement
        </Link>
      </div>

      <div className="comm-storage">
        <div className="d-flex justify-content-between">
          <span>Storage Used</span>
          <span>24%</span>
        </div>
        <div className="progress">
          <div className="progress-bar bg-primary" style={{ width: "24%" }}></div>
        </div>
        <small>2.45 GB of 10 GB</small>
      </div>
    </aside>
  );
};

export default CommSidebar;
