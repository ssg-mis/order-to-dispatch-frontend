/**
 * API Service
 * Centralized API calls for the application
 */

import { API_CONFIG, API_ENDPOINTS } from './api-config';

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  timestamp: string;
}

export interface OrderProduct {
  product_name: string;
  uom?: string;
  order_quantity?: number;
  rate_of_material?: number;
  alternate_uom?: string;
  alternate_qty_kg?: number;
  oil_type?: string;
  rate_per_15kg?: number;
  rate_per_ltr?: number;
  sku_name?: string;
  approval_qty?: number;
  final_rate?: number;
}

export interface CreateOrderRequest {
  customer_name: string;
  order_type: string;
  customer_type?: string;
  order_type_delivery_purpose?: string;
  start_date?: string;
  end_date?: string;
  delivery_date?: string;
  party_so_date?: string;
  customer_contact_person_name?: string;
  customer_contact_person_whatsapp_no?: string;
  customer_address?: string;
  payment_terms?: string;
  advance_payment_to_be_taken?: boolean;
  advance_amount?: number;
  is_order_through_broker?: boolean;
  broker_name?: string;
  type_of_transporting?: string;
  remark?: string;
  products?: OrderProduct[];
  [key: string]: any;
}

export interface CreateOrderResponse {
  order_no: string;
  orders: any[];
}

/**
 * Make HTTP request
 */
async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_CONFIG.baseURL}${endpoint}`;

  const headers: any = {
    ...options.headers,
  };

  // Only set Content-Type to application/json if not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw data;
    }

    return data;
  } catch (error: any) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Order Dispatch API
 */
export const orderApi = {
  /**
   * Create new order
   */
  create: async (orderData: CreateOrderRequest): Promise<ApiResponse<CreateOrderResponse>> => {
    return request(API_ENDPOINTS.orders.create, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  /**
   * Upload file to S3
   */
  uploadFile: async (file: File): Promise<ApiResponse<{ url: string }>> => {
    const formData = new FormData();
    formData.append('file', file);

    return request(API_ENDPOINTS.orders.upload, {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Get all orders with pagination
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    order_type?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(API_ENDPOINTS.orders.getAll + queryString);
  },

  /**
   * Get order by order number
   */
  getByOrderNumber: async (orderNo: string): Promise<ApiResponse> => {
    return request(API_ENDPOINTS.orders.getByOrderNumber(orderNo));
  },

  /**
   * Update order
   */
  update: async (id: number, updateData: Partial<CreateOrderRequest>): Promise<ApiResponse> => {
    return request(API_ENDPOINTS.orders.update(id), {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  /**
   * Delete order
   */
  delete: async (id: number): Promise<ApiResponse> => {
    return request(API_ENDPOINTS.orders.delete(id), {
      method: 'DELETE',
    });
  },

  /**
   * Get all suffixes for a given order prefix
   */
  getSuffixes: async (prefix: string): Promise<ApiResponse<string[]>> => {
    return request(API_ENDPOINTS.orders.getSuffixes(prefix));
  },
};

/**
 * Pre-Approval API
 */
export const preApprovalApi = {
  /**
   * Get pending pre-approvals
   */
  getPending: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/pre-approval/pending${queryString}`);
  },

  /**
   * Get pre-approval history
   */
  getHistory: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/pre-approval/history${queryString}`);
  },

  /**
   * Submit pre-approval
   */
  submit: async (id: number, data?: any): Promise<ApiResponse> => {
    return request(`/pre-approval/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },
};

/**
 * Order Approval API (Stage 3)
 */
export const approvalApi = {
  /**
   * Get pending approvals
   */
  getPending: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/approval/pending${queryString}`);
  },

  /**
   * Get approval history
   */
  getHistory: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/approval/history${queryString}`);
  },

  /**
   * Get dynamic filter options for Approval stage
   */
  getFilters: async (): Promise<ApiResponse> => {
    return request('/approval/filters');
  },

  /**
   * Get approval by ID
   */
  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/approval/${id}`);
  },

  /**
   * Submit approval
   */
  submit: async (id: number, data?: any): Promise<ApiResponse> => {
    return request(`/approval/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },
};

/**
 * Dispatch Planning API (Stage 4)
 */
