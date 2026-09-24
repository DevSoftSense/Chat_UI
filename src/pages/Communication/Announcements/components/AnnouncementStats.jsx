import React from "react";
import { Card, CardBody, CardHeader } from "reactstrap";

const AnnouncementStats = ({ stats }) => {
  const rows = [
    {
      label: "Total Announcements",
      value: Number(stats?.totalAnnouncements ?? 0).toLocaleString(),
    },
    {
      label: "Total Reads",
      value: Number(stats?.totalReads ?? 0).toLocaleString(),
    },
    {
      label: "Unread by Me",
      value: Number(stats?.unreadByMe ?? 0).toLocaleString(),
    },
  ];

  return (
    <Card className="mt-3 comm-ann-sidebar-card">
      <CardHeader>
        <h4 className="card-title mb-0">Stats</h4>
      </CardHeader>
      <CardBody>
        {rows.map((s) => (
          <div key={s.label} className="d-flex justify-content-between mb-2">
            <span className="text-muted fs-13">{s.label}</span>
            <span className="fw-medium">{s.value}</span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
};

export default AnnouncementStats;
