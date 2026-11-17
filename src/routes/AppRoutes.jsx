import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireInstitution, Can } from './guards.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import { Splash } from '../components/common/Misc.jsx';
import Landing from '../pages/Landing/index.jsx';
import Login from '../pages/Authentication/Login.jsx';
import Register from '../pages/Authentication/Register.jsx';
import ForgotPassword from '../pages/Authentication/ForgotPassword.jsx';
import VerifyEmail from '../pages/Authentication/VerifyEmail.jsx';
import Onboarding from '../pages/Institution/Onboarding.jsx';
import NotFound from '../pages/NotFound.jsx';
import { isStandalone } from '../pwa/install.js';

const Dashboard = lazy(() => import('../pages/Dashboard/index.jsx'));
const PaperLibrary = lazy(() => import('../pages/PaperLibrary/index.jsx'));
const PaperBuilder = lazy(() => import('../pages/QuestionBuilder/index.jsx'));
const QuestionBank = lazy(() => import('../pages/QuestionBank/index.jsx'));
const Templates = lazy(() => import('../pages/Templates/index.jsx'));
const DesignStudio = lazy(() => import('../pages/DesignStudio/index.jsx'));
const AnswerKeys = lazy(() => import('../pages/AnswerKeys/index.jsx'));
const ImportExport = lazy(() => import('../pages/ImportExport/index.jsx'));
const AIGenerator = lazy(() => import('../pages/AI/index.jsx'));
const Team = lazy(() => import('../pages/Teachers/index.jsx'));
const Subjects = lazy(() => import('../pages/Subjects/index.jsx'));
const Analytics = lazy(() => import('../pages/Analytics/index.jsx'));
const Subscription = lazy(() => import('../pages/Subscription/index.jsx'));
const Notifications = lazy(() => import('../pages/Notifications/index.jsx'));
const Settings = lazy(() => import('../pages/Settings/index.jsx'));
const PrintPage = lazy(() => import('../pages/Print/index.jsx'));

const guard = (perm, el) => <Can perm={perm}>{el}</Can>;

// Installed app (home-screen icon): open straight into the dashboard. RequireAuth sends signed-out users to the login page.
const Home = () => (isStandalone() ? <Navigate to="/app/dashboard" replace /> : <Landing />);

export default function AppRoutes() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/print" element={<PrintPage />} />
          <Route element={<RequireInstitution />}>
            <Route path="/app" element={<DashboardLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="papers" element={guard('papers.view', <PaperLibrary />)} />
              <Route path="papers/:paperId" element={guard('papers.view', <PaperBuilder />)} />
              <Route path="question-bank" element={guard('questions.view', <QuestionBank />)} />
              <Route path="templates" element={guard('papers.view', <Templates />)} />
              <Route path="design-studio/:templateId?" element={guard('templates.manage', <DesignStudio />)} />
              <Route path="answer-keys" element={guard('answerKeys.view', <AnswerKeys />)} />
              <Route path="import-export" element={guard('papers.view', <ImportExport />)} />
              <Route path="ai" element={guard('ai.use', <AIGenerator />)} />
              <Route path="team" element={<Team />} />
              <Route path="academics" element={guard('questions.view', <Subjects />)} />
              <Route path="analytics" element={guard('analytics.view', <Analytics />)} />
              <Route path="subscription" element={guard('billing.manage', <Subscription />)} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
