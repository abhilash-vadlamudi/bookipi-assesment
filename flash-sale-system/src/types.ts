// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp?: string;
}

export interface ApiErrorResponse {
  success: false;
  error?: string;
  message?: string;
  statusCode?: number;
  timestamp?: string;
  path?: string;
}

// Flash Sale Types
export interface CreateFlashSaleRequest {
  name: string;
  startTime: string;
  endTime: string;
  products: CreateProductRequest[];
}

export interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  totalQuantity: number;
  quantity?: number; // alias for totalQuantity for compatibility
}

// Purchase Types
export interface PurchaseRequest {
  userId?: string;
  flashSaleId: number;
  productId: number;
  quantity?: number;
}

// User Types
export interface CreateUserRequest {
  email: string;
  password: string;
  confirmPassword?: string;
  timezone?: string;
  role?: 'user' | 'admin';
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Database Transaction Interface
export interface DatabaseTransaction {
  run(sql: string, params?: unknown[]): Promise<{ id: number; changes: number }>;
  get(sql: string, params?: unknown[]): Promise<unknown>;
  all(sql: string, params?: unknown[]): Promise<unknown[]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// Flash Sale Entity Types
export interface FlashSale {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  total_quantity: number;
  available_quantity: number;
  flash_sale_id: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  role: 'user' | 'admin';
  is_active: boolean;
  timezone: string;
  created_at: string;
  last_login?: string;
  failed_login_attempts: number;
  locked_until?: string;
}

export interface Purchase {
  id: number;
  user_id: string;
  product_id: number;
  flash_sale_id: number;
  quantity: number;
  purchase_time: string;
  status: 'completed' | 'cancelled' | 'pending';
  transaction_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Pagination Types
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Search and Filter Types
export interface FlashSaleSearchOptions {
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
}

// Health Check Types
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: {
    status: 'healthy' | 'unhealthy';
    details?: string;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

// Configuration Types
export interface DatabaseConfig {
  path: string;
  enableWAL: boolean;
  busyTimeout: number;
  maxConnections: number;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  issuer: string;
  audience: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  authMaxRequests: number;
  purchaseMaxRequests: number;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
}

export interface CorsConfig {
  origins: string[];
  credentials: boolean;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  file?: string | undefined;
}

export interface RateLimitSettings {
  windowMs: number;
  max: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

export interface RateLimitsConfig {
  api: RateLimitSettings;
  purchase: RateLimitSettings;
  auth: RateLimitSettings;
}

// Audit Log Types
export interface AuditLog {
  id: number;
  user_id?: string;
  action: string;
  resource: string;
  resource_id?: string;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
}

// API Key Types
export interface ApiKey {
  id: number;
  key_hash: string;
  user_id: string;
  name: string;
  permissions?: string;
  is_active: boolean;
  expires_at?: string;
  last_used?: string;
  created_at: string;
}

// Additional Missing Types
export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  database: DatabaseConfig;
  security: SecurityConfig;
  rateLimits: RateLimitsConfig;
  cors: CorsConfig;
  logging: LoggingConfig;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
}

export enum FlashSaleStatus {
  UPCOMING = 'upcoming',
  ACTIVE = 'active',
  ENDED = 'ended',
  CANCELLED = 'cancelled'
}

export interface InventoryStatus {
  productId: number;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
  soldQuantity: number;
  isAvailable: boolean;
  stockPercentage: number;
}

export interface PurchaseWithDetails extends Purchase {
  product_name: string;
  product_price: number;
  flash_sale_name: string;
  user_email: string;
  created_at?: string;
  updated_at?: string;
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  action?: string;
  resource?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  userRole?: string;
  path?: string;
}
