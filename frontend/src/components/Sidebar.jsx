import { NavLink } from "react-router-dom";

const navigation = [
    { name: "Dashboard", path: "/" },
    { name: "Budgets", path: "/budgets" },
    { name: "Forecast", path: "/forecast" },
    { name: "History", path: "/history" },
    { name: "Settings", path: "/settings" }
];

function Sidebar() {
    return (
        <aside className="sidebar">

            <div className="sidebar-brand">
                <span className="brand-icon">🍌</span>
                <h2>BuyNana</h2>
            </div>

            <nav className="sidebar-navigation">
                {navigation.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === "/"}
                        className={({ isActive }) =>
                            `navigation-link ${isActive ? "active" : ""}`
                        }
                    >
                        {item.name}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <span>Demo Account</span>
            </div>

        </aside>
    );
}

export default Sidebar;