import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context'
import Layout from './components/Layout'
import Login from './pages/Login'
import SurveyList from './pages/SurveyList'
import SurveyPage from './pages/SurveyPage'
import ThankYou from './pages/ThankYou'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Surveys from './pages/admin/Surveys'
import SurveyDetail from './pages/admin/SurveyDetail'
import SettingsPage from './pages/admin/Settings'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route index element={<SurveyList />} />
            <Route path="surveys/:id" element={<SurveyPage />} />
            <Route path="thanks" element={<ThankYou />} />
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="surveys" element={<Surveys />} />
              <Route path="surveys/:id" element={<SurveyDetail />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
