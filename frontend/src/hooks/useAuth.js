export function useAuth() {
  const token = localStorage.getItem('token');
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  })();
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };
  return { token, user, isLoggedIn: Boolean(token), logout };
}
