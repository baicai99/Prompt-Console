import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./features/conversation/ui/ConversationControllerProvider', () => ({
  ConversationControllerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('./features/conversation/ui/ConversationWorkspace', () => ({
  ConversationWorkspace: () => <div>conversation-workspace</div>,
}))

vi.mock('./features/conversation/ui/LogsDashboardPage', () => ({
  LogsDashboardPage: () => <div>logs-dashboard</div>,
}))

vi.mock('./features/conversation/ui/ModelUsageDashboardPage', () => ({
  ModelUsageDashboardPage: () => <div>model-usage-dashboard</div>,
}))

vi.mock('./features/conversation/ui/StorageDashboardPage', () => ({
  StorageDashboardPage: () => <div>storage-dashboard</div>,
}))

describe('App routes', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('renders the storage dashboard route', async () => {
    window.history.replaceState({}, '', '/storage')
    render(<App />)

    expect(await screen.findByText('storage-dashboard')).toBeInTheDocument()
  })

  it('renders the logs dashboard route', async () => {
    window.history.replaceState({}, '', '/logs')
    render(<App />)

    expect(await screen.findByText('logs-dashboard')).toBeInTheDocument()
  })

  it('redirects unknown routes back to the workspace', async () => {
    window.history.replaceState({}, '', '/unknown')
    render(<App />)

    expect(await screen.findByText('conversation-workspace')).toBeInTheDocument()
  })
})
