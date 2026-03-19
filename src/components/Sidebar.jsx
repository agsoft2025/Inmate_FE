// Sidebar.jsx
import { NavLink } from "react-router-dom";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import { X } from "lucide-react";
import {
  Grid,
  LayoutDashboard,
  Users,
  ReceiptIndianRupee,
  Store,
  ArrowLeftRight,
  FileText,
  Upload,
  UserRoundPen,
  ShoppingBag,
  ShieldCheck,
} from "lucide-react";

const linkBase = "block rounded-lg px-3 py-2 text-sm font-medium transition";
const linkActive = "bg-white/15 text-white";
const linkIdle = "text-white/80 hover:bg-white/10 hover:text-white";

export default function Sidebar({ isOpen = false, onClose }) {
  const { user, logout } = useAuth();
  const role = (user?.role || "").toUpperCase();

  const sideBarItems = [
    { title: "Super Dashboard", icon: Grid, path: "/super-dashboard", roles: ["SUPER ADMIN"] },
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["ADMIN"] },
    { title: "Inmate Management", icon: Users, path: "/inmate-management", roles: ["ADMIN"] },
    { title: "Canteen Deposit", icon: ReceiptIndianRupee, path: "/financial-management", roles: ["ADMIN"] },
    { title: "Transaction History", icon: ArrowLeftRight, path: "/transaction-history", roles: ["ADMIN"] },
    { title: "Canteen POS", icon: Store, path: "/tuck-shop-pos", roles: ["ADMIN", "POS"] },
    { title: "Reports", icon: FileText, path: "/reports", roles: ["ADMIN"] },
    { title: "Bulk Operations", icon: Upload, path: "/bulk-operations", roles: ["ADMIN"] },
    { title: "User Management", icon: UserRoundPen, path: "/user-management", roles: ["ADMIN"] },
    { title: "Inventory", icon: ShoppingBag, path: "/inventory", roles: ["ADMIN"] },
    { title: "Audit Trails", icon: ShieldCheck, path: "/audit-trails", roles: ["ADMIN"] },
    { title: "Inmate Profile", icon: Users, path: "/inmate-profile", roles: ["INMATE"] },
    { title: "Inmate Transaction", icon: ArrowLeftRight, path: "/inmate-transaction", roles: ["INMATE"] },
  ];

  const allowedItems = sideBarItems.filter((item) =>
    item.roles?.some((r) => r.toUpperCase() === role)
  );

  const AsideContent = (
    <aside className="w-64 h-full bg-primary text-white flex flex-col">
      <div className="px-8 bg-white m-2 rounded-2xl flex items-center border-b border-white/15 justify-between">
        <img src={logo} alt="logo" className="p-2" />
        {/* Close button only on mobile drawer */}
        <button className="md:hidden p-2" onClick={onClose} aria-label="Close menu">
          <X className="w-5 h-5 text-black" />
        </button>
      </div>

      <nav className="p-3 space-y-1 flex-1">
        {allowedItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={() => onClose?.()} // close drawer after navigation (mobile)
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkIdle}`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span>{item.title}</span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/15">
        <button
          onClick={logout}
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold bg-secondary text-black hover:brightness-95"
        >
          Logout
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block h-screen sticky top-0">{AsideContent}</div>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        {/* Backdrop */}
        <div
          onClick={onClose}
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Drawer */}
        <div
          className={`absolute left-0 top-0 h-full w-64 transform transition-transform ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {AsideContent}
        </div>
      </div>
    </>
  );
}
