import React, { useState } from "react";
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from "reactstrap";
import { deleteAnnouncement } from "../services/announcementService";
import { apiErrorMessage } from "../utils/announcementUtils";

const DeleteAnnouncementModal = ({ isOpen, announcement, onClose, onDeleted }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = announcement?.announcementId ?? announcement?.AnnouncementId;
  const title = announcement?.title ?? announcement?.Title ?? "this announcement";

  const handleDelete = async () => {
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      await deleteAnnouncement(id);
      onDeleted?.();
      onClose?.();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to delete announcement."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered className="comm-ann-delete-modal">
      <ModalHeader toggle={onClose}>Delete announcement</ModalHeader>
      <ModalBody>
        {error ? <div className="alert alert-danger">{error}</div> : null}
        Are you sure you want to delete <strong>{title}</strong>?
        <p className="text-muted fs-13 mb-0 mt-2">
          It will be removed from the list but kept in the database.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button color="light" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button color="danger" disabled={busy} onClick={handleDelete}>
          {busy ? "Deleting..." : "Delete"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default DeleteAnnouncementModal;
