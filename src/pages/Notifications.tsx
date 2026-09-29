import { markAllNotificationsRead, useMyNotifications } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Bell, CheckCircle2, AlertCircle, Info, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function Notifications() {
  const { user } = useAuth();
  const { data: items, loading, error } = useMyNotifications(user?.id);
  const { showToast } = useToast();

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;

    try {
      await markAllNotificationsRead(user.id);
      showToast({
        type: "success",
        title: "Notifications updated",
        message: "All your notifications have been marked as read.",
      });
    } catch {
      showToast({
        type: "error",
        title: "Update failed",
        message: "Could not mark notifications as read. Please try again.",
      });
    }
  };

  return (
    <DashboardLayout role="citizen">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
            <p className="text-gray-500">Stay updated on your applications and alerts.</p>
          </div>
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={!items.some((notification) => !notification.read)}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mark all as read
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            Loading notifications...
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-red-200 p-12 text-center text-red-600">
            Could not load notifications.
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">No notifications yet</h3>
            <p className="text-gray-500 mt-2">Application updates and county alerts will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((notification) => (
              <div 
                key={notification.id} 
                className={`bg-white p-4 rounded-xl border transition-all ${
                  notification.read ? "border-gray-200" : "border-emerald-200 shadow-sm bg-emerald-50/30"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    notification.type === "success" ? "bg-emerald-100 text-emerald-600" :
                    notification.type === "warning" ? "bg-amber-100 text-amber-600" :
                    notification.type === "error" ? "bg-red-100 text-red-600" :
                    "bg-blue-100 text-blue-600"
                  }`}>
                    {notification.type === "success" ? <CheckCircle2 className="w-5 h-5" /> :
                     notification.type === "warning" ? <AlertCircle className="w-5 h-5" /> :
                     notification.type === "error" ? <AlertCircle className="w-5 h-5" /> :
                     <Info className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                      {!notification.read && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">New</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {new Date(notification.date).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
