// SoftOnCloud login API — always live
const LIVE_SOFTONCLOUD_API = "https://api.softoncloud.com";
// Chat API — local vs live
const LOCAL_CHAT_API = "https://localhost:7008";
const LIVE_CHAT_API = "https://chatapi.softoncloud.com";

const isDevBuild = process.env.NODE_ENV === "development";

module.exports = {
  google: {
    API_KEY: "",
    CLIENT_ID: "",
    SECRET: "",
  },
  facebook: {
    APP_ID: "",
  },
  api: {
    API_URL: process.env.REACT_APP_API_URL || LIVE_SOFTONCLOUD_API,
    PRODUCT_ID: process.env.REACT_APP_PRODUCT_ID || "5",
    // Dev build: always local Chat API (ignore env if it points to live).
    // Prod build: live Chat API (env can override for staging).
    CHAT_API_URL: isDevBuild
      ? LOCAL_CHAT_API
      : process.env.REACT_APP_CHAT_API_URL || LIVE_CHAT_API,
  },
};
