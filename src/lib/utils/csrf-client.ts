'use client';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

export function getCsrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  if (!token) {
    return {};
  }
  return { [CSRF_HEADER_NAME]: token };
}

export function csrfFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const csrfToken = getCsrfToken();
  
  const headers = new Headers(init?.headers);
  
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }
  
  return fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials || 'include',
  });
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
