import { Routes, Route } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import AnalyzePage from '@/pages/AnalyzePage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'
import StudioPage from '@/pages/StudioPage'
import BlocksPage from '@/pages/BlocksPage'
import AgentDesignerPage from '@/pages/AgentDesignerPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<AnalyzePage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/studio/agent-designer" element={<AgentDesignerPage />} />
        <Route path="/history" element={<ReportsPage />} />
        <Route path="/components" element={<BlocksPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
