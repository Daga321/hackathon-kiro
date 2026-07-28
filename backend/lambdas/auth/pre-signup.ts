import { PreSignUpTriggerEvent } from 'aws-lambda';

/**
 * Cognito Pre Sign-up trigger.
 * Auto-confirms the user and their email so they can log in immediately
 * after registration without needing to enter a verification code.
 */
export const handler = async (event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> => {
  // Auto-confirm the user
  event.response.autoConfirmUser = true;

  // Auto-verify email if provided
  if (event.request.userAttributes['email']) {
    event.response.autoVerifyEmail = true;
  }

  return event;
};
