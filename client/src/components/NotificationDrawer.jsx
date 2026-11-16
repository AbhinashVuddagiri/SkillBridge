import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Check,
  CheckCircle,
  MessageSquare,
  Clock,
  UserCheck,
  Loader2,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';

export default function NotificationDrawer({
  isOpen,
  onClose,
  notifications = [],
  onRefresh,
  onOpenChat
}) {
  const [processingId, setProcessingId] = useState(null);

  // Mark unread notifications as read in Supabase whenever drawer is opened
  useEffect(() => {
    if (isOpen && notifications.some(n => !n.read)) {
      api.markAllNotificationsRead()
        .then(() => {
          if (onRefresh) onRefresh();
        })
        .catch(err => console.error('Error marking notifications read on open:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      try {
        await api.markNotificationRead(notif.id);
        if (onRefresh) await onRefresh();
      } catch (err) {
        console.error('Error marking notification read:', err);
      }
    }
  };

  const handleAccept = async (notif) => {
    if (!notif.relatedConnectionId) return;
    setProcessingId(notif.id);
    try {
      await api.acceptConnection(notif.relatedConnectionId);
      await api.markNotificationRead(notif.id);
      if (onRefresh) await onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to accept connection request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (notif) => {
    if (!notif.relatedConnectionId) return;
    setProcessingId(notif.id);
    try {
      await api.rejectConnection(notif.relatedConnectionId);
      await api.markNotificationRead(notif.id);
      if (onRefresh) await onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to decline connection request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#164E41]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md h-full bg-white border-l border-[#D5E9DF] p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D5E9DF] shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#E4F6EE] text-[#16866A]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#164E41]">Notifications</h2>
              <p className="text-[11px] text-[#527568]">Connection requests and platform alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {notifications.some(n => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-[#16866A] hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#F1FAF5] border border-[#D5E9DF] flex items-center justify-center mx-auto text-[#527568]">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-xs text-[#164E41] font-semibold">No notifications yet</p>
              <p className="text-[11px] text-[#527568]">
                When other learners connect with you, their requests will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isProcessing = processingId === notif.id;
              const isPendingRequest =
                notif.type === 'connection_request' &&
                notif.connection &&
                notif.connection.status === 'pending';

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    notif.read
                      ? 'bg-[#F1FAF5] border-[#D5E9DF] text-[#164E41]'
                      : 'bg-[#E4F6EE] border-[#A8E6CF] text-[#164E41] shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {notif.sender?.avatar ? (
                      <img
                        src={notif.sender.avatar}
                        alt={notif.sender.name}
                        className="w-10 h-10 rounded-xl object-cover border border-[#D5E9DF] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-[#E4F6EE] text-[#16866A] flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-snug">
                        {notif.message}
                      </p>

                      {notif.sender && (
                        <p className="text-[11px] text-[#527568] mt-0.5 truncate">
                          {notif.sender.instituteName} • @{notif.sender.bridgeAccount}
                        </p>
                      )}

                      <span className="text-[10px] text-[#527568] mt-1 block">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {/* Actions for Pending Connection Request */}
                      {isPendingRequest && (
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#D5E9DF]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAccept(notif);
                            }}
                            disabled={isProcessing}
                            className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Accept</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(notif);
                            }}
                            disabled={isProcessing}
                            className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <span>Decline</span>
                          </button>
                        </div>
                      )}

                      {/* Actions for Accepted Connection */}
                      {notif.type === 'connection_accepted' && (
                        <div className="mt-2.5">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await api.markNotificationRead(notif.id);
                              } catch {
                                // proceed even if already read
                              }
                              onClose();
                              if (onRefresh) onRefresh();
                              if (onOpenChat) onOpenChat(notif.relatedConnectionId);
                            }}
                            className="py-1.5 px-3 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Open Chat</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#D5E9DF] text-center shrink-0">
          <p className="text-[11px] text-[#527568]">
            SkillBridge Secure In-App Messaging
          </p>
        </div>
      </div>
    </div>
  );
}
