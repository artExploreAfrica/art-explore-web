import { useState, useEffect, useRef } from "react";
import { Menu, X, MapPin, Calendar, Search } from "lucide-react";
import "./Navbar.scss";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navRef = useRef(null);

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
          onClick={(e) => {
            e.preventDefault();  
            scrollToSection("home");  
          }}
        >
          Art<span className="explore">Explore</span>
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
          
          {/* Galleries link - scrolls to GalleryGrid component */}
          <li>
            <a
              href="#galleries"
              onClick={(e) => {
                e.preventDefault();         
                scrollToSection("galleries"); 
              }}
            >
              Galleries
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}