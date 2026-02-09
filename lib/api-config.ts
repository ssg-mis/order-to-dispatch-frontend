/**
 * API Configuration
 */

export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1',
  timeout: 30000, // 30 seconds
};

export const API_ENDPOINTS = {
  // Order Dispatch Endpoints
  orders: {
    create: '/orders',
    getAll: '/orders',
    getByOrderNumber: (orderNo: string) => `/orders/${orderNo}`,
    update: (id: number) => `/orders/update/${id}`,
    delete: (id: number) => `/orders/delete/${id}`,
    upload: '/upload',
  },
  
  // Pre-Approval Endpoints
  preApproval: {
    pending: '/pre-approval/pending',
    history: '/pre-approval/history',
    submit: (id: number) => `/pre-approval/submit/${id}`,
  },
  
  // Approval Endpoints (Stage 3)
  approval: {
    pending: '/approval/pending',
    history: '/approval/history',
    submit: (id: number) => `/approval/submit/${id}`,
    getById: (id: number) => `/approval/${id}`,
  },
  
  // Dispatch Planning Endpoints (Stage 4)
  dispatchPlanning: {
    pending: '/dispatch-planning/pending',
    history: '/dispatch-planning/history',
    submit: (id: number) => `/dispatch-planning/submit/${id}`,
  },
  
  // Actual Dispatch Endpoints (Stage 5)
  actualDispatch: {
    pending: '/actual-dispatch/pending',
    history: '/actual-dispatch/history',
    submit: (dsrNumber: string) => `/actual-dispatch/submit/${dsrNumber}`,
  },
};
