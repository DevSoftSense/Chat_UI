import React from "react";
import { Card, CardBody, CardHeader } from "reactstrap";
import classnames from "classnames";

const AnnouncementCategory = ({
  categories = [],
  selectedCategoryId,
  totalCount = 0,
  onSelect,
}) => (
  <Card className="comm-ann-sidebar-card">
    <CardHeader>
      <h4 className="card-title mb-0">Categories</h4>
    </CardHeader>
    <CardBody className="p-0">
      <button
        type="button"
        className={classnames(
          "comm-ann-cat-item d-flex justify-content-between w-100 border-0 border-bottom px-3 py-2 text-start",
          { active: !selectedCategoryId }
        )}
        onClick={() => onSelect?.(null)}
      >
        <span className="fs-13">All Announcements</span>
        <span className="badge bg-primary-subtle text-primary">{totalCount}</span>
      </button>
      {categories.map((cat) => {
        const id = cat.categoryId ?? cat.CategoryId;
        const name = cat.categoryName ?? cat.CategoryName;
        const count = Number(cat.announcementCount ?? cat.AnnouncementCount ?? 0);
        return (
          <button
            key={id}
            type="button"
            className={classnames(
              "comm-ann-cat-item d-flex justify-content-between w-100 border-0 border-bottom px-3 py-2 text-start",
              { active: Number(selectedCategoryId) === Number(id) }
            )}
            onClick={() => onSelect?.(id)}
          >
            <span className="fs-13">{name}</span>
            <span className="badge bg-primary-subtle text-primary">{count}</span>
          </button>
        );
      })}
    </CardBody>
  </Card>
);

export default AnnouncementCategory;
