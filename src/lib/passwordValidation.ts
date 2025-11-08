export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else if (password.length >= 12) {
    score += 1;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  // Number check
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  // Common password check - expanded list
  const commonPasswords = [
    'password', '123456', 'qwerty', 'admin', 'letmein', 'welcome',
    'abc123', 'password123', 'admin123', 'root', 'user', 'guest',
    '123456789', 'qwerty123', 'password1', 'adminadmin', 'user123'
  ];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
    score = Math.max(0, score - 1); // Reduce score for common passwords
  }

  // Sequential characters check - only prevent excessive repetition (4+ same chars)
  if (/(.)\1{3,}/.test(password)) {
    errors.push('Password cannot contain 4 or more repeated characters');
  }

  // Dictionary words check (basic)
  const dictionaryWords = ['password', 'admin', 'user', 'login', 'welcome', 'hello', 'world'];
  if (dictionaryWords.some(word => password.toLowerCase().includes(word))) {
    errors.push('Password should not contain common dictionary words');
  }

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (score >= 4) {
    strength = 'strong';
  } else if (score >= 3) {
    strength = 'medium';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
}

export function getPasswordStrengthColor(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak':
      return 'text-red-600 bg-red-50';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'strong':
      return 'text-green-600 bg-green-50';
  }
}

// Helper function for password reset - less strict validation
export function validatePasswordReset(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  // Basic requirements for password reset (less strict)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else if (password.length >= 10) {
    score += 1;
  }

  // At least one letter and one number
  if (!/[a-zA-Z]/.test(password)) {
    errors.push('Password must contain at least one letter');
  } else {
    score += 1;
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Check for very common passwords
  const veryCommonPasswords = ['password', '123456', 'qwerty', 'admin'];
  if (veryCommonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
    score = 0;
  }

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (score >= 2) {
    strength = 'strong';
  } else if (score >= 1) {
    strength = 'medium';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
}