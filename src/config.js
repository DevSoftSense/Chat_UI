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
    API_URL: process.env.REACT_APP_API_URL || "https://api.softoncloud.com",
    // SoftOnCloud Chat product (product_code: chats)
    PRODUCT_ID: process.env.REACT_APP_PRODUCT_ID || "5",
  },
};
