import React, { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  Col,
  Container,
  Input,
  Label,
  Row,
  Button,
  Form,
  FormFeedback,
  Alert,
  Spinner,
} from "reactstrap";
import ParticlesAuth from "../AuthenticationInner/ParticlesAuth";

import { useSelector, useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import withRouter from "../../Components/Common/withRouter";
import * as Yup from "yup";
import { useFormik } from "formik";
import { createSelector } from "reselect";

import { loginUser, socialLogin, resetLoginFlag } from "../../slices/thunks";
import { APP_LOGO } from "../../helpers/branding";

const Login = (props) => {
  const dispatch = useDispatch();

  const loginpageData = createSelector(
    (state) => state,
    (state) => ({
      error: state.Login.error,
      loading: state.Login.loading,
      errorMsg: state.Login.errorMsg,
    })
  );

  const { error, loading, errorMsg } = useSelector(loginpageData);
  const [passwordShow, setPasswordShow] = useState(false);

  const validation = useFormik({
    enableReinitialize: true,
    initialValues: {
      organizationId: "",
      email: "",
      password: "",
      rememberMe: false,
    },
    validationSchema: Yup.object({
      organizationId: Yup.string()
        .trim()
        .required("Please Enter Your Organization ID")
        .matches(/^\d+$/, "Organization ID must be a number")
        .test(
          "positive-org",
          "Organization ID must be greater than 0",
          (value) => {
            const n = parseInt(String(value || "").trim(), 10);
            return Number.isFinite(n) && n > 0;
          }
        ),
      email: Yup.string()
        .trim()
        .email("Please Enter a Valid Email")
        .required("Please Enter Your Email"),
      password: Yup.string().required("Please Enter Your Password"),
    }),
    onSubmit: (values) => {
      const orgId = String(values.organizationId || "").trim();
      if (!orgId || !/^\d+$/.test(orgId) || parseInt(orgId, 10) <= 0) {
        return;
      }
      dispatch(
        loginUser(
          {
            organizationId: orgId,
            email: values.email.trim(),
            password: values.password,
            rememberMe: Boolean(values.rememberMe),
          },
          props.router.navigate
        )
      );
    },
  });

  const socialResponse = (type) => {
    dispatch(socialLogin(type, props.router.navigate));
  };

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => {
        dispatch(resetLoginFlag());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [dispatch, errorMsg]);

  document.title = "Sign In | SoftOnCloud";

  return (
    <React.Fragment>
      <ParticlesAuth>
        <div className="auth-page-content mt-lg-5">
          <Container>
            <Row>
              <Col lg={12}>
                <div className="text-center mt-sm-5 mb-4 text-white-50">
                  <div>
                    <Link to="/" className="d-inline-block auth-logo">
                      <img src={APP_LOGO} alt="SoftOnCloud" height="36" />
                    </Link>
                  </div>
                  <p className="mt-3 fs-15 fw-medium">
                    Sign in with your SoftOnCloud account
                  </p>
                </div>
              </Col>
            </Row>

            <Row className="justify-content-center">
              <Col md={8} lg={6} xl={5}>
                <Card className="mt-4">
                  <CardBody className="p-4">
                    <div className="text-center mt-2">
                      <h5 className="text-primary">Welcome Back !</h5>
                      <p className="text-muted">
                        Sign in to continue to SoftOnCloud.
                      </p>
                    </div>
                    {error ? <Alert color="danger">{error}</Alert> : null}
                    <div className="p-2 mt-4">
                      <Form
                        onSubmit={(e) => {
                          e.preventDefault();
                          validation.handleSubmit();
                          return false;
                        }}
                        action="#"
                      >
                        <div className="mb-3">
                          <Label htmlFor="organizationId" className="form-label">
                            Organization ID
                          </Label>
                          <Input
                            name="organizationId"
                            id="organizationId"
                            className="form-control"
                            placeholder="Enter organization ID"
                            type="text"
                            autoComplete="organization"
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            value={validation.values.organizationId}
                            invalid={
                              !!(
                                validation.touched.organizationId &&
                                validation.errors.organizationId
                              )
                            }
                          />
                          {validation.touched.organizationId &&
                          validation.errors.organizationId ? (
                            <FormFeedback type="invalid">
                              {validation.errors.organizationId}
                            </FormFeedback>
                          ) : null}
                        </div>

                        <div className="mb-3">
                          <Label htmlFor="email" className="form-label">
                            Email
                          </Label>
                          <Input
                            name="email"
                            id="email"
                            className="form-control"
                            placeholder="Enter email"
                            type="email"
                            autoComplete="username"
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            value={validation.values.email}
                            invalid={
                              !!(
                                validation.touched.email &&
                                validation.errors.email
                              )
                            }
                          />
                          {validation.touched.email &&
                          validation.errors.email ? (
                            <FormFeedback type="invalid">
                              {validation.errors.email}
                            </FormFeedback>
                          ) : null}
                        </div>

                        <div className="mb-3">
                          <div className="float-end">
                            <Link to="/forgot-password" className="text-muted">
                              Forgot password?
                            </Link>
                          </div>
                          <Label
                            className="form-label"
                            htmlFor="password-input"
                          >
                            Password
                          </Label>
                          <div className="position-relative auth-pass-inputgroup mb-3">
                            <Input
                              name="password"
                              id="password-input"
                              value={validation.values.password}
                              type={passwordShow ? "text" : "password"}
                              className="form-control pe-5"
                              placeholder="Enter password"
                              autoComplete="current-password"
                              onChange={validation.handleChange}
                              onBlur={validation.handleBlur}
                              invalid={
                                !!(
                                  validation.touched.password &&
                                  validation.errors.password
                                )
                              }
                            />
                            {validation.touched.password &&
                            validation.errors.password ? (
                              <FormFeedback type="invalid">
                                {validation.errors.password}
                              </FormFeedback>
                            ) : null}
                            <button
                              className="btn btn-link position-absolute end-0 top-0 text-decoration-none text-muted"
                              type="button"
                              id="password-addon"
                              onClick={() => setPasswordShow(!passwordShow)}
                            >
                              <i className="ri-eye-fill align-middle"></i>
                            </button>
                          </div>
                        </div>

                        <div className="form-check">
                          <Input
                            className="form-check-input"
                            type="checkbox"
                            name="rememberMe"
                            id="auth-remember-check"
                            checked={Boolean(validation.values.rememberMe)}
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                          />
                          <Label
                            className="form-check-label"
                            htmlFor="auth-remember-check"
                          >
                            Remember me
                          </Label>
                        </div>

                        <div className="mt-4">
                          <Button
                            color="success"
                            disabled={loading}
                            className="btn btn-success w-100"
                            type="submit"
                          >
                            {loading ? (
                              <Spinner size="sm" className="me-2">
                                Loading...
                              </Spinner>
                            ) : null}
                            Sign In
                          </Button>
                        </div>

                        <div className="mt-4 text-center">
                          <div className="signin-other-title">
                            <h5 className="fs-13 mb-4 title">Sign In with</h5>
                          </div>
                          <div>
                            <Link
                              to="#"
                              className="btn btn-primary btn-icon me-1"
                              onClick={(e) => {
                                e.preventDefault();
                                socialResponse("facebook");
                              }}
                            >
                              <i className="ri-facebook-fill fs-16" />
                            </Link>
                            <Link
                              to="#"
                              className="btn btn-danger btn-icon me-1"
                              onClick={(e) => {
                                e.preventDefault();
                                socialResponse("google");
                              }}
                            >
                              <i className="ri-google-fill fs-16" />
                            </Link>
                            <Button color="dark" className="btn-icon">
                              <i className="ri-github-fill fs-16"></i>
                            </Button>{" "}
                            <Button color="info" className="btn-icon">
                              <i className="ri-twitter-fill fs-16"></i>
                            </Button>
                          </div>
                        </div>
                      </Form>
                    </div>
                  </CardBody>
                </Card>

                <div className="mt-4 text-center">
                  <p className="mb-0">
                    Don&apos;t have an account ?{" "}
                    <Link
                      to="/register"
                      className="fw-semibold text-primary text-decoration-underline"
                    >
                      {" "}
                      Signup{" "}
                    </Link>
                  </p>
                </div>
              </Col>
            </Row>
          </Container>
        </div>
      </ParticlesAuth>
    </React.Fragment>
  );
};

export default withRouter(Login);
