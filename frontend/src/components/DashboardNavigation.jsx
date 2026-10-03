export default function DashboardNavigation({ activePage, onNavigate, groups, items }) {
  const navGroups = groups || [
    { title: "Dashboard Pages", items: items || [] },
  ];

  return (
    <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
      <nav className="dashboard-page-nav">
        {navGroups.map((group) => (
          <div key={group.title} className="nav-group-section">
            <div className="dashboard-sidebar-label">{group.title}</div>
            <div className="nav-group-items">
              {group.items.map((item) => (
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
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
