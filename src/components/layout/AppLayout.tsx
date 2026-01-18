import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export const AppLayout = ({ children, showNav = true }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <main className={`${showNav ? "pb-20 sm:pb-24" : ""} safe-area-top`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
};
