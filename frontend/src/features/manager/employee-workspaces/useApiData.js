import { useEffect, useState } from 'react';
import { adminApi } from '../../../api/manager-api';
export function useApiData(path, reload = 0) {
  const [state, setState] = useState({ data: null, error: '', loading: Boolean(path) });
  useEffect(() => {
    if (!path) {
      setState({ data: null, error: '', loading: false });
      return undefined;
    }
    const controller = new AbortController();
    setState(previous => ({ ...previous, loading: true, error: '' }));
    adminApi(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ data, error: '', loading: false }); })
      .catch(error => { if (!controller.signal.aborted) setState({ data: null, error: error.message, loading: false }); });
    return () => controller.abort();
  }, [path, reload]);
  return state;
}
