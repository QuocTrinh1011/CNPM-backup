import { useState, useEffect } from "react";
import { api, endpoints, refreshSession } from "../../../api/api";
export default function useCustomerSession() {
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [sessionError, setSessionError] = useState("");
  useEffect(() => {
    api(endpoints.categories).then(setCategories).catch(() => null);
    let active = true;
    refreshSession().then(session => {
      if (active && session?.customer) setUser(session.customer);
    }).catch(error => {
      if (active) setSessionError(error.message);
    }).finally(() => {
      if (active) setSessionChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);
  const retrySession = async () => {
    setSessionChecking(true);
    try {
      const session = await refreshSession();
      setUser(session?.customer || null);
      setSessionError("");
    } catch (error) {
      setSessionError(error.message);
    } finally {
      setSessionChecking(false);
    }
  };
  return {
    categories,
    user,
    setUser,
    sessionChecking,
    sessionError,
    setSessionError,
    retrySession
  };
}
