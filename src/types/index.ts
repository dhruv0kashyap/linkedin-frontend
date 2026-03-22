// Auth types
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  profilePhotoUrl?: string;
  headline?: string;
  location?: string;
  summary?: string;
  isActive: boolean;
  createdAt: string;
  educations?: Education[];
  experiences?: Experience[];
  skills?: Skill[];
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  user: User;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Post types
export type PostType = 'POST' | 'ARTICLE';
export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED';

export interface Post {
  id: number;
  userId: number;
  userFirstName: string;
  userLastName: string;
  userProfilePhotoUrl?: string;
  userHeadline?: string;
  content: string;
  postType: PostType;
  status: PostStatus;
  scheduledAt?: string;
  imageUrl?: string;
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostRequest {
  content: string;
  postType?: PostType;
  status?: PostStatus;
  scheduledAt?: string;
  imageUrl?: string;
  hashtags?: string[];
}

export interface Comment {
  id: number;
  postId: number;
  userId: number;
  userFirstName: string;
  userLastName: string;
  userProfilePhotoUrl?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Profile types
export interface Education {
  id: number;
  userId: number;
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  description?: string;
  createdAt: string;
}

export interface Experience {
  id: number;
  userId: number;
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
  createdAt: string;
}

export interface Skill {
  id: number;
  userId: number;
  skillName: string;
  createdAt: string;
}

// Connection types
export type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';

export interface Connection {
  id: number;
  senderId: number;
  senderFirstName: string;
  senderLastName: string;
  senderProfilePhotoUrl?: string;
  senderHeadline?: string;
  receiverId: number;
  receiverFirstName: string;
  receiverLastName: string;
  receiverProfilePhotoUrl?: string;
  receiverHeadline?: string;
  status: ConnectionStatus;
  createdAt: string;
}

// Job types
export type JobType = 'FULL_TIME' | 'PART_TIME' | 'REMOTE' | 'CONTRACT' | 'INTERNSHIP';
export type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'EXECUTIVE';
export type ApplicationStatus = 'APPLIED' | 'REVIEWING' | 'INTERVIEW' | 'OFFERED' | 'REJECTED' | 'WITHDRAWN';

export interface Job {
  id: number;
  title: string;
  company: string;
  location?: string;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  description: string;
  requirements?: string;
  benefits?: string;
  applicationDeadline?: string;
  postedById: number;
  postedByName: string;
  isActive: boolean;
  savedByCurrentUser: boolean;
  appliedByCurrentUser: boolean;
  createdAt: string;
}

export interface JobApplication {
  id: number;
  jobId: number;
  jobTitle: string;
  company: string;
  userId: number;
  userFirstName: string;
  userLastName: string;
  resumeUrl?: string;
  coverLetter?: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
}

// Notification types
export type NotificationType =
  | 'CONNECTION_REQUEST'
  | 'CONNECTION_ACCEPTED'
  | 'POST_LIKE'
  | 'POST_COMMENT'
  | 'JOB_APPLICATION_UPDATE';

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  message: string;
  referenceId?: number;
  isRead: boolean;
  createdAt: string;
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}
