import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Bot } from "lucide-react";

const navLinks = [
  { label: "Início", href: "#home" },
  { label: "Turmas", href: "#turmas" },
  { label: "Sobre", href: "#sobre" },
  { label: "Contato", href: "#contato" },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/95 backdrop-blur-sm shadow-sm border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => scrollTo("#home")}
          className="flex items-center gap-2 font-extrabold text-lg"
        >
          <Bot
            className={`w-7 h-7 ${scrolled ? "text-secondary" : "text-secondary"}`}
          />
          <span
            className={`font-display transition-colors ${
              scrolled ? "text-primary" : "text-primary-foreground"
            }`}
          >
            Clubinho de Robótica
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className={`text-sm font-semibold transition-colors hover:text-secondary ${
                scrolled ? "text-foreground" : "text-primary-foreground/90"
              }`}
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => scrollTo("#turmas")}
            className="bg-secondary text-secondary-foreground text-sm font-bold px-5 py-2 rounded-full hover:bg-secondary/90 transition-colors shadow"
          >
            Inscreva-se
          </button>
        </nav>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-1"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {menuOpen ? (
            <X
              className={scrolled ? "text-foreground" : "text-primary-foreground"}
            />
          ) : (
            <Menu
              className={scrolled ? "text-foreground" : "text-primary-foreground"}
            />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="md:hidden bg-background border-b border-border shadow-lg"
          >
            <nav className="flex flex-col p-4 gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="text-base font-semibold text-foreground text-left py-2.5 px-2 rounded-lg hover:bg-muted transition-colors"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => scrollTo("#turmas")}
                className="mt-2 bg-secondary text-secondary-foreground font-bold px-5 py-3 rounded-full hover:bg-secondary/90 transition-colors"
              >
                Inscreva-se
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
