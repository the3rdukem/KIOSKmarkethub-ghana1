export function getSafeRedirectUrl(redirect: string | null): string {
  if (!redirect) return "";
  
  try {
    const decoded = decodeURIComponent(redirect);
    
    if (decoded.startsWith("/") && !decoded.startsWith("//")) {
      return decoded;
    }
    
    return "";
  } catch {
    return "";
  }
}