export const dispatchPlanningApi = {
  /**
   * Get pending dispatch planning
   */
  getPending: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/dispatch-planning/pending${queryString}`);
  },

  /**
   * Get dispatch planning history
   */
  getHistory: async (params?: {
    page?: number;
    limit?: number;
    order_no?: string;
    customer_name?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/dispatch-planning/history${queryString}`);
  },

  /**
   * Submit dispatch planning
   */
  submit: async (id: number, data?: any): Promise<ApiResponse> => {
    return request(`/dispatch-planning/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  /**
   * Revert dispatch planning to pre-approval
   */
  revert: async (id: number, username: string, remarks?: string): Promise<ApiResponse> => {
    return request(`/dispatch-planning/revert/${id}`, {
      method: 'POST',
      body: JSON.stringify({ username, remarks }),
    });
  },

  /**
   * Update transfer details for an order
   */
  updateTransferDetails: async (id: number, data: any): Promise<ApiResponse> => {
    return request(`/dispatch-planning/update-transfer/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

/**
 * Actual Dispatch API (Stage 5)
 */
export const actualDispatchApi = {
  /**
   * Get pending actual dispatches
   */
  getPending: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    party_name?: string;
    depo_names?: string[];
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/actual-dispatch/pending${queryString}`);
  },

  /**
   * Get actual dispatch history
   */
  getHistory: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    party_name?: string;
    depo_names?: string[];
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/actual-dispatch/history${queryString}`);
  },

  /**
   * Submit actual dispatch
   */
  submit: async (dsrNumber: string, data?: any): Promise<ApiResponse> => {
    return request(`/actual-dispatch/submit/${dsrNumber}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  /**
   * Revert actual dispatch
   */
  revert: async (dsrNumber: string, username: string, remarks?: string): Promise<ApiResponse> => {
    return request(`/actual-dispatch/revert/${dsrNumber}`, {
      method: 'POST',
      body: JSON.stringify({ username, remarks }),
    });
  },

  /**
   * Get unique filter options for Actual Dispatch
   */
  getFilters: async (): Promise<ApiResponse> => {
    return request('/actual-dispatch/filters');
  },
};

/**
 * Vehicle Details API (Stage 6)
 */
export const vehicleDetailsApi = {
  /**
   * Get pending vehicle details
   */
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/vehicle-details/pending${queryString}`);
  },

  /**
   * Get vehicle details history
   */
  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/vehicle-details/history${queryString}`);
  },

  /**
   * Get vehicle details by ID
   */
  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/vehicle-details/${id}`);
  },

  /**
   * Submit vehicle details
   */
  submit: async (id: number, data?: any): Promise<ApiResponse> => {
    return request(`/vehicle-details/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },
};

/**
 * Material Load API (Stage 7)
 */
export const materialLoadApi = {
  /**
   * Get pending material loads
   */
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/material-load/pending${queryString}`);
  },

  /**
   * Get material load history
   */
  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';

    return request(`/material-load/history${queryString}`);
  },

  /**
   * Get material load by ID
   */
  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/material-load/${id}`);
  },

  /**
   * Submit material load
   */
  submit: async (id: number, data?: any): Promise<ApiResponse> => {
    return request(`/material-load/submit/${id}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },
};

/**
 * Security Guard Approval API (Stage 8)
 */
export const securityGuardApprovalApi = {
  /**
   * Get pending security guard approvals
   */
  getPending: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    customer_name?: string;
    depo_names?: string[];
  }): Promise<ApiResponse> => {
    let url = '/security-approval/pending?';
    if (params) {
      const { page, limit, search, customer_name, depo_names } = params;
      if (page) url += `page=${page}&`;
      if (limit) url += `limit=${limit}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (customer_name) url += `customer_name=${encodeURIComponent(customer_name)}&`;
      if (depo_names && depo_names.length > 0) {
        depo_names.forEach(d => url += `depo_names=${encodeURIComponent(d)}&`);
      }
    }
    return request(url.endsWith('&') || url.endsWith('?') ? url.slice(0, -1) : url);
  },

  /**
   * Get security guard approval history
   */
  getHistory: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    customer_name?: string;
    depo_names?: string[];
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse> => {
    let url = '/security-approval/history?';
    if (params) {
      const { page, limit, search, customer_name, depo_names, start_date, end_date } = params;
      if (page) url += `page=${page}&`;
      if (limit) url += `limit=${limit}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (customer_name) url += `customer_name=${encodeURIComponent(customer_name)}&`;
      if (depo_names && depo_names.length > 0) {
        depo_names.forEach(d => url += `depo_names=${encodeURIComponent(d)}&`);
      }
      if (start_date) url += `start_date=${start_date}&`;
      if (end_date) url += `end_date=${end_date}&`;
    }
    return request(url.endsWith('&') || url.endsWith('?') ? url.slice(0, -1) : url);
  },

  /**
   * Get security guard filter options
   */
  getFilters: async (): Promise<ApiResponse> => {
    return request('/security-approval/filters');
  },

  /**
   * Get security guard approval by ID
   */
  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/security-approval/${id}`);
  },

  /**
   * Submit security guard approval
   */
  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/security-approval/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

/**
 * Make Invoice API (Stage 9)
 */
export const makeInvoiceApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/make-invoice/pending${queryString}`);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/make-invoice/history${queryString}`);
  },

  getById: async (id: number | string): Promise<ApiResponse> => {
    return request(`/make-invoice/${id}`);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/make-invoice/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

/**
 * Check Invoice API (Stage 10)
 */
export const checkInvoiceApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/check-invoice/pending${queryString}`);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/check-invoice/history${queryString}`);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/check-invoice/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

/**
 * Gate Out API (Stage 11)
 */
export const gateOutApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/gate-out/pending${queryString}`);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/gate-out/history${queryString}`);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/gate-out/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

/**
 * Confirm Material Receipt API (Stage 12)
 */
export const confirmMaterialReceiptApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    depo_names?: string[];
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/confirm-receipt/pending${queryString}`);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
    depo_names?: string[];
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/confirm-receipt/history${queryString}`);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/confirm-receipt/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

/**
 * Damage Adjustment API (Stage 13)
 */
export const damageAdjustmentApi = {
  getPending: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/damage-adjustment/pending${queryString}`);
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/damage-adjustment/history${queryString}`);
  },

  submit: async (id: number | string, data: any): Promise<ApiResponse> => {
    return request(`/damage-adjustment/submit/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

