/**
 * User-Friendly Error Messages
 * 
 * Maps technical/API errors to user-friendly messages
 */

const errorMappings: Record<string, string> = {
  'You cannot initiate third party payouts as a starter business':
    'Payouts are not yet enabled for this account. The platform administrator needs to upgrade the payment provider account to process withdrawals.',
  
  'You cannot initiate third-party payouts as a starter business':
    'Payouts are not yet enabled for this account. The platform administrator needs to upgrade the payment provider account to process withdrawals.',
  
  'Transfer recipient not found':
    'Your payout account could not be found. Please try removing and re-adding your account.',
  
  'Insufficient funds in balance':
    'The platform does not have sufficient funds to process this withdrawal. Please try again later or contact support.',
  
  'Your balance is not enough to fulfil this request':
    'The platform does not have sufficient funds to process this withdrawal. Please contact support.',
  
  'Invalid recipient':
    'There was a problem with your payout account details. Please verify your account information and try again.',
  
  'Transfer has been queued':
    'Your withdrawal has been queued and will be processed shortly.',
  
  'Transfer is processing':
    'Your withdrawal is being processed. Please check back shortly.',
  
  'Failed to initiate transfer':
    'We could not process your withdrawal at this time. Please try again later.',
  
  'Failed to verify bank account':
    'We could not verify your account details. Please check that your information is correct.',
  
  'Paystack not configured':
    'The payment system is not configured. Please contact support.',
  
  'Authentication required':
    'Please sign in to continue.',
  
  'Vendor access required':
    'You need a vendor account to access this feature.',
  
  'Invalid amount':
    'Please enter a valid withdrawal amount.',
  
  'Bank account required':
    'Please select a payout account.',
  
  'Insufficient balance':
    'You don\'t have enough funds to withdraw this amount.',
  
  'Phone verification required':
    'Please verify your phone number in your profile settings before adding a payout account.',
  
  'Verification expired':
    'Your verification has expired. Please request a new verification code.',
  
  'Invalid verification code':
    'The code you entered is incorrect. Please check and try again.',
  
  'OTP expired':
    'Your verification code has expired. Please request a new one.',
  
  'Failed to send OTP':
    'We could not send your verification code. Please try again.',
  
  'Failed to fetch':
    'Could not connect to the server. Please check your internet connection and try again.',
  
  'Network Error':
    'Could not connect to the server. Please check your internet connection.',
  
  'Request timeout':
    'The request took too long. Please try again.',
  
  'Internal server error':
    'Something went wrong on our end. Please try again later.',
  
  'Failed to process withdrawal':
    'We could not process your withdrawal. Please try again or contact support.',
};

const partialMatchMappings: Array<{ pattern: string; message: string }> = [
  {
    pattern: 'third party payouts',
    message: 'Payouts are not yet enabled for this account. The platform administrator needs to upgrade the payment provider account to process withdrawals.',
  },
  {
    pattern: 'starter business',
    message: 'Payouts are not yet enabled for this account. The platform administrator needs to upgrade the payment provider account to process withdrawals.',
  },
  {
    pattern: 'insufficient',
    message: 'There are insufficient funds to process this request. Please try again later or contact support.',
  },
  {
    pattern: 'timeout',
    message: 'The request took too long. Please try again.',
  },
  {
    pattern: 'network',
    message: 'Could not connect to the server. Please check your internet connection.',
  },
];

export function getFriendlyErrorMessage(error: string | Error | unknown): string {
  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : 'Something went wrong';

  const exactMatch = errorMappings[errorMessage];
  if (exactMatch) {
    return exactMatch;
  }

  const lowerError = errorMessage.toLowerCase();
  for (const { pattern, message } of partialMatchMappings) {
    if (lowerError.includes(pattern.toLowerCase())) {
      return message;
    }
  }

  if (errorMessage.length > 100 || /^[A-Z_]+$/.test(errorMessage) || errorMessage.includes('_')) {
    return 'Something went wrong. Please try again or contact support.';
  }

  return errorMessage;
}

export function getPayoutErrorMessage(error: string | Error | unknown): string {
  return getFriendlyErrorMessage(error);
}

export const successMessages = {
  withdrawal: {
    submitted: 'Your withdrawal request has been submitted! You\'ll receive the funds within 24-48 hours.',
    processing: 'Your withdrawal is being processed.',
    completed: 'Your withdrawal has been completed successfully!',
  },
  account: {
    added: 'Your payout account has been added successfully!',
    verified: 'Your payout account has been verified and is ready to use.',
    removed: 'Your payout account has been removed.',
    setPrimary: 'Your default payout account has been updated.',
  },
  verification: {
    codeSent: 'We\'ve sent a verification code to your phone.',
    verified: 'Verification successful! You can now proceed.',
  },
  profile: {
    saved: 'Your profile has been saved.',
    passwordChanged: 'Your password has been changed successfully.',
    phoneUpdated: 'Your phone number has been updated.',
  },
  order: {
    packed: 'Item marked as packed and ready for delivery.',
    shipped: 'Item has been shipped.',
    delivered: 'Item has been delivered.',
    courierBooked: 'Courier has been booked for pickup.',
  },
  product: {
    created: 'Your product has been created.',
    updated: 'Your product has been updated.',
    deleted: 'Your product has been removed.',
    duplicated: 'Product has been duplicated as a draft.',
  },
};
