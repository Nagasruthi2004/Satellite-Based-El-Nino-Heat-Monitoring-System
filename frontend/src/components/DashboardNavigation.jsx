export default function DashboardNavigation({ activePage, onNavigate, items }) {
  return (
    <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
      <p className="dashboard-sidebar-label">Dashboard pages</p>
      <nav className="dashboard-page-nav">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activePage === item.id ? "dashboard-nav-item active" : "dashboard-nav-item"}
            onClick={() => onNavigate(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
