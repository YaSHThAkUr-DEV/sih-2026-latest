import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth/jwt';

export default async function Home() {
  const session = await getCurrentSession();
  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
