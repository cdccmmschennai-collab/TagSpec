import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { JobsPage } from './pages/JobsPage'
import { JobWorkflowPage } from './pages/JobWorkflowPage'
import { EquipmentMasterPage } from './pages/EquipmentMasterPage'
import { EquipmentDetailPage } from './pages/EquipmentDetailPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/jobs" replace /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'jobs/:jobId', element: <JobWorkflowPage /> },
      {
        path: 'equipment-master',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <EquipmentMasterPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'equipment-master/:equipmentId',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <EquipmentDetailPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/jobs" replace /> },
])
