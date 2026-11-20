import { useState } from "react";
import { api, endpoints } from "../../../api/api";
export default function useCustomerNotifications(user) {
  const [notificationCount, setNotificationCount] = useState(0);
  const reloadNotifications = async () => {
    if (!user) return;
    try {
      const data = await api(endpoints.notifications);
      setNotificationCount(data.unreadCount || 0);
    } catch {/* thông báo không làm gián đoạn việc mua hàng */}
  };
  return {
    notificationCount,
    setNotificationCount,
    reloadNotifications
  };
}
