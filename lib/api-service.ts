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
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
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
  }): Promise<ApiResponse> => {
    const queryString = params 
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    
    return request(`/approval/history${queryString}`);
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
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
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
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
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
    d_sr_number?: string;
    so_no?: string;
    party_name?: string;
  }): Promise<ApiResponse> => {
    const queryString = params 
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    
    return request(`/security-approval/pending${queryString}`);
  },

  /**
   * Get security guard approval history
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
    
    return request(`/security-approval/history${queryString}`);
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
  getAll: async (): Promise<ApiResponse> => {
    return request('/customers');
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
};

/**
 * SKU API
 */
export const skuApi = {
  /**
   * Get all SKUs
   */
  getAll: async (): Promise<ApiResponse> => {
    return request('/skus');
  },

  /**
   * Get SKU by ID
   */
  getById: async (id: number): Promise<ApiResponse> => {
    return request(`/skus/${id}`);
  },
};

/**
 * Depot API
 */
export const depotApi = {
  /**
   * Get all depots
   */
  getAll: async (): Promise<ApiResponse> => {
    return request('/depots');
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
};

/**
 * Broker API
 */
export const brokerApi = {
  /**
   * Get all brokers
   */
  getAll: async (): Promise<ApiResponse> => {
    return request('/brokers');
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
};

export default {
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
  damageAdjustment: damageAdjustmentApi,
  user: userApi,
  customer: customerApi,
  sku: skuApi,
  depot: depotApi,
  broker: brokerApi,
};
