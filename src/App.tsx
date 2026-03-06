import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TurmasSection from "@/components/TurmasSection";
import AboutSection from "@/components/AboutSection";
import ContactSection from "@/components/ContactSection";
import WhatsAppButton from "@/components/WhatsAppButton";

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <TurmasSection />
      <AboutSection />
      <ContactSection />
      <WhatsAppButton />
    </div>
  );
}

export default App;
