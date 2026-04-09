const buildCookieName = (name, suffix) => (suffix ? `${name}_${suffix}` : name);

export const getCookie = (name, suffix) => {
  if (typeof document === "undefined") return null;
  const fullName = buildCookieName(name, suffix);
  const cookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${fullName}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.substring(fullName.length + 1));
};

export const setCookie = (name, value, options = {}, suffix) => {
  if (typeof document === "undefined") return;
  const opts = {
    path: "/",
    ...options,
  };
  const fullName = buildCookieName(name, suffix);
  const parts = [`${fullName}=${encodeURIComponent(value)}`];
  if (opts.expires) {
    parts.push(`expires=${opts.expires.toUTCString()}`);
  }
  if (opts.path) {
    parts.push(`path=${opts.path}`);
  }
  if (opts.sameSite) {
    parts.push(`SameSite=${opts.sameSite}`);
  }
  if (opts.secure) {
    parts.push(`secure`);
  }
  document.cookie = parts.join("; ");
};

export const deleteCookie = (name, suffix) => {
  setCookie(name, "", { expires: new Date(0) }, suffix);
};
