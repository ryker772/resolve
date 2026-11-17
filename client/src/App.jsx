import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Landing from './pages/Landing.jsx';
import Submit from './pages/Submit.jsx';
import Track from './pages/Track.jsx';
import Login from './pages/Login.jsx';
import StudentLogin from './pages/StudentLogin.jsx';
import Register from './pages/Register.jsx';
import MyComplaints from './pages/MyComplaints.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Detail from './pages/Detail.jsx';
import NotFound from './pages/NotFound.jsx';

function StaffOnly({ children }) {
  const { isStaff, ready } = useAuth();
  if (!ready) return null;
  return isStaff ? children : <Navigate to="/staff/login" replace />;
}

function StudentOnly({ children }) {
  const { isStudent, ready } = useAuth();
  const { pathname } = useLocation();
  if (!ready) return null;
  return isStudent ? children : <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/submit" element={<Submit />} />
      <Route path="/track" element={<Track />} />
      <Route path="/track/:ticket" element={<Track />} />
      <Route path="/login" element={<StudentLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/my" element={<StudentOnly><MyComplaints /></StudentOnly>} />
      <Route path="/staff/login" element={<Login />} />
      <Route path="/staff" element={<StaffOnly><Dashboard /></StaffOnly>} />
      <Route path="/staff/complaints/:id" element={<StaffOnly><Detail /></StaffOnly>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
