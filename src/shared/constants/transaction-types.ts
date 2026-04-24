/**
 * Transaction Types Constants
 * 
 * Defines all supported transaction types for balance operations.
 * These constants ensure consistency across the application.
 * 
 * Why this exists:
 * - Centralizes transaction type definitions
 * - Prevents magic strings throughout the codebase
 * - Enables easy addition of new transaction types
 * - Provides type safety for transaction operations
 */

export const TRANSACTION_TYPES = {
  DEDUCTION: 'deduction',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
  ACCRUAL: 'accrual',
  CORRECTION: 'correction',
  BONUS: 'bonus',
} as const;

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

export const TRANSACTION_TYPE_NAMES = {
  [TRANSACTION_TYPES.DEDUCTION]: 'Time-Off Deduction',
  [TRANSACTION_TYPES.REFUND]: 'Time-Off Refund',
  [TRANSACTION_TYPES.ADJUSTMENT]: 'Balance Adjustment',
  [TRANSACTION_TYPES.ACCRUAL]: 'Balance Accrual',
  [TRANSACTION_TYPES.CORRECTION]: 'Balance Correction',
  [TRANSACTION_TYPES.BONUS]: 'Bonus Time-Off',
} as const;

export const TRANSACTION_TYPE_DESCRIPTIONS = {
  [TRANSACTION_TYPES.DEDUCTION]: 'Time-off deducted from employee balance',
  [TRANSACTION_TYPES.REFUND]: 'Time-off refunded to employee balance',
  [TRANSACTION_TYPES.ADJUSTMENT]: 'Manual balance adjustment by administrator',
  [TRANSACTION_TYPES.ACCRUAL]: 'Automatic time-off accrual based on policy',
  [TRANSACTION_TYPES.CORRECTION]: 'Balance correction for data entry errors',
  [TRANSACTION_TYPES.BONUS]: 'Additional time-off awarded as bonus',
} as const;

export const VALID_TRANSACTION_TYPES = Object.values(TRANSACTION_TYPES);

/**
 * Check if a string is a valid transaction type
 * @param type - Transaction type string
 * @returns True if valid
 */
export function isValidTransactionType(type: string): type is TransactionType {
  return VALID_TRANSACTION_TYPES.includes(type as TransactionType);
}

/**
 * Get transaction type display name
 * @param type - Transaction type
 * @returns Display name
 */
export function getTransactionTypeName(type: TransactionType): string {
  return TRANSACTION_TYPE_NAMES[type];
}

/**
 * Get transaction type description
 * @param type - Transaction type
 * @returns Description
 */
export function getTransactionTypeDescription(type: TransactionType): string {
  return TRANSACTION_TYPE_DESCRIPTIONS[type];
}

/**
 * Check if transaction type affects balance positively
 * @param type - Transaction type
 * @returns True if balance increases
 */
export function isPositiveTransaction(type: TransactionType): boolean {
  const positiveTypes: TransactionType[] = [
    TRANSACTION_TYPES.REFUND,
    TRANSACTION_TYPES.ADJUSTMENT,
    TRANSACTION_TYPES.ACCRUAL,
    TRANSACTION_TYPES.BONUS,
  ];
  return positiveTypes.includes(type);
}

/**
 * Check if transaction type affects balance negatively
 * @param type - Transaction type
 * @returns True if balance decreases
 */
export function isNegativeTransaction(type: TransactionType): boolean {
  const negativeTypes: TransactionType[] = [
    TRANSACTION_TYPES.DEDUCTION,
    TRANSACTION_TYPES.CORRECTION,
  ];
  return negativeTypes.includes(type);
}
