import { useState } from "react";
import { Menu, X, MapPin, Calendar, Search } from "lucide-react";
import "./Navbar.scss";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    
    if (section) {
      const navbar = document.querySelector('.navbar');
      const navbarHeight = navbar ? navbar.offsetHeight : 70;
      
      const sectionPosition = section.offsetTop - navbarHeight;
            window.scrollTo({
        top: sectionPosition,
        behavior: 'smooth'  
      });
      
      setIsMenuOpen(false);
    }
  };

  return (
    <nav className="navbar">
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