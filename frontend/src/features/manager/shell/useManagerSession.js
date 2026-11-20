import { useState, useEffect } from "react";
import { adminApi, adminEndpoints, adminRefreshSession } from "../../../api/manager-api";
import { normalizeAdminPath } from "./manager-navigation";
export default function useManagerSession(setPath) {
  const [admin, setAdmin] = useState(null);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [employeeProfileReady, setEmployeeProfileReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');
  useEffect(() => {
    const onPop = () => {
      const current = window.location.pathname;
      const normalized = normalizeAdminPath(current);
      if (current !== normalized) window.history.replaceState({}, "", normalized + window.location.search);
      setPath(normalized + window.location.search);
    };
    onPop();
    window.addEventListener("popstate", onPop);
    adminRefreshSession().then(session => {
      if (session?.manager) setAdmin(session.manager);else {
        window.history.replaceState({}, '', '/manager/login');
        setPath('/manager/login');
      }
    }).catch(e => setSessionError(e.message)).finally(() => setChecking(false));
    return () => window.removeEventListener("popstate", onPop);
  }, [setPath]);
  useEffect(() => {
    if (admin?.role !== "EMPLOYEE") {
      setEmployeeProfile(null);
      setEmployeeProfileReady(false);
      return undefined;
    }
    const controller = new AbortController();
    setEmployeeProfile(null);
    setEmployeeProfileReady(false);
    adminApi(adminEndpoints.myProfile(), {
      signal: controller.signal
    }).then(profile => {
      if (!controller.signal.aborted) setEmployeeProfile(profile);
    }).catch(() => {
      if (!controller.signal.aborted) setEmployeeProfile(null);
    }).finally(() => {
      if (!controller.signal.aborted) setEmployeeProfileReady(true);
    });
    return () => controller.abort();
  }, [admin?.id, admin?.role]);
  return {
    admin,
    setAdmin,
    employeeProfile,
    employeeProfileReady,
    checking,
    sessionError
  };
}
