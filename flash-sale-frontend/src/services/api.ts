import axios, { AxiosResponse } from 'axios';

// API Base Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  name?: string;
}

export interface FlashSale {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  is_active: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
  products?: Product[];
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

export interface Purchase {
  id: string;
  userId: string;
  flashSaleId: string;
  quantity: number;
  totalAmount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: User;
    expiresIn: string;
  };
  message: string;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message: string;
  timestamp: string;
}

export interface FlashSalesListResponse {
  flashSales: FlashSale[];
  total: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  timezone?: string;
}

export interface CreateFlashSaleRequest {
  name: string;
  startTime: string;
  endTime: string;
  products: Array<{
    name: string;
    description?: string;
    price: number;
    quantity: number;
  }>;
}

export interface PurchaseRequest {
  flashSaleId: string;
  quantity: number;
}

// Auth API
export const authAPI = {
  login: (data: LoginRequest): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/login', data),
  
  register: (data: RegisterRequest): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/register', data),
  
  logout: (): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/logout'),
  
  getProfile: (): Promise<AxiosResponse<User>> =>
    api.get('/auth/profile'),
};

// Flash Sales API
export const flashSalesAPI = {
  getAll: (): Promise<AxiosResponse<ApiResponse<FlashSalesListResponse>>> =>
    api.get('/flash-sales'),
  
  getActive: (): Promise<AxiosResponse<ApiResponse<FlashSalesListResponse>>> =>
    api.get('/flash-sales/active'),
  
  getById: (id: string): Promise<AxiosResponse<ApiResponse<FlashSale>>> =>
    api.get(`/flash-sales/${id}`),
  
  // Admin endpoints
  create: (data: CreateFlashSaleRequest): Promise<AxiosResponse<ApiResponse<FlashSale>>> =>
    api.post('/flash-sales/admin/create', data),
  
  update: (id: string, data: Partial<CreateFlashSaleRequest>): Promise<AxiosResponse<ApiResponse<FlashSale>>> =>
    api.put(`/flash-sales/${id}`, data),
  
  delete: (id: string): Promise<AxiosResponse<ApiResponse<{ message: string }>>> =>
    api.delete(`/flash-sales/${id}`),

  getAdminStats: (): Promise<AxiosResponse<ApiResponse<{ total_sales: number; active_flash_sales: number }>>> =>
    api.get('/flash-sales/admin/stats'),

  // Purchase endpoints
  attemptPurchase: (data: { userId: string; productId?: number; flashSaleId?: number }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post('/flash-sales/purchase', data),

  getUserPurchaseStatus: (userId: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/flash-sales/user/${userId}/purchase`),

  getUserPurchaseHistory: (userId: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/flash-sales/user/${userId}/history`),

  // Check if user has purchased in a specific flash sale
  getUserFlashSalePurchaseStatus: (userId: string, flashSaleId: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/flash-sales/user/${userId}/flashsale/${flashSaleId}/purchase`),
};

// Products API
export const productsAPI = {
  getProducts: (flashSaleId: number): Promise<AxiosResponse<ApiResponse<Product[]>>> =>
    api.get(`/products?flashSaleId=${flashSaleId}`),
  
  getAll: (): Promise<AxiosResponse<Product[]>> =>
    api.get('/products'),
  
  getById: (id: string): Promise<AxiosResponse<Product>> =>
    api.get(`/products/${id}`),
  
  create: (data: Omit<Product, 'id'>): Promise<AxiosResponse<Product>> =>
    api.post('/products', data),
  
  update: (id: string, data: Partial<Omit<Product, 'id'>>): Promise<AxiosResponse<Product>> =>
    api.put(`/products/${id}`, data),
  
  delete: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/products/${id}`),
};

// Purchases API
export const purchasesAPI = {
  create: (data: PurchaseRequest): Promise<AxiosResponse<Purchase>> =>
    api.post('/purchases', data),
  
  getUserPurchases: (userId: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/flash-sales/user/${userId}/history`),
  
  getAll: (): Promise<AxiosResponse<Purchase[]>> =>
    api.get('/purchases'),
  
  getById: (id: string): Promise<AxiosResponse<Purchase>> =>
    api.get(`/purchases/${id}`),
  
  updateStatus: (id: string, status: Purchase['status']): Promise<AxiosResponse<Purchase>> =>
    api.put(`/purchases/${id}/status`, { status }),
};

// Health Check API
export const healthAPI = {
  check: (): Promise<AxiosResponse<{ status: string; timestamp: string }>> =>
    api.get('/health'),
};

export default api;
