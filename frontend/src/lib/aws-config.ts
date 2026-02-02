// AWS Amplify configuration
// Replace these values after deploying CDK stacks

export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID || 'YOUR_USER_POOL_ID',
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || 'YOUR_CLIENT_ID',
      signUpVerificationMethod: 'code' as const,
      loginWith: {
        email: true,
      },
    },
  },
};

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'YOUR_API_URL';
