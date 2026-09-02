import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AdminLayout from './admin/AdminLayout.jsx'
import ResetPassword from './admin/ResetPassword.jsx'
import MembershipLayout from './membership/MembershipLayout.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/reset" element={<ResetPassword />} />
          <Route path="/admin/*" element={<AdminLayout />} />
          <Route path="/membership/*" element={<MembershipLayout />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
