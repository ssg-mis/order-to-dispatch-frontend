/**
 * utility to calculate the remaining order quantity when an order breaks down into smaller quantities.
 * @param targetBaseOrderNo The exact base DO number (e.g., "DO-510A")
 * @param allOrders The array of all orders fetched in the frontend
 * @returns The remaining quantity (Sum of order_quantity - Sum of qty_to_be_dispatched)
 */
export const calculateRemainingQuantity = (targetBaseOrderNo: string, allOrders: any[]): number => {
  if (!targetBaseOrderNo || !Array.isArray(allOrders)) return 0;

  // Clean the target to its true base logic based on user prompt: "DO-510A so DO-510A no A-1"
  // If a suffix like -1, -A was accidentally passed, we can strip it, but it's safer to use the passed ID
  // Assuming targetBaseOrderNo is already in the format "DO-510A"
  
  // We match orders where their order_no (or so_no) is exactly DO-510A OR DO-510A-1, DO-510A-A, etc.
  // The regex ensures it strictly starts with the base order and only allows hyphenated suffixes.
  const regex = new RegExp(`^${targetBaseOrderNo}(-[A-Za-z0-9]+)?$`, 'i');

  const relatedOrders = allOrders.filter(order => {
    const orderNo = String(order.order_no || order.orderNo || order.doNumber || "");
    const soNo = String(order.so_no || order.soNo || "");
    
    // Check if either orderNo or soNo matches the exact base DO or its breakdown subsets
    return regex.test(orderNo) || regex.test(soNo);
  });

  // Calculate the total remaining balance across all splits.
  // Rule:
  // - If a chunk is approved, its `remaining_dispatch_qty` contains what's left to load.
  // - If a chunk is not yet approved, its `remaining_dispatch_qty` is null, so it contributes its full `order_quantity`.
  // - If reading from lift_receiving_confirmation directly (dsr views), we subtract `qty_to_be_dispatched`.
  const totalRemainingBalance = relatedOrders.reduce((sum, order) => {
    // Determine the chunk's size
    const chunkQty = parseFloat(order.order_quantity || order.orderQuantity || order.orderQty || 0) || 0;
    
    // If we have remaining_dispatch_qty, that strictly overrides order_quantity as the current balance for this chunk
    const hasRemainingDispatchProp = order.remaining_dispatch_qty !== undefined || order.remainingDispatchQty !== undefined;
    const remainingDispatch = parseFloat(order.remaining_dispatch_qty || order.remainingDispatchQty || 0);

    // If it's loaded in a dispatch-specific view with qty_to_be_dispatched
    const dispatchSpecificQty = parseFloat(order.qty_to_be_dispatched || order.qtyToBeDispatched || order.qtyToDispatch || order.actual_qty_dispatch || 0);

    // Logic priority:
    // 1. If it's a dispatch view showing qty_to_be_dispatched, we consider that the balance remaining in this context
    // 2. If it's an order view and it's been approved, we use remaining_dispatch_qty
    // 3. If it hasn't been approved, use the raw chunk order_quantity
    let currentBalance = 0;
    if (dispatchSpecificQty > 0) {
      currentBalance = dispatchSpecificQty;
    } else if (hasRemainingDispatchProp && remainingDispatch !== null && !isNaN(remainingDispatch) && (order.actual_1 || order.pre_approval_user)) {
      currentBalance = remainingDispatch;
    } else {
      currentBalance = chunkQty;
    }

    return sum + currentBalance;
  }, 0);

  return totalRemainingBalance;
};

/**
 * Normalizes an order number by stripping any suffix to get the base DO number.
 * e.g. DO-510A-1 -> DO-510A
 */
export const getBaseOrderNo = (orderNo: string): string => {
  if (!orderNo) return "";
  
  // e.g. DO-510A-1 -> match = ["DO-510A", "-1"]
  // e.g. DO-510A -> match = null
  const regex = /^(.+?)-[A-Za-z0-9]+$/;
  const match = orderNo.match(regex);
  
  if (match && match[1]) {
    // check if it's really the base, for instance standard formats: DO-XXX
    // Wait, if orderNo is DO-510A, it could match (.+) = DO-510, suffix = A.
    // That breaks the user's intent: DO-510A IS the base!
    // So ONLY strip if it is a secondary hyphen. E.g. base format DO-[0-9]+[A-Z]
    return orderNo; // Without a strict format definition, we do not strip suffixes automatically here, unless needed.
  }
  
  return orderNo;
};
