import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Col,
  Container,
  FormGroup,
  Input,
  Label,
  Row,
  Spinner,
  Table,
} from "reactstrap";
import BreadCrumb from "../../../../Components/Common/BreadCrumb";
import {
  getChatPermissionMatrix,
  getChatPermissionRoles,
  saveChatPermissionMatrix,
} from "../../../../helpers/softoncloud_auth_helper";

const ACTIONS = [
  { key: "view", label: "VIEW" },
  { key: "add", label: "ADD" },
  { key: "edit", label: "EDIT" },
  { key: "delete", label: "DELETE" },
  { key: "active", label: "ACTIVE" },
];

const ManagePermissions = () => {
  document.title = "Manage Permissions | Chat SoftOnCloud";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [roles, setRoles] = useState([]);
  const [roleId, setRoleId] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [rows, setRows] = useState([]);
  const [baseline, setBaseline] = useState([]);

  const loadMatrix = useCallback(async (id, code) => {
    if (!id) {
      setRows([]);
      setBaseline([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const matrix = await getChatPermissionMatrix(id, code);
      setRows(matrix || []);
      setBaseline((matrix || []).map((r) => ({ ...r })));
    } catch (err) {
      setError(err?.message || "Failed to load permission matrix.");
      setRows([]);
      setBaseline([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getChatPermissionRoles();
      const mapped = (list || []).filter((r) => r.roleId > 0);
      setRoles(mapped);
      const initial =
        mapped.find((r) => /admin/i.test(r.roleCode || r.roleName)) ||
        mapped[0] ||
        null;
      if (initial) {
        setRoleId(String(initial.roleId));
        setRoleCode(initial.roleCode || "");
        await loadMatrix(String(initial.roleId), initial.roleCode || "");
      } else {
        setRoleId("");
        setRoleCode("");
        setRows([]);
        setBaseline([]);
        setLoading(false);
      }
    } catch (err) {
      setError(err?.message || "Failed to load roles.");
      setRoles([]);
      setRows([]);
      setLoading(false);
    }
  }, [loadMatrix]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const onRoleChange = (nextRoleId) => {
    setRoleId(nextRoleId);
    const selected = roles.find((r) => String(r.roleId) === String(nextRoleId));
    const code = selected?.roleCode || "";
    setRoleCode(code);
    loadMatrix(nextRoleId, code);
  };

  const onToggle = (tabId, action) => {
    setRows((prev) =>
      prev.map((row) =>
        row.tabId === tabId ? { ...row, [action]: !row[action] } : row
      )
    );
  };

  const onRefresh = () => {
    loadMatrix(roleId, roleCode);
    setSuccess("Permissions refreshed from data.");
    setError(null);
  };

  const onReset = () => {
    setRows(baseline.map((r) => ({ ...r })));
    setSuccess("Permissions reset to last loaded values.");
    setError(null);
  };

  const onSave = async () => {
    if (!roleId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveChatPermissionMatrix({
        roleId: Number(roleId),
        roleCode,
        rows,
      });
      await loadMatrix(roleId, roleCode);
      setSuccess("Permissions saved successfully.");
    } catch (err) {
      setError(err?.message || "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Manage Permissions" pageTitle="Master" />

        {error && (
          <Alert color="danger" toggle={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert color="success" toggle={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Card>
          <CardBody>
            <Row className="g-3 align-items-end mb-3">
              <Col md={4}>
                <FormGroup className="mb-0">
                  <Label className="form-label">Select Role:</Label>
                  <Input
                    type="select"
                    value={roleId}
                    onChange={(e) => onRoleChange(e.target.value)}
                    disabled={loading || roles.length === 0}
                  >
                    {roles.length === 0 ? (
                      <option value="">No roles in database</option>
                    ) : (
                      roles.map((r) => (
                        <option key={r.roleId} value={r.roleId}>
                          {r.roleName || r.roleCode}
                        </option>
                      ))
                    )}
                  </Input>
                </FormGroup>
              </Col>
              <Col
                md={8}
                className="text-md-end d-flex gap-2 justify-content-md-end flex-wrap"
              >
                <Button
                  color="link"
                  className="text-primary text-decoration-none"
                  onClick={onRefresh}
                  disabled={!roleId || loading}
                >
                  Refresh
                </Button>
                <Button
                  color="link"
                  className="text-danger text-decoration-none"
                  onClick={onReset}
                  disabled={!roleId || loading}
                >
                  Reset Role Permissions
                </Button>
                <Button
                  color="primary"
                  onClick={onSave}
                  disabled={!roleId || saving || loading}
                >
                  {saving ? <Spinner size="sm" /> : "Save"}
                </Button>
              </Col>
            </Row>

            {loading ? (
              <div className="text-center py-5">
                <Spinner color="primary" />
              </div>
            ) : (
              <div className="table-responsive">
                <Table className="align-middle table-nowrap mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 48 }}>#</th>
                      <th>TAB</th>
                      {ACTIONS.map((a) => (
                        <th key={a.key} className="text-center">
                          {a.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">
                          No permission rows found for this role.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, index) => (
                        <tr key={row.tabId || index}>
                          <td>{index + 1}</td>
                          <td className="fw-medium">{row.tab}</td>
                          {ACTIONS.map((a) => (
                            <td key={a.key} className="text-center">
                              <Input
                                type="checkbox"
                                checked={Boolean(row[a.key])}
                                onChange={() => onToggle(row.tabId, a.key)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </Container>
    </div>
  );
};

export default ManagePermissions;
