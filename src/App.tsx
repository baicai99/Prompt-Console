import { Suspense, lazy } from 'react'
import { ConfigProvider } from 'antd'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { APP_ROUTES } from './routes'
import { appTheme } from './theme/appTheme'

const ConversationAppRoutes = lazy(async () => ({
  default: (await import('./features/conversation/ui/ConversationAppRoutes')).ConversationAppRoutes,
}))
const StorageDashboardPage = lazy(async () => ({
  default: (await import('./features/conversation/ui/StorageDashboardPage')).StorageDashboardPage,
}))

export default function App() {
  return (
    <ConfigProvider theme={appTheme}>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path={APP_ROUTES.storage} element={<StorageDashboardPage />} />
            <Route path="*" element={<ConversationAppRoutes />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  )
}
