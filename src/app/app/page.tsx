import { redirect } from 'next/navigation';

const getRedirectUrl = () => '/app/lobby';

export default function AppPage() {
  const url = getRedirectUrl();
  redirect(url);
}