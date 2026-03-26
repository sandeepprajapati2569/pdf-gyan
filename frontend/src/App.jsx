import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/common/ProtectedRoute'
import Landing from './pages/Landing'
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
import AnalyticsPage from './pages/AnalyticsPage'
import WorkspacePage from './pages/WorkspacePage'
import WidgetsPage from './pages/WidgetsPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/api-docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/multi"
          element={
            <ProtectedRoute>
              <MultiChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:documentId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/call/:documentId"
          element={
            <ProtectedRoute>
              <CallPage />
            </ProtectedRoute>
          }
        />
        <Route path="/embed/call" element={<EmbedCallWidget />} />
        <Route path="/embed/chat" element={<EmbedChatWidget />} />
        <Route path="/shared/:token" element={<SharedConversation />} />
        <Route
          path="/widgets"
          element={
            <ProtectedRoute>
              <WidgetsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace"
          element={
            <ProtectedRoute>
              <WorkspacePage />
            </ProtectedRoute>
          }
        />
        {/* /analytics redirects to /dashboard */}
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/api-keys"
          element={
            <ProtectedRoute>
              <ApiKeys />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Layout>
  )
}

export default App