/**
 * User Management API
 */
export const userApi = {
  /**
   * Get all users
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    search?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/users${queryString}`);
  },

  /**
   * Get user by ID
   */
  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/users/${id}`);
  },

  /**
   * Create new user
   */
  create: async (userData: {
    username: string;
    password: string;
    email: string;
    phone_no?: string;
    status?: string;
    role: string;
    page_access?: string[];
  }): Promise<ApiResponse> => {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  /**
   * Update user
   */
  update: async (id: number, userData: any): Promise<ApiResponse> => {
    return request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  /**
   * Delete user
   */
  delete: async (id: number): Promise<ApiResponse> => {
    return request(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Login user
   */
  login: async (credentials: { username: string; password: string }): Promise<ApiResponse> => {
    return request('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  /**
   * Get page access options
   */
  getPageAccessOptions: async (): Promise<ApiResponse> => {
    return request('/users/page-access-options');
  },
};

/**
 * Customer API
 */
export const customerApi = {
  /**
   * Get all customers
   */
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/customers${queryString}`);
  },

  /**
   * Get customer by ID
   */
  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/customers/${id}`);
  },

  /**
   * Get customer by name
   */
  getByName: async (name: string): Promise<ApiResponse> => {
    return request(`/customers/name/${encodeURIComponent(name)}`);
  },

  /**
   * Create new customer
   */
  create: async (data: any): Promise<ApiResponse> => {
    return request('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update customer
   */
  update: async (id: number, data: any): Promise<ApiResponse> => {
    return request(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete customer
   */
  delete: async (id: number): Promise<ApiResponse> => {
    return request(`/customers/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * SKU API
 */
export const skuApi = {
  /**
   * Get all SKUs
   */
  getAll: async (params?: {
    all?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/skus${queryString}`);
  },

  /**
   * Get SKU by ID
   */
  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/skus/${id}`);
  },

  /**
   * Get all SKU rates with formulas
   */
  getAllSkuRates: async (): Promise<ApiResponse> => {
    return request('/skus/rates/all');
  },
};

/**
 * Depot API
 */
