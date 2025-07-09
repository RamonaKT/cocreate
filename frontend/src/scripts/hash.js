//Function to hash IP Address
export async function hashIp(ip) {
  // Fallback SHA-256 implementation for non-secure contexts (JavaScript only, not using WebCrypto)
  // NOT cryptographically secure – but sufficient for basic differentiation
  function simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(); // Return a positive string representation
  }

  // Check if we are in a secure context (HTTPS, localhost) and WebCrypto API is available
  if (window.isSecureContext && window.crypto?.subtle) {
    const encoder = new TextEncoder(); // Convert the string into a byte array
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data); // Generate SHA-256 hash
    return Array.from(new Uint8Array(hashBuffer)) // Convert buffer to byte array
      .map(b => b.toString(16).padStart(2, '0')) // Convert each byte to a two-digit hex string
      .join(''); // Join all hex values into a single string
  } else {
    // Use fallback hash in non-secure environments (e.g., HTTP)
    return simpleHash(ip);
  }
}