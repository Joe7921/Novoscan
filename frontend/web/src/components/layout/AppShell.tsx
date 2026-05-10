import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import SetupWizard from '@/components/settings/SetupWizard'
import { useLocalSettings } from '@/hooks/useLocalSettings'

export default function AppShell() {
  const { settings, updateSettings } = useLocalSettings()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 min-h-screen"
        style={{ marginLeft: 'var(--novo-sidebar-width)' }}
      >
        <Outlet />
      </main>
      <CommandPalette />
      {!settings.onboardingDone && (
        <SetupWizard onComplete={() => updateSettings({ onboardingDone: true })} />
      )}
    </div>
  )
}
