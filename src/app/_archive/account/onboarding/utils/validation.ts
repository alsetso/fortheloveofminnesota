/**
 * Validation utilities for onboarding form
 */

export const validateEmail = (email: string): boolean => {
  if (!email.trim()) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

export const validatePhone = (phone: string): boolean => {
  if (!phone.trim()) return true; // Optional field
  // E.164 format or US format: +1XXXXXXXXXX, (XXX) XXX-XXXX, XXX-XXX-XXXX, etc.
  const phoneRegex = /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;
  return phoneRegex.test(phone.trim());
};

export const validateName = (name: string): { valid: boolean; error?: string } => {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'Name is required' };
  }
  
  if (trimmed.length < 1) {
    return { valid: false, error: 'Name cannot be empty' };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: 'Name must be 50 characters or less' };
  }
  
  // Reject names with only special characters (allow letters, numbers, spaces, hyphens, apostrophes)
  if (!/^[a-zA-Z0-9\s'-]+$/.test(trimmed)) {
    return { valid: false, error: 'Name can only contain letters, numbers, spaces, hyphens, and apostrophes' };
  }
  
  return { valid: true };
};

export const validateUsername = (username: string): { valid: boolean; error?: string } => {
  const trimmed = username.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'Username is required' };
  }
  
  if (trimmed.length < 3 || trimmed.length > 30) {
    return { valid: false, error: 'Username must be between 3 and 30 characters' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }
  
  return { valid: true };
};

export const validateContact = (email: string, phone: string): { valid: boolean; error?: string } => {
  const hasEmail = email.trim().length > 0;
  const hasPhone = phone.trim().length > 0;
  
  if (!hasEmail && !hasPhone) {
    return { valid: false, error: 'Please provide at least one contact method (email or phone)' };
  }
  
  if (hasEmail && !validateEmail(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  if (hasPhone && !validatePhone(phone)) {
    return { valid: false, error: 'Please enter a valid phone number' };
  }
  
  return { valid: true };
};



