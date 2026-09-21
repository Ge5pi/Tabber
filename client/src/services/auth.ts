import { setStorageData, getStorageData } from './storage';

export interface AuthResult {
  token: string | null;
  error?: string;
}

export const getGoogleAuthToken = async (interactive: boolean = true): Promise<AuthResult> => {
  // Check if user manually saved an access token or API key in settings
  const customToken = await getStorageData<string | null>('google_auth_token', null);
  if (customToken && customToken.trim() !== '') {
    return { token: customToken };
  }

  if (typeof chrome === 'undefined' || !chrome.identity || !chrome.identity.getAuthToken) {
    console.warn('[TabAI Auth] chrome.identity is not available in standalone preview mode.');
    const mockToken = 'demo_google_oauth_token_' + Date.now();
    await setStorageData('google_auth_token', mockToken);
    return { token: mockToken };
  }

  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, async (token) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || 'OAuth2 client ID not configured';
        console.warn('[TabAI Auth Error]:', errorMsg);
        return resolve({ token: null, error: errorMsg });
      }

      if (token) {
        console.log('[TabAI Auth Success] Google OAuth token obtained.');
        await setStorageData('google_auth_token', token);
        resolve({ token });
      } else {
        resolve({ token: null, error: 'User cancelled authentication' });
      }
    });
  });
};

export const setManualGoogleToken = async (token: string): Promise<void> => {
  await setStorageData('google_auth_token', token.trim());
};

export const logoutGoogleAccount = async (): Promise<void> => {
  const currentToken = await getStorageData<string | null>('google_auth_token', null);
  if (currentToken && typeof chrome !== 'undefined' && chrome.identity && chrome.identity.removeCachedAuthToken) {
    try {
      chrome.identity.removeCachedAuthToken({ token: currentToken }, () => {
        console.log('[TabAI Auth] Cached token removed.');
      });
    } catch {
      // Ignore invalid token removal errors
    }
  }
  await setStorageData('google_auth_token', null);
};
