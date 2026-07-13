import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { JobsPage } from './pages/JobsPage'
import { JobWorkflowPage } from './pages/JobWorkflowPage'
import { AttributeMasterPage } from './pages/AttributeMasterPage'

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
        path: 'attribute-master',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <AttributeMasterPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'attribute-master/:equipmentId',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <AttributeMasterPage />
          </ProtectedRoute>
        ),
      },
      // Backwards-compatible redirects from the previous route names.
      { path: 'equipment-master', element: <Navigate to="/attribute-master" replace /> },
      { path: 'equipment-master/:equipmentId', element: <Navigate to="/attribute-master" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/jobs" replace /> },
])
