import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, MapPin, Calendar, Search } from "lucide-react";
import { useAuth } from "../../lib/AuthContext.jsx";
import "./Navbar.scss";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onHomePage = location.pathname === "/";

  // Publish the navbar's real rendered height so the hero (and anything
  // else) can do `calc(100dvh - var(--navbar-h))` instead of guessing.
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

  const scrollToSection = (sectionId) => {
    // These sections only exist on the home page. From anywhere else (e.g.
    // /login, /submit), navigate home first rather than silently doing
    // nothing — the section will simply not be there to scroll to.
    if (!onHomePage) {
      navigate("/");
      setIsMenuOpen(false);
      return;
    }

    const section = document.getElementById(sectionId);

    if (section) {
      const navbarHeight = navRef.current ? navRef.current.offsetHeight : 70;

      const sectionPosition = section.offsetTop - navbarHeight;
      window.scrollTo({
        top: sectionPosition,
        behavior: 'smooth'
      });

      setIsMenuOpen(false);
    }
  };

  return (
    <nav className="navbar" ref={navRef}>
      <div className="container">
        {/* Logo - scrolls to home when clicked */}
        <a 
          href="#home" 
          className="logo"
          aria-label="Art Explore — home"
          onClick={(e) => {
            e.preventDefault();  
            scrollToSection("home");  
          }}
        >
          <img
            src="/brand/wordmark-cream.png"
            alt="Art Explore"
            className="logo__img"
            width="842"
            height="216"
          />
        </a>

        {/* Mobile menu button - unchanged */}
        <button
          className="mobile-menu-btn"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Navigation Links - UPDATED with onClick handlers */}
        <ul className={`nav-links ${isMenuOpen ? "active" : ""}`}>
          {/* About link - scrolls to Hero section */}
          <li>
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();     
                scrollToSection("home");
              }}
            >
              About
            </a>
          </li>
          
          {/* Map link - scrolls to MapView component */}
          <li>
            <a
              href="#map"
              onClick={(e) => {
                e.preventDefault();    
                scrollToSection("map");   
              }}
            >
              Map
            </a>
          </li>
          
          {/* Galleries - its own route, not a scroll target */}
          <li>
            <Link to="/galleries" onClick={() => setIsMenuOpen(false)}>
              Galleries
            </Link>
          </li>

          {user ? (
            <li className="nav-auth">
              <span className="nav-user">{user.fullName}</span>
              <button
                className="nav-logout"
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                  navigate("/");
                }}
              >
                Log out
              </button>
            </li>
          ) : (
            <li>
              <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                Log in
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}