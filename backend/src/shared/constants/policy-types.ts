/**
 * Policy Types Constants
 * 
 * Defines all supported time-off policy types and their properties.
 * These constants ensure consistency across the application.
 * 
 * Why this exists:
 * - Centralizes policy type definitions
 * - Prevents magic strings throughout the codebase
 * - Enables easy addition of new policy types
 * - Provides type safety for policy operations
 */

export const POLICY_TYPES = {
  VACATION: 'vacation',
  SICK: 'sick',
  PERSONAL: 'personal',
  BEREAVEMENT: 'bereavement',
} as const;

export type PolicyType = typeof POLICY_TYPES[keyof typeof POLICY_TYPES];

export const POLICY_TYPE_NAMES = {
  [POLICY_TYPES.VACATION]: 'Vacation Leave',
  [POLICY_TYPES.SICK]: 'Sick Leave',
  [POLICY_TYPES.PERSONAL]: 'Personal Leave',
  [POLICY_TYPES.BEREAVEMENT]: 'Bereavement Leave',
} as const;

export const POLICY_TYPE_DESCRIPTIONS = {
  [POLICY_TYPES.VACATION]: 'Paid time off for vacation and personal travel',
  [POLICY_TYPES.SICK]: 'Paid time off for illness or medical appointments',
  [POLICY_TYPES.PERSONAL]: 'Unpaid time off for personal matters',
  [POLICY_TYPES.BEREAVEMENT]: 'Paid time off for bereavement and funeral attendance',
} as const;

export const VALID_POLICY_TYPES = Object.values(POLICY_TYPES);

/**
 * Check if a string is a valid policy type
 * @param type - Policy type string
 * @returns True if valid
 */
export function isValidPolicyType(type: string): type is PolicyType {
  return VALID_POLICY_TYPES.includes(type as PolicyType);
}

/**
 * Get policy type display name
 * @param type - Policy type
 * @returns Display name
 */
export function getPolicyTypeName(type: PolicyType): string {
  return POLICY_TYPE_NAMES[type];
}

/**
 * Get policy type description
 * @param type - Policy type
 * @returns Description
 */
export function getPolicyTypeDescription(type: PolicyType): string {
  return POLICY_TYPE_DESCRIPTIONS[type];
}
