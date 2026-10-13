import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getChatPermissionMenu } from "../helpers/softoncloud_auth_helper";
import {
  CHAT_TAB,
  getFlagsForTab,
  indexPermissionsByTabCode,
} from "../helpers/chat_tab_permissions";

const ChatPermissionsContext = createContext({
  loading: true,
  byCode: {},
  flagsFor: () => ({
    canView: false,
    canAdd: false,
    canEdit: false,
    canDelete: false,
    isActive: false,
  }),
  refresh: async () => {},
});

export const ChatPermissionsProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [byCode, setByCode] = useState({});

  const refresh = useCallback(async () => {
    try {
      const rows = await getChatPermissionMenu();
      setByCode(indexPermissionsByTabCode(rows));
    } catch {
      setByCode({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await getChatPermissionMenu();
        if (!cancelled) setByCode(indexPermissionsByTabCode(rows));
      } catch {
        if (!cancelled) setByCode({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flagsFor = useCallback(
    (tabCode) => getFlagsForTab(byCode, tabCode),
    [byCode]
  );

  const value = useMemo(
    () => ({ loading, byCode, flagsFor, refresh, CHAT_TAB }),
    [loading, byCode, flagsFor, refresh]
  );

  return (
    <ChatPermissionsContext.Provider value={value}>
      {children}
    </ChatPermissionsContext.Provider>
  );
};

export const useChatPermissions = () => useContext(ChatPermissionsContext);

/** Hook: flags for one Manage Permissions tab (e.g. CHAT_MESSAGES). */
export const useTabPermission = (tabCode) => {
  const { flagsFor, loading } = useChatPermissions();
  return { ...flagsFor(tabCode), loading };
};

export { CHAT_TAB };
