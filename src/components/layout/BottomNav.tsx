import { Home, Briefcase, Users, Crown } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const navItems = [
  { path: "/dashboard", icon: Home, label: "Inicio" },
  { path: "/new-loan", icon: Briefcase, label: "Operaciones" },
  { path: "/portfolio", icon: Users, label: "Clientes" },
  { path: "/subscription", icon: Crown, label: "Suscripción" },
];

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav z-50">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`bottom-nav-item relative ${isActive ? "active" : ""}`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon className="w-6 h-6 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs font-medium relative z-10">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
