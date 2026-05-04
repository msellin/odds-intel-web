import { Nav } from "@/components/nav";
import { LoginModal } from "@/components/login-modal";
import { SuperadminTierBar } from "@/components/superadmin-tier-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
      <LoginModal />
      <SuperadminTierBar />
    </>
  );
}
