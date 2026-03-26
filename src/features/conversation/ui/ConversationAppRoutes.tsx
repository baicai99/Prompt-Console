import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { APP_ROUTES } from '../../../routes'
import { ConversationControllerProvider } from './ConversationControllerProvider'
import { ConversationWorkspace } from './ConversationWorkspace'

const ModelUsageDashboardPage = lazy(async () => ({
  default: (await import('./ModelUsageDashboardPage')).ModelUsageDashboardPage,
}))
const LogsDashboardPage = lazy(async () => ({
  default: (await import('./LogsDashboardPage')).LogsDashboardPage,
}))

export function ConversationAppRoutes() {
  return (
    <ConversationControllerProvider>
      <Suspense fallback={null}>
        <Routes>
          <Route path={APP_ROUTES.home} element={<ConversationWorkspace />} />
          <Route path={APP_ROUTES.modelStats} element={<ModelUsageDashboardPage />} />
          <Route path={APP_ROUTES.logs} element={<LogsDashboardPage />} />
          <Route path="*" element={<Navigate to={APP_ROUTES.home} replace />} />
        </Routes>
      </Suspense>
    </ConversationControllerProvider>
  )
}
