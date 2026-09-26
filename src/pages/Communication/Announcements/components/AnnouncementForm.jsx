import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "reactstrap";
import AnnouncementRecipients from "./AnnouncementRecipients";
import {
  createAnnouncement,
  updateAnnouncement,
  getAnnouncementById,
  getAnnouncementCategories,
  getSessionUserIdentity,
} from "../services/announcementService";
import {
  apiErrorMessage,
  departmentOptionsFromCategories,
  toDatetimeLocalValue,
} from "../utils/announcementUtils";

const emptyForm = {
  title: "",
  description: "",
  categoryId: "",
  departmentName: "",
  location: "",
  isImportant: false,
  expiryDate: "",
  recipientUserIds: [],
};

const normalizeRecipientIds = (raw) => {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",").map((s) => s.trim())
      : [];
  return list
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
};

const mapAnnouncementToForm = (initial) => {
  if (!initial) return emptyForm;
  const categoryName = String(
    initial.categoryName ?? initial.CategoryName ?? ""
  ).trim();
  let departmentName = String(
    initial.departmentName ?? initial.DepartmentName ?? ""
  ).trim();
  if (!departmentName && categoryName.toLowerCase().includes("department")) {
    departmentName = categoryName;
  }
  return {
    title: initial.title ?? initial.Title ?? "",
    description: initial.description ?? initial.Description ?? "",
    categoryId: initial.categoryId ?? initial.CategoryId ?? "",
    departmentName,
    location: initial.location ?? initial.Location ?? "",
    isImportant: Boolean(initial.isImportant ?? initial.IsImportant),
    expiryDate: toDatetimeLocalValue(
      initial.expiryDate ?? initial.ExpiryDate ?? null
    ),
    recipientUserIds: normalizeRecipientIds(
      initial.recipientUserIds ?? initial.RecipientUserIds
    ),
  };
};

const AnnouncementForm = ({
  isOpen,
  toggle,
  initial = null,
  onSaved,
}) => {
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  const departmentOptions = useMemo(
    () => departmentOptionsFromCategories(categories),
    [categories]
  );

  useEffect(() => {
    if (!isOpen) return;
    getAnnouncementCategories()
      .then((rows) => setCategories(Array.isArray(rows) ? rows : []))
      .catch(() => setCategories([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async () => {
      setError("");
      const id = initial?.announcementId ?? initial?.AnnouncementId;
      if (!id) {
        setForm(emptyForm);
        return;
      }

      setForm(mapAnnouncementToForm(initial));
      setLoadingDetail(true);
      try {
        const detail = await getAnnouncementById(id);
        if (cancelled) return;
        setForm(mapAnnouncementToForm({ ...initial, ...detail }));
      } catch {
        if (!cancelled) {
          // Keep list-row fields; recipients may stay empty until SQL is applied
          setForm(mapAnnouncementToForm(initial));
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, initial]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCategoryChange = (value) => {
    setForm((prev) => {
      const next = { ...prev, categoryId: value };
      const cat = categories.find(
        (c) => String(c.categoryId ?? c.CategoryId) === String(value)
      );
      const catName = String(cat?.categoryName ?? cat?.CategoryName ?? "");
      if (catName.toLowerCase().includes("department") && !prev.departmentName) {
        next.departmentName = catName;
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!String(form.title).trim()) {
      setError("Title is required.");
      return;
    }
    if (!String(form.description).trim()) {
      setError("Description is required.");
      return;
    }
    if (!form.categoryId) {
      setError("Category is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const me = getSessionUserIdentity();
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryId: Number(form.categoryId),
        departmentName: form.departmentName.trim() || null,
        location: form.location.trim() || null,
        isImportant: Boolean(form.isImportant),
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
        recipientUserIds: form.recipientUserIds,
        postedByName: me?.displayName || me?.email || null,
      };
      const id = initial?.announcementId ?? initial?.AnnouncementId;
      if (id) {
        await updateAnnouncement(id, {
          ...payload,
          recipientUserIds: form.recipientUserIds ?? [],
        });
        onSaved?.({ created: false });
      } else {
        await createAnnouncement(payload);
        onSaved?.({ created: true });
      }
      toggle?.();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to save announcement."));
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || loadingDetail;

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered size="lg">
      <ModalHeader toggle={toggle}>
        {initial ? "Edit announcement" : "New announcement"}
      </ModalHeader>
      <ModalBody>
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <FormGroup>
          <Label>Title</Label>
          <Input
            value={form.title}
            disabled={busy}
            onChange={(e) => setField("title", e.target.value)}
          />
        </FormGroup>
        <FormGroup>
          <Label>Description</Label>
          <Input
            type="textarea"
            rows={4}
            value={form.description}
            disabled={busy}
            onChange={(e) => setField("description", e.target.value)}
          />
        </FormGroup>
        <div className="row g-2">
          <div className="col-md-6">
            <FormGroup>
              <Label>Category</Label>
              <Input
                type="select"
                value={form.categoryId}
                disabled={busy}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option
                    key={c.categoryId ?? c.CategoryId}
                    value={c.categoryId ?? c.CategoryId}
                  >
                    {c.categoryName ?? c.CategoryName}
                  </option>
                ))}
              </Input>
            </FormGroup>
          </div>
          <div className="col-md-6">
            <FormGroup>
              <Label>Department</Label>
              <Input
                type="select"
                value={form.departmentName}
                disabled={busy}
                onChange={(e) => setField("departmentName", e.target.value)}
              >
                <option value="">Optional</option>
                {departmentOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                {form.departmentName &&
                !departmentOptions.includes(form.departmentName) ? (
                  <option value={form.departmentName}>
                    {form.departmentName}
                  </option>
                ) : null}
              </Input>
            </FormGroup>
          </div>
          <div className="col-md-6">
            <FormGroup>
              <Label>Location</Label>
              <Input
                value={form.location}
                disabled={busy}
                onChange={(e) => setField("location", e.target.value)}
                placeholder="Optional"
              />
            </FormGroup>
          </div>
          <div className="col-md-6">
            <FormGroup>
              <Label>Expiry date</Label>
              <Input
                type="datetime-local"
                value={form.expiryDate}
                disabled={busy}
                onChange={(e) => setField("expiryDate", e.target.value)}
              />
            </FormGroup>
          </div>
        </div>
        <FormGroup check className="mb-3">
          <Input
            id="annImportant"
            type="checkbox"
            checked={form.isImportant}
            disabled={busy}
            onChange={(e) => setField("isImportant", e.target.checked)}
          />
          <Label check htmlFor="annImportant">
            Mark as Important
          </Label>
        </FormGroup>
        <AnnouncementRecipients
          selectedIds={form.recipientUserIds}
          disabled={busy}
          onChange={(ids) => setField("recipientUserIds", ids)}
        />
      </ModalBody>
      <ModalFooter>
        <Button color="light" disabled={busy} onClick={toggle}>
          Cancel
        </Button>
        <Button color="primary" disabled={busy} onClick={handleSubmit}>
          {saving ? "Saving..." : initial ? "Update" : "Create"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AnnouncementForm;
