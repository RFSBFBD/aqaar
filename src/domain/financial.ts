/**
 * Financial calculation utilities using BigInt for precision.
 * All monetary values are represented in minor currency units (e.g., fils/cents).
 * 
 * RULES:
 * - No float/JS number for financial calculations
 * - All amounts are BigInt
 * - Serialization to JSON uses decimal strings
 */

/** Maximum discount percentage (5%) */
const MAX_DISCOUNT_PERCENTAGE = 5n;
const PERCENTAGE_BASE = 100n;

/**
 * Validates that a discount does not exceed 5% of the unit price.
 */
export function validateDiscount(unitPrice: bigint, discount: bigint): { valid: boolean; message?: string } {
  if (unitPrice <= 0n) {
    return { valid: false, message: 'سعر الوحدة يجب أن يكون موجباً' };
  }
  if (discount < 0n) {
    return { valid: false, message: 'الخصم لا يمكن أن يكون سالباً' };
  }
  const maxDiscount = (unitPrice * MAX_DISCOUNT_PERCENTAGE) / PERCENTAGE_BASE;
  if (discount > maxDiscount) {
    return { valid: false, message: `الخصم لا يمكن أن يتجاوز 5% من سعر الوحدة (الحد الأقصى: ${maxDiscount.toString()})` };
  }
  return { valid: true };
}

/**
 * Calculates the final price after discount.
 * finalPrice = unitPrice - discount
 */
export function calculateFinalPrice(unitPrice: bigint, discount: bigint): bigint {
  if (unitPrice <= 0n) {
    throw new Error('سعر الوحدة يجب أن يكون موجباً');
  }
  if (discount < 0n || discount > unitPrice) {
    throw new Error('قيمة الخصم غير صالحة');
  }
  return unitPrice - discount;
}

/**
 * Validates down payment bounds.
 * 0 <= downPayment <= finalPrice
 */
export function validateDownPayment(finalPrice: bigint, downPayment: bigint): { valid: boolean; message?: string } {
  if (downPayment < 0n) {
    return { valid: false, message: 'الدفعة الأولى لا يمكن أن تكون سالبة' };
  }
  if (downPayment > finalPrice) {
    return { valid: false, message: 'الدفعة الأولى لا يمكن أن تتجاوز السعر النهائي' };
  }
  return { valid: true };
}

/**
 * Calculates remaining amount after down payment.
 */
export function calculateRemainingAmount(finalPrice: bigint, downPayment: bigint): bigint {
  return finalPrice - downPayment;
}

/**
 * Generates installment amounts with deterministic remainder distribution.
 * 
 * Strategy: Integer division for base amount, remainder distributed
 * to the FIRST N installments (each gets +1 minor unit).
 * This ensures sum of all installments === remaining exactly.
 * 
 * @param remaining - Total remaining amount in minor units
 * @param count - Number of installments (must be > 0)
 * @returns Array of installment amounts (BigInt)
 */
export function generateInstallmentAmounts(remaining: bigint, count: number): bigint[] {
  if (count <= 0) {
    throw new Error('عدد الأقساط يجب أن يكون أكبر من صفر');
  }
  if (remaining < 0n) {
    throw new Error('المبلغ المتبقي لا يمكن أن يكون سالباً');
  }
  if (remaining === 0n) {
    return Array(count).fill(0n);
  }

  const countBig = BigInt(count);
  const baseAmount = remaining / countBig;
  const remainder = remaining % countBig;

  const amounts: bigint[] = [];
  for (let i = 0; i < count; i++) {
    // First `remainder` installments get +1 minor unit
    amounts.push(i < Number(remainder) ? baseAmount + 1n : baseAmount);
  }

  return amounts;
}

/**
 * Validates that installment amounts sum to exactly the remaining amount.
 */
export function validateInstallmentSum(amounts: bigint[], expectedTotal: bigint): boolean {
  const sum = amounts.reduce((acc, val) => acc + val, 0n);
  return sum === expectedTotal;
}

/**
 * Allocates a payment to installments, oldest first (FIFO).
 * Returns allocation details and updated installment paid amounts.
 * 
 * @param paymentAmount - Payment amount in minor units (must be positive)
 * @param installments - Array of installments sorted by sequence number (oldest first)
 *                       Each has: id, amount, paidAmount
 * @returns Allocation details
 */
export function allocatePayment(
  paymentAmount: bigint,
  installments: Array<{ id: string; amount: bigint; paidAmount: bigint }>
): {
  allocations: Array<{ installmentId: string; amount: bigint }>;
  updatedInstallments: Array<{ id: string; newPaidAmount: bigint; newStatus: 'PENDING' | 'PARTIAL' | 'PAID' }>;
} {
  if (paymentAmount <= 0n) {
    throw new Error('مبلغ الدفعة يجب أن يكون موجباً');
  }

  const allocations: Array<{ installmentId: string; amount: bigint }> = [];
  const updatedInstallments: Array<{ id: string; newPaidAmount: bigint; newStatus: 'PENDING' | 'PARTIAL' | 'PAID' }> = [];
  let remaining = paymentAmount;

  for (const inst of installments) {
    if (remaining <= 0n) break;

    const unpaid = inst.amount - inst.paidAmount;
    if (unpaid <= 0n) continue;

    const allocated = remaining >= unpaid ? unpaid : remaining;
    remaining -= allocated;

    const newPaidAmount = inst.paidAmount + allocated;
    let newStatus: 'PENDING' | 'PARTIAL' | 'PAID';
    if (newPaidAmount >= inst.amount) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0n) {
      newStatus = 'PARTIAL';
    } else {
      newStatus = 'PENDING';
    }

    allocations.push({ installmentId: inst.id, amount: allocated });
    updatedInstallments.push({ id: inst.id, newPaidAmount, newStatus });
  }

  if (remaining > 0n) {
    throw new Error('مبلغ الدفعة يتجاوز المتبقي من الأقساط');
  }

  return { allocations, updatedInstallments };
}

/**
 * Calculates total remaining balance for a contract.
 */
export function calculateContractBalance(
  installments: Array<{ amount: bigint; paidAmount: bigint }>
): bigint {
  return installments.reduce((acc, inst) => acc + (inst.amount - inst.paidAmount), 0n);
}

/**
 * Validates that a payment does not exceed the total remaining balance.
 */
export function validatePaymentAmount(
  paymentAmount: bigint,
  totalRemaining: bigint
): { valid: boolean; message?: string } {
  if (paymentAmount <= 0n) {
    return { valid: false, message: 'مبلغ الدفعة يجب أن يكون موجباً' };
  }
  if (paymentAmount > totalRemaining) {
    return { valid: false, message: 'مبلغ الدفعة يتجاوز المتبقي من العقد' };
  }
  return { valid: true };
}

/**
 * Converts a BigInt to a decimal string for JSON serialization.
 */
export function bigIntToString(value: bigint): string {
  return value.toString();
}

/**
 * Parses a decimal string to BigInt. Validates that it's a valid integer string.
 */
export function stringToBigInt(value: string): bigint {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`قيمة غير صالحة: ${trimmed}`);
  }
  return BigInt(trimmed);
}
