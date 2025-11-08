export function setLastEmail(email) {
  if (typeof document === "undefined" || !email) return;
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `instalker_last_email=${encodeURIComponent(email)}; expires=${expires.toUTCString()}; path=/`;
}

export function getLastEmail() {
  if (typeof document === "undefined") return "";
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("instalker_last_email="));
  return cookie ? decodeURIComponent(cookie.split("=")[1]) : "";
}

