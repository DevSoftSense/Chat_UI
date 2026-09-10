import axios from "axios";
import { api } from "../config";

// SoftOnCloud API base URL
axios.defaults.baseURL = api.API_URL;
axios.defaults.headers.post["Content-Type"] = "application/json";

const storedAuth = (() => {
  try {
    return JSON.parse(sessionStorage.getItem("authUser"));
  } catch {
    return null;
  }
})();

const token = storedAuth?.token || storedAuth?.accessToken || localStorage.getItem("authToken") || null;
if (token) {
  axios.defaults.headers.common["Authorization"] = "Bearer " + token;
}

axios.interceptors.response.use(
  function (response) {
    return response.data ? response.data : response;
  },
  function (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const apiMessage = data?.message;
    const denialReason = data?.denialReason;

    let message;
    switch (status) {
      case 500:
        message = apiMessage || "Internal Server Error";
        break;
      case 401:
        message = apiMessage || "Invalid credentials";
        break;
      case 403:
        message = denialReason
          ? `${apiMessage || "Access denied"} (${denialReason})`
          : (apiMessage || "Access denied");
        break;
      case 404:
        message = apiMessage || "Sorry! the data you are looking for could not be found";
        break;
      default:
        message = apiMessage || error.message || error;
    }

    return Promise.reject({
      message,
      status,
      denialReason,
      data,
    });
  }
);

/**
 * Sets the default authorization
 * @param {*} token
 */
const setAuthorization = (token) => {
  axios.defaults.headers.common["Authorization"] = "Bearer " + token;
};

class APIClient {
  get = (url, params) => {
    if (params) {
      const queryString = Object.keys(params)
        .map((key) => key + "=" + encodeURIComponent(params[key]))
        .join("&");
      return axios.get(`${url}?${queryString}`);
    }
    return axios.get(`${url}`);
  };

  create = (url, data) => {
    return axios.post(url, data);
  };

  update = (url, data) => {
    return axios.patch(url, data);
  };

  put = (url, data) => {
    return axios.put(url, data);
  };

  delete = (url, config) => {
    return axios.delete(url, { ...config });
  };
}

const getLoggedinUser = () => {
  const user = sessionStorage.getItem("authUser");
  if (!user) {
    return null;
  }
  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
};

export { APIClient, setAuthorization, getLoggedinUser };
