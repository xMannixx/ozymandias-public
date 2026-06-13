import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/store/auth";

function AuthGuard(): JSX.Element {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export default AuthGuard;
