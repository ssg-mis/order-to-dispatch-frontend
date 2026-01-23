# Frontend-Backend Integration Guide

## Overview

The Order Punch frontend form is now fully integrated with the backend API. Orders are saved to PostgreSQL database with automatic order number generation.

## Files Created/Modified

### 1. Environment Configuration

**File:** [.env.local](file:///Users/vikaschoudhary/Documents/shri-shyam-projects/order-dispatch/frontend/ordermanagementsystem/.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1
NEXT_PUBLIC_ENV=development
```

### 2. API Configuration

**File:** [lib/api-config.ts](file:///Users/vikaschoudhary/Documents/shri-shyam-projects/order-dispatch/frontend/ordermanagementsystem/lib/api-config.ts)

- Centralized API configuration
- Base URL from environment variables
- Endpoint definitions

### 3. API Service

**File:** [lib/api-service.ts](file:///Users/vikaschoudhary/Documents/shri-shyam-projects/order-dispatch/frontend/ordermanagementsystem/lib/api-service.ts)

- Type-safe API functions
- Order creation, fetching, updating, deleting
- Error handling
- Request/response types

### 4. Order Punch Integration

**File:** [app/order-punch/page.tsx](file:///Users/vikaschoudhary/Documents/shri-shyam-projects/order-dispatch/frontend/ordermanagementsystem/app/order-punch/page.tsx)

**Changes:**

- Integrated `orderApi.create()` call in `handleSubmit`
- Transforms frontend form data to backend API format
- Handles single and multiple products
- Uses backend-generated order number (DO-XXX)
- Displays success/error messages

## Data Flow

```
Frontend Form
    ↓
Transform Data (frontend → backend format)
    ↓
POST /api/v1/orders
    ↓
Backend Validates
    ↓
Generate Order Number (DO-001, DO-002, etc.)
    ↓
Assign Serial Letters (A, B, C for multiple products)
    ↓
Save to PostgreSQL Database
    ↓
Return Order Number
    ↓
Update Frontend UI
```

## How It Works

### 1. Form Submission

When user clicks "Save Order":

1. Form validates required fields
2. Transforms data to API format
3. Calls `orderApi.create(orderData)`
4. Waits for response

### 2. Data Transformation

**Frontend Format → Backend Format:**

```typescript
// Frontend (from form state)
{
  products: [
    { productName: "Oil 1", orderQty: "100", rate: "150" }
  ]
}

// Backend (API request)
{
  customer_name: "ABC Corp",
  order_type: "regular",
  products: [
    {
      product_name: "Oil 1",
      order_quantity: 100,
      rate_of_material: 150
    }
  ]
}
```

### 3. Multiple Products

When submitting multiple products, they all get:

- **Same Order Number**: DO-001
- **Different Serials**: A, B, C, etc.

**Example:**

```typescript
// Form has 3 products
products: [
  { productName: "Sunflower Oil", orderQty: "1000" },
  { productName: "Mustard Oil", orderQty: "500" },
  { productName: "Coconut Oil", orderQty: "200" },
];

// Backend creates 3 rows:
// Row 1: DO-001, Serial A, "Sunflower Oil"
// Row 2: DO-001, Serial B, "Mustard Oil"
// Row 3: DO-001, Serial C, "Coconut Oil"
```

### 4. Response Handling

**Success:**

```typescript
{
  success: true,
  message: "Order created successfully",
  data: {
    order_no: "DO-001",
    orders: [...]
  }
}
```

**Error:**

```typescript
{
  success: false,
  message: "Validation failed",
  errors: [
    { field: "customer_name", message: "customer_name is required" }
  ]
}
```

## Field Mapping

| Frontend Field      | Backend Field                       | Type    |
| ------------------- | ----------------------------------- | ------- |
| customerName        | customer_name                       | string  |
| orderType           | order_type                          | string  |
| customerType        | customer_type                       | string  |
| orderPurpose        | order_type_delivery_purpose         | string  |
| startDate           | start_date                          | date    |
| endDate             | end_date                            | date    |
| deliveryDate        | delivery_date                       | date    |
| soDate              | party_so_date                       | date    |
| contactPerson       | customer_contact_person_name        | string  |
| whatsappNo          | customer_contact_person_whatsapp_no | string  |
| customerAddress     | customer_address                    | string  |
| paymentTerms        | payment_terms                       | string  |
| advancePaymentTaken | advance_payment_to_be_taken         | boolean |
| advanceAmount       | advance_amount                      | number  |
| isBrokerOrder       | is_order_through_broker             | boolean |
| brokerName          | broker_name                         | string  |
| transportType       | type_of_transporting                | string  |

### Product Fields

| Frontend Field | Backend Field    | Type   |
| -------------- | ---------------- | ------ |
| productName    | product_name     | string |
| uom            | uom              | string |
| orderQty       | order_quantity   | number |
| rate           | rate_of_material | number |
| altUom         | alternate_uom    | string |
| altQty         | alternate_qty_kg | number |

### Pre-Approval Product Fields

| Frontend Field | Backend Field | Type   |
| -------------- | ------------- | ------ |
| oilType        | oil_type      | string |
| oilType        | product_name  | string |
| ratePerLtr     | rate_per_ltr  | number |
| rateLtr        | rate_per_15kg | number |

## Testing the Integration

### 1. Start Backend Server

```bash
cd backend
npm run dev
```

Server should show:

```
✅ Database connected successfully
🚀 Server started successfully
📍 Running on: http://localhost:5001
```

### 2. Start Frontend Server

```bash
cd frontend/ordermanagementsystem
npm run dev
```

### 3. Test Order Creation

1. Navigate to `/order-punch`
2. Fill in the form:
   - Select Order Type: "Regular"
   - Enter Customer Name
   - Add products
3. Click "Save Order"
4. Should see success message with order number (DO-001, DO-002, etc.)

### 4. Verify in Database

Check PostgreSQL database:

```sql
SELECT * FROM order_dispatch ORDER BY id DESC LIMIT 10;
```

You should see your order with:

- `order_no`: DO-001, DO-002, etc.
- `serial`: A, B, C (for multiple products)
- All form data saved

## Environment Variables

### Development (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1
NEXT_PUBLIC_ENV=development
```

### Production

```env
NEXT_PUBLIC_API_URL=https://your-production-api.com/api/v1
NEXT_PUBLIC_ENV=production
```

## Error Handling

### Network Error

```
Error Saving Order
Failed to save order to database. Please try again.
```

### Validation Error

```
Validation Error
Please fill in all required fields.
```

### Backend Error

```
Error Saving Order
[Specific error message from backend]
```

## API Service Usage

### Create Order

```typescript
import { orderApi } from '@/lib/api-service'

const result = await orderApi.create({
  customer_name: "ABC Corp",
  order_type: "regular",
  products: [...]
})
```

### Get All Orders

```typescript
const result = await orderApi.getAll({
  page: 1,
  limit: 10,
  customer_name: "ABC",
});
```

### Get Order by Number

```typescript
const result = await orderApi.getByOrderNumber("DO-001");
```

## Compatibility

The integration maintains backward compatibility:

- LocalStorage workflow still works
- Existing pages continue to function
- Backend-generated order number replaces local generation

## Next Steps

1. **Test the integration** with various scenarios
2. **Add loading states** during API calls
3. **Implement retry logic** for failed requests
4. **Add offline support** (queue orders when offline)
5. **Display recent orders** from database instead of localStorage

## Troubleshooting

### CORS Error

Ensure backend allows frontend origin:

```env
# Backend .env
CORS_ORIGIN=http://localhost:3000
```

### 404 Not Found

Check API URL in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1
```

### Network Error

Ensure backend server is running on port 5001

### Database Error

Check PostgreSQL connection in backend

---

✅ **Frontend is now connected to backend!**
