function HeatwaveNews() {
  const news = [
    {
      title: "Heatwave Alert Issued",
      source: "IMD",
      date: "Today",
      description: "High temperatures expected in several regions. Stay hydrated.",
      link: "https://mausam.imd.gov.in/"
    },
    {
      title: "Government Issues Safety Advisory",
      source: "NDMA",
      date: "Today",
      description: "Avoid outdoor activities during peak afternoon hours.",
      link: "https://ndma.gov.in/"
    },
    {
      title: "WHO Heat Health Tips",
      source: "WHO",
      date: "Today",
      description: "Drink plenty of water and avoid direct sunlight.",
      link: "https://www.who.int/"
    }
  ];

  return (
    <div className="card">
      <h2>📰 Latest Heatwave News</h2>

      {news.map((item, index) => (
        <div
          key={index}
          style={{
            borderBottom: "1px solid #ddd",
            paddingBottom: "12px",
            marginBottom: "12px"
          }}
        >
          <h4>{item.title}</h4>
          <p><b>Source:</b> {item.source}</p>
          <p><b>Date:</b> {item.date}</p>
          <p>{item.description}</p>

          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
          >
            Read More →
          </a>
        </div>
      ))}
    </div>
  );
}

export default HeatwaveNews;