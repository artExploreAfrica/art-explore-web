import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import "./Navbar.scss";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'about' | 'spaces' | null
  const navRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const onHomePage = location.pathname === "/";

  // Publish the navbar's real rendered height as a CSS custom property.
  useEffect(() => {
    const setNavHeight = () => {
      if (navRef.current) {
        document.documentElement.style.setProperty(
          "--navbar-h",
          `${navRef.current.offsetHeight}px`
        );
      }
    };
    setNavHeight();
    window.addEventListener("resize", setNavHeight);
    return () => window.removeEventListener("resize", setNavHeight);
  }, []);

  // Close dropdown when clicking outside the navbar.
  useEffect(() => {
    const handleOutside = (e) => {
      if (!navRef.current?.contains(e.target)) setOpenDropdown(null);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Escape closes any open dropdown.
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") setOpenDropdown(null); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Close everything on route change.
  useEffect(() => {
    setOpenDropdown(null);
    setIsMenuOpen(false);
  }, [location.pathname, location.hash]);

  const scrollToSection = (sectionId) => {
    if (!onHomePage) {
      navigate({ pathname: "/", hash: `#${sectionId}` });
      setIsMenuOpen(false);
      setOpenDropdown(null);
      return;
    }
    const section = document.getElementById(sectionId);
    if (section) {
      const navH = navRef.current ? navRef.current.offsetHeight : 70;
      window.scrollTo({ top: section.offsetTop - navH, behavior: "smooth" });
      setIsMenuOpen(false);
      setOpenDropdown(null);
    }
  };

  const toggleDropdown = (name) =>
    setOpenDropdown((prev) => (prev === name ? null : name));

  const closeAll = () => { setIsMenuOpen(false); setOpenDropdown(null); };

  return (
    <nav className="navbar" ref={navRef}>
      <div className="container">

        {/* ── Logo: rust icon + "Art Explore" text ── */}
        <a
          href="#home"
          className="logo"
          aria-label="Art Explore — home"
          onClick={(e) => { e.preventDefault(); scrollToSection("home"); }}
        >
          <img
            src="/brand/favicon-red.png"
            alt=""
            className="logo__icon"
            aria-hidden="true"
            width="512"
            height="512"
          />
          <span className="logo__text">Art Explore</span>
        </a>

        {/* ── Mobile toggle ── */}
        <button
          className="mobile-menu-btn"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* ── Nav links ── */}
        <ul className={`nav-links ${isMenuOpen ? "active" : ""}`}>

          {/* About dropdown */}
          <li className={`nav-item--has-dropdown${openDropdown === "about" ? " is-open" : ""}`}>
            <button
              className="nav-dropdown-trigger"
              onClick={() => toggleDropdown("about")}
              aria-expanded={openDropdown === "about"}
              aria-haspopup="true"
            >
              About
              <ChevronDown size={11} className="nav-chevron" aria-hidden="true" />
            </button>
            <ul className="nav-dropdown" aria-label="About pages">
              <li><Link to="/about" onClick={closeAll}>Who We Are</Link></li>
              <li><Link to="/about#vision" onClick={closeAll}>Vision</Link></li>
              <li><Link to="/partner" onClick={closeAll}>Partner With Us</Link></li>
            </ul>
          </li>

          {/* Map — scroll target on the home page */}
          <li>
            <a
              href="#map"
              onClick={(e) => { e.preventDefault(); scrollToSection("map"); }}
            >
              Map
            </a>
          </li>

          {/* Spaces dropdown */}
          <li className={`nav-item--has-dropdown${openDropdown === "spaces" ? " is-open" : ""}`}>
            <button
              className="nav-dropdown-trigger"
              onClick={() => toggleDropdown("spaces")}
              aria-expanded={openDropdown === "spaces"}
              aria-haspopup="true"
            >
              Spaces
              <ChevronDown size={11} className="nav-chevron" aria-hidden="true" />
            </button>
            <ul className="nav-dropdown" aria-label="Spaces pages">
              {/* Routes to be refined when Featured / Exhibitions pages are built */}
              <li><Link to="/galleries" onClick={closeAll}>Featured Space</Link></li>
              <li><Link to="/galleries" onClick={closeAll}>Exhibitions</Link></li>
              <li><Link to="/galleries" onClick={closeAll}>All Spaces</Link></li>
            </ul>
          </li>

        </ul>
      </div>
    </nav>
  );
}
