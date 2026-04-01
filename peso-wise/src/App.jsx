import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { PinProvider } from './auth/PinContext'
import { ToastProvider } from './components/Toast'
import ProtectedRoute, { AdminRoute } from './auth/ProtectedRoute'
import AppLayout from './AppLayout'
import Login from './pages/Login'
import PinSetup from './pages/PinSetup'
import PinEntry from './pages/PinEntry'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import BudgetTracker from './pages/BudgetTracker'
import BurnRate from './pages/BurnRate'
import Banks from './pages/Banks'
import Bills from './pages/Bills'
import SavingsGoals from './pages/SavingsGoals'
import Investments from './pages/Investments'
import DebtPlanner from './pages/DebtPlanner'
import HealthScore from './pages/HealthScore'
import SmartInsights from './pages/SmartInsights'
import Reports from './pages/Reports'
import PaycheckAllocator from './pages/PaycheckAllocator'
import Settings from './pages/Settings'
import PendingApproval from './pages/PendingApproval'
import RejectedAccount from './pages/RejectedAccount'
import AdminDashboard from './pages/admin/AdminDashboard'

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <PinProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/pin-setup" element={<PinSetup />} />
              <Route path="/pin" element={<PinEntry />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/rejected" element={<RejectedAccount />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/onboarding" element={
                <ProtectedRoute><Onboarding /></ProtectedRoute>
              } />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={
                  <ProtectedRoute><Dashboard /></ProtectedRoute>
                } />
                <Route path="/transactions" element={
                  <ProtectedRoute><Transactions /></ProtectedRoute>
                } />
                <Route path="/budget-tracker" element={
                  <ProtectedRoute><BudgetTracker /></ProtectedRoute>
                } />
                <Route path="/burn-rate" element={
                  <ProtectedRoute><BurnRate /></ProtectedRoute>
                } />
                <Route path="/banks" element={
                  <ProtectedRoute><Banks /></ProtectedRoute>
                } />
                <Route path="/bills" element={
                  <ProtectedRoute><Bills /></ProtectedRoute>
                } />
                <Route path="/savings-goals" element={
                  <ProtectedRoute><SavingsGoals /></ProtectedRoute>
                } />
                <Route path="/investments" element={
                  <ProtectedRoute><Investments /></ProtectedRoute>
                } />
                <Route path="/debt-planner" element={
                  <ProtectedRoute><DebtPlanner /></ProtectedRoute>
                } />
                <Route path="/health-score" element={
                  <ProtectedRoute><HealthScore /></ProtectedRoute>
                } />
                <Route path="/insights" element={
                  <ProtectedRoute><SmartInsights /></ProtectedRoute>
                } />
                <Route path="/reports" element={
                  <ProtectedRoute><Reports /></ProtectedRoute>
                } />
                <Route path="/paycheck-allocator" element={
                  <ProtectedRoute><PaycheckAllocator /></ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute><Settings /></ProtectedRoute>
                } />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ToastProvider>
        </PinProvider>
      </AuthProvider>
    </Router>
  )
}
