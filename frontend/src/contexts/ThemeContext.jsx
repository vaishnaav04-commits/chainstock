
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("chainstock-theme") || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      theme === "dark",
    );

    try {
      localStorage.setItem("chainstock-theme", theme);
    } catch {
      // The app remains usable if storage is unavailable.
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((previous) =>
      previous === "dark" ? "light" : "dark",
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme requires ThemeProvider");
  }

  return context;
}
