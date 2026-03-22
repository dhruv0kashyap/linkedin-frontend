import api from './api';
import {
  ApiResponse, AuthResponse, RegisterRequest, LoginRequest,
  User, Post, PostRequest, Comment, Education, Experience, Skill,
  Connection, Job, JobApplication, Notification, PageResponse
} from '../types';

// ── Auth ────────────────────────────────────────────────────────────────────
export const authService = {
  register: (data: RegisterRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', data),
  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data),
  verifyPhone: (email: string, phoneNumber: string) =>
    api.post<ApiResponse<string>>('/auth/forgot-password/verify', { email, phoneNumber }),
  resetPassword: (email: string, newPassword: string, confirmPassword: string) =>
    api.post<ApiResponse<string>>('/auth/reset-password', { email, newPassword, confirmPassword }),
};

// ── Users ────────────────────────────────────────────────────────────────────
export const userService = {
  getCurrentUser: () => api.get<ApiResponse<User>>('/users/me'),
  getUserById: (id: number) => api.get<ApiResponse<User>>(`/users/${id}`),
  updateProfile: (data: Partial<User>) => api.put<ApiResponse<User>>('/users/me', data),
  searchUsers: (keyword: string) => api.get<ApiResponse<User[]>>(`/users/search?keyword=${keyword}`),

  addEducation: (data: Partial<Education>) => api.post<ApiResponse<Education>>('/users/me/education', data),
  updateEducation: (id: number, data: Partial<Education>) => api.put<ApiResponse<Education>>(`/users/me/education/${id}`, data),
  deleteEducation: (id: number) => api.delete<ApiResponse<void>>(`/users/me/education/${id}`),

  addExperience: (data: Partial<Experience>) => api.post<ApiResponse<Experience>>('/users/me/experience', data),
  updateExperience: (id: number, data: Partial<Experience>) => api.put<ApiResponse<Experience>>(`/users/me/experience/${id}`, data),
  deleteExperience: (id: number) => api.delete<ApiResponse<void>>(`/users/me/experience/${id}`),

  addSkill: (skillName: string) => api.post<ApiResponse<Skill>>('/users/me/skills', { skillName }),
  deleteSkill: (id: number) => api.delete<ApiResponse<void>>(`/users/me/skills/${id}`),
};

// ── Posts ────────────────────────────────────────────────────────────────────
export const postService = {
  createPost: (data: PostRequest) => api.post<ApiResponse<Post>>('/posts', data),
  updatePost: (id: number, data: PostRequest) => api.put<ApiResponse<Post>>(`/posts/${id}`, data),
  deletePost: (id: number) => api.delete<ApiResponse<void>>(`/posts/${id}`),
  getPostById: (id: number) => api.get<ApiResponse<Post>>(`/posts/${id}`),
  getFeedPosts: (page = 0, size = 10) =>
    api.get<ApiResponse<PageResponse<Post>>>(`/posts/feed?page=${page}&size=${size}`),
  getUserPosts: (userId: number, page = 0, size = 10) =>
    api.get<ApiResponse<PageResponse<Post>>>(`/posts/user/${userId}?page=${page}&size=${size}`),
  getDraftPosts: (page = 0, size = 10) =>
    api.get<ApiResponse<PageResponse<Post>>>(`/posts/drafts?page=${page}&size=${size}`),
  publishDraft: (id: number) => api.put<ApiResponse<Post>>(`/posts/${id}/publish`),
  toggleLike: (id: number) => api.post<ApiResponse<boolean>>(`/posts/${id}/like`),
  addComment: (postId: number, content: string) =>
    api.post<ApiResponse<Comment>>(`/posts/${postId}/comments`, { content }),
  getComments: (postId: number, page = 0, size = 50) =>
    api.get<ApiResponse<PageResponse<Comment>>>(`/posts/${postId}/comments?page=${page}&size=${size}`),
  deleteComment: (commentId: number) => api.delete<ApiResponse<void>>(`/posts/comments/${commentId}`),
  sharePost: (postId: number, text?: string) =>
    api.post<ApiResponse<Post>>(`/posts/${postId}/share?${text ? `text=${encodeURIComponent(text)}` : ''}`),
};

