import React, { useEffect, useMemo, useState } from "react";
import { Input, Label } from "reactstrap";
import CommAvatar from "../../components/CommAvatar";
import {
  getOrganisationProductUsers,
  getSessionPublicOrgId,
  getConfiguredProductId,
  getSessionUserIdentity,
  resolveUserAvatarUrl,
} from "../services/announcementService";

const AnnouncementRecipients = ({
  selectedIds = [],
  onChange,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const orgId = getSessionPublicOrgId();
        const productId = getConfiguredProductId();
        const response = await getOrganisationProductUsers(orgId, productId);
        const rows = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];
        if (!cancelled) setUsers(rows);
      } catch (err) {
        if (!cancelled) {
          setUsers([]);
          setError(err?.message || "Unable to load users.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const me = useMemo(() => getSessionUserIdentity(), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const id = u.userId ?? u.UserId;
      if (me?.userId && String(id) === String(me.userId)) return false;
      if (!q) return true;
      const name = String(
        u.displayName ||
          u.DisplayName ||
          [u.firstName, u.lastName].filter(Boolean).join(" ") ||
          u.email ||
          ""
      ).toLowerCase();
      const email = String(u.email || u.Email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, search, me?.userId]);

  const toggle = (userId) => {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return;
    const set = new Set((selectedIds || []).map(Number));
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange?.(Array.from(set));
  };

  return (
    <div className="comm-ann-recipients">
      <Label className="form-label">Recipients</Label>
      <Input
        type="search"
        bsSize="sm"
        className="mb-2"
        placeholder="Search SoftOnCloud users..."
        value={search}
        disabled={disabled || loading}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error ? <div className="text-danger fs-12 mb-2">{error}</div> : null}
      <div className="comm-ann-recipient-list border rounded">
        {loading ? (
          <div className="text-muted fs-13 p-2">Loading users...</div>
        ) : !filtered.length ? (
          <div className="text-muted fs-13 p-2">No users found.</div>
        ) : (
          filtered.slice(0, 80).map((u) => {
            const id = Number(u.userId ?? u.UserId);
            const name =
              u.displayName ||
              u.DisplayName ||
              [u.firstName || u.FirstName, u.lastName || u.LastName]
                .filter(Boolean)
                .join(" ") ||
              u.email ||
              u.Email ||
              `User ${id}`;
            const checked = (selectedIds || []).map(Number).includes(id);
            const avatarSrc = resolveUserAvatarUrl(
              id,
              u.profileImageUrl ||
                u.ProfileImageUrl ||
                u.avatarUrl ||
                u.AvatarUrl ||
                u.profileImage ||
                u.photoUrl ||
                null
            );
            return (
              <label
                key={id}
                className="d-flex align-items-center gap-2 px-2 py-1 mb-0 border-bottom"
              >
                <Input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(id)}
                />
                <CommAvatar id={id} src={avatarSrc} size="xs" />
                <span className="fs-13 text-truncate">{name}</span>
              </label>
            );
          })
        )}
      </div>
      <div className="text-muted fs-12 mt-1">
        {(selectedIds || []).length} selected (you are always included)
      </div>
    </div>
  );
};

export default AnnouncementRecipients;
