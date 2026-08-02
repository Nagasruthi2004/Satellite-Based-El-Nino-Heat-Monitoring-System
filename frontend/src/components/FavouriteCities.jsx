import { useState, useEffect } from "react";

function FavouriteCities({ currentCity, onSelectCity }) {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("favoriteCities")) || [];
    setFavorites(saved);
  }, []);

  const addFavorite = () => {
    if (!currentCity) return;

    if (!favorites.includes(currentCity)) {
      const updated = [...favorites, currentCity];
      setFavorites(updated);
      localStorage.setItem("favoriteCities", JSON.stringify(updated));
    }
  };

  const removeFavorite = (city) => {
    const updated = favorites.filter((item) => item !== city);
    setFavorites(updated);
    localStorage.setItem("favoriteCities", JSON.stringify(updated));
  };

  return (
    <div className="card">
      <h2>⭐ Favourite Cities</h2>

      <button className="predict-button" onClick={addFavorite}>
        ➕ Add Current City
      </button>

      <br />
      <br />

      {favorites.length === 0 ? (
        <p>No favourite cities added.</p>
      ) : (
        favorites.map((city) => (
          <div
            key={city}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "10px",
              alignItems: "center",
            }}
          >
            <button
              className="download-btn"
              onClick={() => onSelectCity(city)}
            >
              📍 {city}
            </button>

            <button
              className="predict-button"
              style={{ background: "var(--danger)", color: "var(--on-primary)" }}
              onClick={() => removeFavorite(city)}
            >
              ❌
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export default FavouriteCities;
