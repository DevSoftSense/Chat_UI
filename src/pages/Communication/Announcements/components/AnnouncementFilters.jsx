import React from "react";
import { Input, Nav, NavItem, NavLink } from "reactstrap";
import classnames from "classnames";
import {
  FILTER_TABS,
  SORT_OPTIONS,
} from "../constants/announcementConstants";

const AnnouncementFilters = ({
  filter,
  onFilterChange,
  categoryId,
  categories = [],
  onCategoryChange,
  sortBy,
  onSortChange,
  search,
  onSearchChange,
  onSearchSubmit,
}) => {
  const submitSearch = (value) => {
    onSearchSubmit?.(String(value ?? "").trim());
  };

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 comm-ann-filters">
      <Nav pills className="mb-0 flex-wrap gap-1">
        {FILTER_TABS.map((tab) => (
          <NavItem key={tab.id}>
            <NavLink
              href="#"
              className={classnames({ active: filter === tab.id })}
              onClick={(e) => {
                e.preventDefault();
                onFilterChange?.(tab.id);
              }}
            >
              {tab.label}
            </NavLink>
          </NavItem>
        ))}
      </Nav>

      <div className="d-flex flex-wrap align-items-center gap-2">
        <div className="search-box">
          <Input
            type="search"
            className="form-control"
            placeholder="Search..."
            value={search || ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSearch(e.target.value);
              }
            }}
          />
          <button
            type="button"
            className="btn btn-link search-icon p-0 border-0"
            aria-label="Search announcements"
            onClick={() => submitSearch(search)}
          >
            <i className="ri-search-line"></i>
          </button>
        </div>
        <Input
          type="select"
          className="form-select"
          style={{ width: 160 }}
          value={categoryId || ""}
          onChange={(e) =>
            onCategoryChange?.(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option
              key={c.categoryId ?? c.CategoryId}
              value={c.categoryId ?? c.CategoryId}
            >
              {c.categoryName ?? c.CategoryName}
            </option>
          ))}
        </Input>
        <Input
          type="select"
          className="form-select"
          style={{ width: 150 }}
          value={sortBy || "newest"}
          onChange={(e) => onSortChange?.(e.target.value)}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              Sort: {opt.label}
            </option>
          ))}
        </Input>
      </div>
    </div>
  );
};

export default AnnouncementFilters;
