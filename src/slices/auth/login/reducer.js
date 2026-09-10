import { createSlice } from "@reduxjs/toolkit";

export const initialState = {
  user: {},
  error: "",
  loading: false,
  isUserLogout: false,
  errorMsg: false,
};

const loginSlice = createSlice({
  name: "login",
  initialState,
  reducers: {
    loginBegin(state) {
      state.loading = true;
      state.error = "";
      state.errorMsg = false;
    },
    apiError(state, action) {
      const payload = action.payload;
      state.error =
        typeof payload === "string"
          ? payload
          : payload?.data || payload?.message || "Login failed.";
      state.loading = false;
      state.isUserLogout = false;
      state.errorMsg = true;
    },
    loginSuccess(state, action) {
      state.user = action.payload;
      state.loading = false;
      state.errorMsg = false;
      state.error = "";
    },
    logoutUserSuccess(state) {
      state.isUserLogout = true;
      state.user = {};
      state.loading = false;
    },
    reset_login_flag(state) {
      state.error = null;
      state.loading = false;
      state.errorMsg = false;
    },
  },
});

export const {
  loginBegin,
  apiError,
  loginSuccess,
  logoutUserSuccess,
  reset_login_flag,
} = loginSlice.actions;

export default loginSlice.reducer;
