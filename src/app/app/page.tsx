import { redirect } from 'next/navigation'

const redirectToIntendedRoute = () => {
  redirect('/app/lobby')
}

export default function AppPage() {
  redirectToIntendedRoute()
}