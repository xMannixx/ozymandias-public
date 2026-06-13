import { Navigate, Route, Routes } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";
import AppShell from "@/components/layout/AppShell";
import AuditPage from "@/pages/AuditPage";
import CalendarPage from "@/pages/CalendarPage";
import ChatPage from "@/pages/ChatPage";
import ContactsPage from "@/pages/ContactsPage";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import MailPage from "@/pages/MailPage";
import MemoryPage from "@/pages/MemoryPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProposalsPage from "@/pages/ProposalsPage";
import SettingsPage from "@/pages/SettingsPage";

function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          <Route index element={<ChatPage />} />
          <Route path="memory" element={<MemoryPage />} />
          <Route path="proposals" element={<ProposalsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="stats" element={<DashboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="mail" element={<MailPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="contacts" element={<ContactsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
