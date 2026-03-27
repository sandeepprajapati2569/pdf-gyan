import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/common/ProtectedRoute'
import AuthRoute from './components/common/AuthRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import ChatPage from './pages/ChatPage'
import MultiChatPage from './pages/MultiChatPage'
import Settings from './pages/Settings'
import ApiKeys from './pages/ApiKeys'
import ApiDocs from './pages/ApiDocs'
import CallPage from './pages/CallPage'
import EmbedCallWidget from './pages/EmbedCallWidget'
import EmbedChatWidget from './pages/EmbedChatWidget'
import SharedConversation from './pages/SharedConversation'
import SharedFilePage from './pages/SharedFilePage'
import SharedFilesPortal from './pages/SharedFilesPortal'
import AnalyticsPage from './pages/AnalyticsPage'
import WorkspacePage from './pages/WorkspacePage'
import WidgetsPage from './pages/WidgetsPage'

function App() {
  return (
    <Layout>
      <Routes>
        {/* Auth pages — redirect to dashboard if already logged in */}
        <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
        <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
        <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
        <Route path="/reset-password" element={<AuthRoute><ResetPassword /></AuthRoute>} />

        {/* Default route — dashboard (protected) */}
        <Route path="/" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />

        {/* App pages (all protected) */}
        <Route path="/documents" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/chat/multi" element={<ProtectedRoute><MultiChatPage /></ProtectedRoute>} />
        <Route path="/chat/:documentId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/call/:documentId" element={<ProtectedRoute><CallPage /></ProtectedRoute>} />
        <Route path="/widgets" element={<ProtectedRoute><WidgetsPage /></ProtectedRoute>} />
        <Route path="/workspace" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/analytics" element={<Navigate to="/" replace />} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/api-keys" element={<ProtectedRoute><ApiKeys /></ProtectedRoute>} />
        <Route path="/api-docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />

        {/* Public embed/shared routes (no auth) */}
        <Route path="/embed/call" element={<EmbedCallWidget />} />
        <Route path="/embed/chat" element={<EmbedChatWidget />} />
        <Route path="/shared/:token" element={<SharedConversation />} />
        <Route path="/shared-file/:token" element={<SharedFilePage />} />
        <Route path="/shared-files" element={<SharedFilesPortal />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