export const depotApi = {
  /**
   * Get all depots
   */
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/depots${queryString}`);
  },

  /**
   * Get depot by ID
   */
  getById: async (id: string): Promise<ApiResponse> => {
    return request(`/depots/${id}`);
  },

  /**
   * Get depot by name
   */
  getByName: async (name: string): Promise<ApiResponse> => {
    return request(`/depots/name/${encodeURIComponent(name)}`);
  },

  /**
   * Create new depot
   */
  create: async (data: any): Promise<ApiResponse> => {
    return request('/depots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update depot
   */
  update: async (id: string, data: any): Promise<ApiResponse> => {
    return request(`/depots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete depot
   */
  delete: async (id: string): Promise<ApiResponse> => {
    return request(`/depots/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Broker API
 */
export const brokerApi = {
  /**
   * Get all brokers
   */
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/brokers${queryString}`);
  },

  /**
   * Get broker by ID
   */
  getById: async (id: string): Promise<ApiResponse> => {
    return request(`/brokers/${id}`);
  },

  /**
   * Get broker by salesman name
   */
  getByName: async (name: string): Promise<ApiResponse> => {
    return request(`/brokers/name/${encodeURIComponent(name)}`);
  },

  /**
   * Create new broker
   */
  create: async (data: any): Promise<ApiResponse> => {
    return request('/brokers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update broker
   */
  update: async (id: string, data: any): Promise<ApiResponse> => {
    return request(`/brokers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete broker
   */
  delete: async (id: string): Promise<ApiResponse> => {
    return request(`/brokers/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * SKU Details API
 */
export const skuDetailsApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/sku-details${queryString}`);
  },

  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/sku-details/${id}`);
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/sku-details', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: any): Promise<ApiResponse> => {
    return request(`/sku-details/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<ApiResponse> => {
    return request(`/sku-details/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * SKU Selling Price API
 */
export const skuSellingPriceApi = {
  /**
   * Get all SKU selling prices (landing cost + margin)
   */
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/skus/sku-selling-price${queryString}`);
  },

  /**
   * Update SKU selling price
   */
  update: async (id: number, data: any): Promise<ApiResponse> => {
    return request(`/skus/sku-selling-price/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Create SKU selling price
   */
  create: async (data: any): Promise<ApiResponse> => {
    return request('/skus/sku-selling-price', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete SKU selling price
   */
  delete: async (id: number): Promise<ApiResponse> => {
    return request(`/skus/sku-selling-price/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Common API
 */
export const commonApi = {
  getNextId: async (type: 'customer' | 'depot' | 'broker' | 'sku' | 'salesperson'): Promise<ApiResponse<{ nextId: string; type: string; prefix: string }>> => {
    return request(`/common/next-id?type=${type}`);
  },
};


/**
 * Variable Calculation API (Input Parameters)
 */
export const varCalcApi = {
  /**
   * Get latest calculation variables
   */
  getLatest: async (): Promise<ApiResponse> => {
    return request('/common/var-calc/latest');
  },

  /**
   * Save calculation variables
   */
  save: async (data: any): Promise<ApiResponse> => {
    return request('/common/var-calc', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get all calculation variables (history)
   */
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/common/var-calc/history${queryString}`);
  },
};

/**
 * Salesperson API
 */
export const salespersonApi = {
  getAll: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/salespersons${queryString}`);
  },

  getById: async (id: string): Promise<ApiResponse> => {
    return request(`/salespersons/${id}`);
  },

  create: async (data: any): Promise<ApiResponse> => {
    return request('/salespersons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: any): Promise<ApiResponse> => {
    return request(`/salespersons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<ApiResponse> => {
    return request(`/salespersons/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Dashboard API
 */
export const dashboardApi = {
  getStats: async (): Promise<ApiResponse> => {
    return request(API_ENDPOINTS.dashboard.stats);
  },
  getOverview: async (): Promise<ApiResponse> => {
    return request(API_ENDPOINTS.dashboard.overview);
  },
};

/**
 * Reports API
 */
export const reportsApi = {
  getReport: async (params?: any): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`${API_ENDPOINTS.reports.get}${queryString}`);
  },
};

// ============================================================
// COMMITMENT PUNCH API
// ============================================================
export const commitmentPunchApi = {
  create: async (data: any): Promise<ApiResponse> =>
    request('/commitment-punch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAll: async (params?: { page?: number; limit?: number; party_name?: string; search?: string }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/commitment-punch${queryString}`);
  },

  getPending: async (params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse> => {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return request(`/commitment-punch/pending${queryString}`);
  },

  processCommitment: async (id: number, data: any): Promise<ApiResponse> =>
    request(`/commitment-punch/${id}/process`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getDetails: async (id: number): Promise<ApiResponse> =>
    request(`/commitment-punch/${id}/details`),
};

export default {
  dashboard: dashboardApi,
  reports: reportsApi,
  order: orderApi,
  preApproval: preApprovalApi,
  approval: approvalApi,
  dispatchPlanning: dispatchPlanningApi,
  actualDispatch: actualDispatchApi,
  vehicleDetails: vehicleDetailsApi,
  materialLoad: materialLoadApi,
  securityGuardApproval: securityGuardApprovalApi,
  makeInvoice: makeInvoiceApi,
  checkInvoice: checkInvoiceApi,
  gateOut: gateOutApi,
  confirmMaterialReceipt: confirmMaterialReceiptApi,
  skuDetails: skuDetailsApi,
  skuSellingPrice: skuSellingPriceApi,
  common: commonApi,
  varCalc: varCalcApi,
  salesperson: salespersonApi,
  commitmentPunch: commitmentPunchApi,
};