// ── File Upload ──────────────────────────────────────────────────────────────
export const fileService = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<string>>('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Connections ──────────────────────────────────────────────────────────────
export const connectionService = {
  sendRequest: (receiverId: number) =>
    api.post<ApiResponse<Connection>>(`/connections/request/${receiverId}`),
  acceptConnection: (connectionId: number) =>
    api.put<ApiResponse<Connection>>(`/connections/${connectionId}/accept`),
  rejectConnection: (connectionId: number) =>
    api.put<ApiResponse<Connection>>(`/connections/${connectionId}/reject`),
  removeConnection: (connectionId: number) =>
    api.delete<ApiResponse<void>>(`/connections/${connectionId}`),
  getPendingRequests: () => api.get<ApiResponse<Connection[]>>('/connections/pending'),
  getConnections: () => api.get<ApiResponse<User[]>>('/connections'),
  getConnectionStatus: (targetUserId: number) =>
    api.get<ApiResponse<{ status: string; connectionId: number | null }>>(`/connections/status/${targetUserId}`),
};

// ── Jobs ─────────────────────────────────────────────────────────────────────
export const jobService = {
  createJob: (data: Partial<Job>) => api.post<ApiResponse<Job>>('/jobs', data),
  updateJob: (id: number, data: Partial<Job>) => api.put<ApiResponse<Job>>(`/jobs/${id}`, data),
  deleteJob: (id: number) => api.delete<ApiResponse<void>>(`/jobs/${id}`),
  getJobById: (id: number) => api.get<ApiResponse<Job>>(`/jobs/${id}`),
  getAllJobs: (page = 0, size = 10) =>
    api.get<ApiResponse<PageResponse<Job>>>(`/jobs?page=${page}&size=${size}`),
  getMyPostedJobs: (page = 0, size = 20) =>
    api.get<ApiResponse<PageResponse<Job>>>(`/jobs/my-posted?page=${page}&size=${size}`),
  searchJobs: (params: Record<string, string | number>) =>
    api.get<ApiResponse<PageResponse<Job>>>('/jobs/search', { params }),
  applyForJob: (jobId: number, data: { resumeUrl?: string; coverLetter?: string }) =>
    api.post<ApiResponse<JobApplication>>(`/jobs/${jobId}/apply`, data),
  withdrawApplication: (applicationId: number) =>
    api.put<ApiResponse<void>>(`/jobs/applications/${applicationId}/withdraw`),
  getMyApplications: (page = 0, size = 20) =>
    api.get<ApiResponse<PageResponse<JobApplication>>>(`/jobs/applications/my?page=${page}&size=${size}`),
  saveJob: (jobId: number) => api.post<ApiResponse<string>>(`/jobs/${jobId}/save`),
  getSavedJobs: (page = 0, size = 10) =>
    api.get<ApiResponse<PageResponse<Job>>>(`/jobs/saved?page=${page}&size=${size}`),
  getJobApplications: (jobId: number, page = 0, size = 50) =>
    api.get<ApiResponse<PageResponse<JobApplication>>>(`/jobs/${jobId}/applications?page=${page}&size=${size}`),
  updateApplicationStatus: (applicationId: number, status: string) =>
    api.patch<ApiResponse<JobApplication>>(`/jobs/applications/${applicationId}/status`, { status }),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationService = {
  getNotifications: (page = 0, size = 20) =>
    api.get<ApiResponse<PageResponse<Notification>>>(`/notifications?page=${page}&size=${size}`),
  getUnreadCount: () => api.get<ApiResponse<number>>('/notifications/unread-count'),
  markAsRead: (id: number) => api.put<ApiResponse<void>>(`/notifications/${id}/read`),
  markAllAsRead: () => api.put<ApiResponse<void>>('/notifications/read-all'),
};
