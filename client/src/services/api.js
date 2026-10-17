const rawApiBase = import.meta.env.VITE_API_BASE_URL || '/api';
const cleanBase = rawApiBase.replace(/\/+$/, '');
const API_BASE = cleanBase.endsWith('/api') ? cleanBase : (cleanBase ? `${cleanBase}/api` : '/api');

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('skillbridge_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, config);
  } catch (netErr) {
    console.error('Network request failed:', netErr);
    throw new Error('Unable to connect to SkillBridge server. Please check your network and try again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  checkUsername: (username) => apiRequest(`/auth/check-username?username=${encodeURIComponent(username)}`),
  checkBridgeAccount: (account) => apiRequest(`/auth/check-username?username=${encodeURIComponent(account)}`),
  checkGmail: (gmail) => apiRequest('/auth/check-gmail', { method: 'POST', body: { gmail } }),
  sendRegistrationOtp: (gmail) => apiRequest('/auth/send-registration-otp', { method: 'POST', body: { gmail } }),
  verifyRegistrationOtp: (gmail, otp) => apiRequest('/auth/verify-registration-otp', { method: 'POST', body: { gmail, otp } }),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials }),
  register: (userData) => apiRequest('/auth/register', { method: 'POST', body: userData }),
  forgotPasswordSendOtp: (identifier) => apiRequest('/auth/forgot-password/send-otp', { method: 'POST', body: { identifier } }),
  forgotPasswordReset: (data) => apiRequest('/auth/forgot-password/reset', { method: 'POST', body: data }),
  getMe: () => apiRequest('/auth/me'),

  // Users & Profiles
  getUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/users${query ? `?${query}` : ''}`);
  },
  getUser: (id) => apiRequest(`/users/${id}`),
  getProfile: () => apiRequest('/users/profile'),
  updateProfile: (data) => apiRequest('/users/profile', { method: 'PUT', body: data }),
  sendDeleteAccountOtp: (gmail) => apiRequest('/users/account/send-delete-otp', { method: 'POST', body: { gmail } }),
  verifyDeletePassword: (password) => apiRequest('/users/account/verify-password', { method: 'POST', body: { password } }),
  verifyDeleteAccountOtp: (otp) => apiRequest('/users/account/verify-delete-otp', { method: 'POST', body: { otp } }),
  permanentlyDeleteAccount: (payload) => apiRequest('/users/account', { method: 'DELETE', body: typeof payload === 'string' ? { deleteToken: payload } : payload }),
  deleteAccount: (otpOrPassword) => apiRequest('/users/account', { method: 'DELETE', body: typeof otpOrPassword === 'object' ? otpOrPassword : { otp: otpOrPassword, password: otpOrPassword } }),
  deleteAccountWithOtp: (otp) => apiRequest('/users/account', { method: 'DELETE', body: { otp } }),

  // Connections
  getConnections: () => apiRequest('/connections'),
  sendConnection: (recipientId) => apiRequest('/connections', { method: 'POST', body: { recipientId } }),
  acceptConnection: (id) => apiRequest(`/connections/${id}/accept`, { method: 'PUT' }),
  rejectConnection: (id) => apiRequest(`/connections/${id}/reject`, { method: 'PUT' }),
  removeConnection: (id) => apiRequest(`/connections/${id}`, { method: 'DELETE' }),
  toggleMuteConnection: (id) => apiRequest(`/connections/${id}/mute`, { method: 'POST' }),
  getMutedConnections: () => apiRequest('/connections/muted'),

  // Notifications
  getNotifications: () => apiRequest('/notifications'),
  markNotificationRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => apiRequest('/notifications/read-all', { method: 'PUT' }),

  // Messages & Chat
  getMessages: (connectionId) => apiRequest(`/messages/${connectionId}`),
  sendMessage: (connectionId, messageBody, replyToId = null) => apiRequest(`/messages/${connectionId}`, { method: 'POST', body: { messageBody, replyToId } }),
  editMessage: (messageId, messageBody) => apiRequest(`/messages/${messageId}`, { method: 'PUT', body: { messageBody } }),
  unsendMessage: (messageId) => apiRequest(`/messages/${messageId}/unsend`, { method: 'POST' }),
  deleteMessageForMe: (messageId) => apiRequest(`/messages/${messageId}/delete-for-me`, { method: 'POST' }),
  clearChat: (connectionId) => apiRequest(`/messages/${connectionId}/clear`, { method: 'POST' })
};

