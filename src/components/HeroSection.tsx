import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import heroImage from "@/assets/hero-robotics.avif";
import logosCodomSemecti from "@/assets/codó_e_semecti.webp";

const HeroSection = () => {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <section
      id="home"
      className="relative overflow-hidden bg-primary min-h-screen flex items-center py-24 md:py-32"
    >
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-10 w-20 h-20 border-4 border-primary-foreground/15 rounded-full animate-pulse" />
        <div
          className="absolute bottom-24 right-16 w-36 h-36 border-4 border-primary-foreground/15 rounded-full animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/3 left-1/4 w-14 h-14 border-4 border-primary-foreground/10 rotate-45"
          style={{
            animation: "spin 20s linear infinite",
          }}
        />
        <div className="absolute bottom-1/3 right-1/3 w-10 h-10 border-4 border-primary-foreground/10 rounded-full" />
        {/* Grid pattern */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="white"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center gap-10 relative z-10">
        {/* Text content */}
        <motion.div
          className="flex-1 text-center md:text-left"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <motion.span
            className="inline-block bg-secondary text-secondary-foreground px-5 py-1.5 rounded-full text-sm font-bold mb-5 shadow-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            🤖 Inscrições Abertas 2026!
          </motion.span>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-primary-foreground leading-tight mb-3 font-display">
            Clubinho de{" "}
            <span className="text-secondary">Robótica</span>
          </h1>

          <p className="text-xl text-primary-foreground/90 font-bold mb-2">
            📍 Codó, MA
          </p>
          <p className="text-primary-foreground/80 text-base md:text-lg mb-8 max-w-lg mx-auto md:mx-0">
            Aprenda robótica, programação e eletrônica de forma divertida e
            criativa. Para crianças do&nbsp;3º ao 9º ano!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <Button
              size="lg"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold text-base px-8 h-12 rounded-full shadow-lg"
              onClick={() => scrollTo("turmas")}
            >
              Ver Turmas
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-primary-foreground/50 text-primary-foreground bg-transparent hover:bg-primary-foreground/10 font-bold text-base px-8 h-12 rounded-full"
              onClick={() => scrollTo("contato")}
            >
              Falar Conosco
            </Button>
          </div>
        </motion.div>

        {/* Hero image + logos */}
        <motion.div
          className="flex-1 flex flex-col items-center gap-5 justify-center"
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.15, ease: "easeOut" }}
        >
          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl blur-2xl" />
            <img
              src={heroImage}
              alt="Crianças aprendendo robótica"
              className="relative w-full max-w-[480px] mx-auto rounded-3xl border-4 border-primary-foreground/20 object-cover"
            />
          </div>

          {/* Logos realizacao */}
          <div className="w-full max-w-[480px] flex justify-center items-center bg-white rounded-2xl shadow-md py-4 px-6 mt-0">
            <img
              src={logosCodomSemecti}
              alt="Prefeitura de Codó e SEMECTI"
              className="h-16 w-auto object-contain"
            />
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.button
        onClick={() => scrollTo("turmas")}
        className="absolute bottom-8 inset-x-0 mx-auto w-fit flex flex-col items-center gap-1 text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors"
        animate={{ y: [0, 7, 0] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        aria-label="Rolar para baixo"
      >
        <span className="text-xs font-medium tracking-wide">Saiba mais</span>
        <ChevronDown className="w-5 h-5" />
      </motion.button>
    </section>
  );
};

export default HeroSection;
