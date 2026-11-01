import { Navigate } from "react-router-dom";

export default function AdminRoute({ children, me }) {
    if (!me) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }
    if (me.role !== "admin") return <Navigate to="/student" replace />;
    return children;
}
